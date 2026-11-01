-- FR12: a small staff-entered order ledger. No kitchen workflow, stock or online food ordering.
-- Orders link to a customer only through a reservation that belongs to their account, never by email.
create table public.menu_items (
 id uuid primary key default gen_random_uuid(), name text unique not null check(length(btrim(name)) between 1 and 80),
 section text not null check(section in('Appetizers','Main Course','Dessert','Drinks')),
 price numeric(12,2) not null check(price>=0), available boolean not null default true
);
create table public.orders (
 id uuid primary key default gen_random_uuid(), reference text unique not null default ('OR-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 customer_id uuid references public.profiles(id), reservation_id uuid references public.reservations(id),
 staff_id uuid not null references public.profiles(id), status text not null default 'open' check(status in('open','completed','cancelled')),
 total numeric(12,2) not null check(total>=0), note text check(length(note)<=200), version integer not null default 1,
 idempotency_key uuid not null, created_at timestamptz not null default now(), unique(staff_id,idempotency_key)
);
create table public.order_items (
 order_id uuid not null references public.orders(id) on delete cascade, menu_item_id uuid not null references public.menu_items(id),
 name text not null, unit_price numeric(12,2) not null check(unit_price>=0), quantity integer not null check(quantity between 1 and 50),
 primary key(order_id,menu_item_id)
);
create index orders_customer_created on public.orders(customer_id,created_at desc);
create index orders_created on public.orders(created_at desc);
create index orders_reservation on public.orders(reservation_id);
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
create policy public_menu on public.menu_items for select to anon,authenticated using(true);
create policy own_orders on public.orders for select to authenticated using(customer_id=auth.uid() or private.is_staff());
create policy own_order_items on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id));
revoke all on public.menu_items,public.orders,public.order_items from anon,authenticated;
grant select on public.menu_items to anon,authenticated;
grant select on public.orders,public.order_items to authenticated;

create function private.log(p_action text,p_record uuid,p_before jsonb,p_after jsonb) returns void language sql security definer set search_path='' as $$
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,before_values,after_values)
 select p.id,p.full_name,coalesce(s.role,'customer'),p_action,p_record,p_before,p_after from public.profiles p left join public.staff_roles s on s.user_id=p.id where p.id=auth.uid()
$$;
revoke execute on function private.log(text,uuid,jsonb,jsonb) from public,anon,authenticated;

-- p_items: [{"item": uuid, "quantity": int}]. Prices and names come from menu_items, never the browser.
create function private.create_order(p_items jsonb,p_reservation_reference text,p_note text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); o public.orders; r public.reservations; n integer;
begin
 if not private.is_staff() then raise exception 'FORBIDDEN';end if;
 if p_key is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 30
  or length(p_note)>200 then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||p_key::text,0));
 select * into o from public.orders where staff_id=u and idempotency_key=p_key;
 if found then return to_jsonb(o);end if;
 if nullif(btrim(p_reservation_reference),'') is not null then
  select * into r from public.reservations where reference=upper(btrim(p_reservation_reference));
  if not found then raise exception 'NOT_FOUND';end if;
 end if;
 insert into public.orders(customer_id,reservation_id,staff_id,total,note,idempotency_key)
 values(r.customer_id,r.id,u,0,nullif(btrim(p_note),''),p_key) returning * into o;
 insert into public.order_items(order_id,menu_item_id,name,unit_price,quantity)
 select o.id,m.id,m.name,m.price,(x->>'quantity')::integer from jsonb_array_elements(p_items) x
 join public.menu_items m on m.id=(x->>'item')::uuid and m.available;
 get diagnostics n=row_count;
 if n<>jsonb_array_length(p_items) then raise exception 'INVALID_INPUT';end if;
 update public.orders set total=(select sum(unit_price*quantity) from public.order_items where order_id=o.id) where id=o.id returning * into o;
 perform private.log('order_created',o.id,null,to_jsonb(o)||jsonb_build_object('items',p_items));
 return to_jsonb(o);
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or unique_violation then raise exception 'INVALID_INPUT';
end $$;
revoke execute on function private.create_order(jsonb,text,text,uuid) from public,anon;
grant execute on function private.create_order(jsonb,text,text,uuid) to authenticated;
create function public.create_order(p_items jsonb,p_reservation_reference text,p_note text,p_idempotency_key uuid) returns jsonb language sql security invoker set search_path='' as $$select private.create_order(p_items,p_reservation_reference,p_note,p_idempotency_key)$$;

create function private.transition_order(p_id uuid,p_version integer,p_status text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders; old jsonb;
begin
 if not private.is_staff() then raise exception 'FORBIDDEN';end if;
 select * into o from public.orders where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if o.version is distinct from p_version then raise exception 'VERSION_CONFLICT';end if;
 if o.status<>'open' or p_status not in('completed','cancelled') then raise exception 'INVALID_TRANSITION';end if;
 old:=to_jsonb(o);
 update public.orders set status=p_status,version=version+1 where id=o.id returning * into o;
 perform private.log('order_'||p_status,o.id,old,to_jsonb(o));
 return to_jsonb(o);
end $$;
revoke execute on function private.transition_order(uuid,integer,text) from public,anon;
grant execute on function private.transition_order(uuid,integer,text) to authenticated;
create function public.transition_order(p_id uuid,p_version integer,p_status text) returns jsonb language sql security invoker set search_path='' as $$select private.transition_order(p_id,p_version,p_status)$$;

-- Admin-only menu management; price changes are logged (FR11). Past orders keep their snapshots.
create function private.save_menu_item(p_id uuid,p_name text,p_section text,p_price numeric,p_available boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.menu_items; old jsonb;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if p_price is null or p_price<0 or p_price>100000 or p_available is null then raise exception 'INVALID_INPUT';end if;
 if p_id is null then
  insert into public.menu_items(name,section,price,available) values(btrim(p_name),p_section,p_price,p_available) returning * into m;
 else
  select * into m from public.menu_items where id=p_id for update;
  if not found then raise exception 'NOT_FOUND';end if;
  old:=to_jsonb(m);
  update public.menu_items set name=btrim(p_name),section=p_section,price=p_price,available=p_available where id=p_id returning * into m;
 end if;
 perform private.log(case when p_id is null then 'menu_item_created' else 'menu_item_updated' end,m.id,old,to_jsonb(m));
 return to_jsonb(m);
exception when check_violation or not_null_violation or unique_violation then raise exception 'INVALID_INPUT';
end $$;
revoke execute on function private.save_menu_item(uuid,text,text,numeric,boolean) from public,anon;
grant execute on function private.save_menu_item(uuid,text,text,numeric,boolean) to authenticated;
create function public.save_menu_item(p_id uuid,p_name text,p_section text,p_price numeric,p_available boolean) returns jsonb language sql security invoker set search_path='' as $$select private.save_menu_item(p_id,p_name,p_section,p_price,p_available)$$;

revoke execute on function public.create_order(jsonb,text,text,uuid),public.transition_order(uuid,integer,text),public.save_menu_item(uuid,text,text,numeric,boolean) from public,anon;
grant execute on function public.create_order(jsonb,text,text,uuid),public.transition_order(uuid,integer,text),public.save_menu_item(uuid,text,text,numeric,boolean) to authenticated;

-- Starting menu matches the dining page; prices are placeholders for the admin to set.
insert into public.menu_items(name,section,price) values
 ('Lumpia Shooters','Appetizers',220),('Lemon Garlic Calamari','Appetizers',320),('Malunggay Niçoise Salad','Appetizers',280),
 ('Kare-kare with Lechon Kawali','Main Course',520),('Crispy Cordon Bleu','Main Course',450),('Prawn Sinigang with Guava','Main Course',580),
 ('Halo-halo','Dessert',180),('Creamy Buko Tart','Dessert',150),('Assorted Kakanin','Dessert',160),
 ('Premium Wine','Drinks',350),('Fresh Pineapple Juice','Drinks',120),('Fruit Smoothie','Drinks',150)
on conflict(name) do nothing;
