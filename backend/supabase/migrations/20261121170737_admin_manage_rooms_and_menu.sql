-- Editable inventory details and guarded deletes for rooms and menu items.
alter table public.menu_items add column description text not null default '' check(length(description)<=500);

update public.menu_items set description = case name
 when 'Lumpia Shooters' then 'Crisp Filipino spring rolls served as a lively, shareable first bite.'
 when 'Lemon Garlic Calamari' then 'Tender calamari brightened with lemon and savory garlic.'
 when 'Malunggay Niçoise Salad' then 'A fresh Niçoise inspired salad with a local malunggay touch.'
 when 'Kare-kare with Lechon Kawali' then 'Rich Filipino kare-kare paired with crisp lechon kawali.'
 when 'Crispy Cordon Bleu' then 'A golden, crisp take on the classic cordon bleu.'
 when 'Prawn Sinigang with Guava' then 'Comforting prawn sinigang lifted with the gentle sweetness of guava.'
 when 'Halo-halo' then 'A beloved Filipino shaved-ice dessert layered with colorful treats.'
 when 'Creamy Buko Tart' then 'A smooth coconut tart in a delicate pastry shell.'
 when 'Assorted Kakanin' then 'A selection of traditional Filipino rice delicacies.'
 when 'Premium Wine' then 'A considered wine selection to complement your meal.'
 when 'Fresh Pineapple Juice' then 'Bright, refreshing juice made with pineapple.'
 when 'Fruit Smoothie' then 'A cool, blended fruit drink for a refreshing pause.'
 else description end;

drop function public.save_menu_item(uuid,text,text,numeric,boolean);
drop function private.save_menu_item(uuid,text,text,numeric,boolean);

create function private.save_menu_item(p_id uuid,p_name text,p_description text,p_section text,p_price numeric,p_available boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.menu_items; old jsonb;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 80
  or p_description is null or length(btrim(p_description))>500
  or p_section is null or p_price is null or p_price<0 or p_price>100000 or p_available is null then
  raise exception 'INVALID_INPUT';
 end if;
 if p_id is null then
  insert into public.menu_items(name,description,section,price,available)
  values(btrim(p_name),btrim(p_description),p_section,p_price,p_available) returning * into m;
 else
  select * into m from public.menu_items where id=p_id for update;
  if not found then raise exception 'NOT_FOUND';end if;
  old:=to_jsonb(m);
  update public.menu_items set name=btrim(p_name),description=btrim(p_description),section=p_section,price=p_price,available=p_available
   where id=p_id returning * into m;
 end if;
 perform private.log(case when p_id is null then 'menu_item_created' else 'menu_item_updated' end,m.id,old,to_jsonb(m));
 return to_jsonb(m);
exception when check_violation or not_null_violation or unique_violation then raise exception 'INVALID_INPUT';
end $$;
revoke execute on function private.save_menu_item(uuid,text,text,text,numeric,boolean) from public,anon;
grant execute on function private.save_menu_item(uuid,text,text,text,numeric,boolean) to authenticated;
create function public.save_menu_item(p_id uuid,p_name text,p_description text,p_section text,p_price numeric,p_available boolean)
returns jsonb language sql security invoker set search_path='' as $$
 select private.save_menu_item(p_id,p_name,p_description,p_section,p_price,p_available)
$$;
revoke execute on function public.save_menu_item(uuid,text,text,text,numeric,boolean) from public,anon;
grant execute on function public.save_menu_item(uuid,text,text,text,numeric,boolean) to authenticated;

create function private.delete_menu_item(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.menu_items;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 select * into m from public.menu_items where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if exists(select 1 from public.order_items where menu_item_id=p_id) then raise exception 'MENU_ITEM_IN_USE';end if;
 delete from public.site_content where key='photo.menu.'||p_id::text;
 delete from public.menu_items where id=p_id;
 perform private.log('menu_item_deleted',m.id,to_jsonb(m),null);
 return to_jsonb(m);
end $$;
revoke execute on function private.delete_menu_item(uuid) from public,anon;
grant execute on function private.delete_menu_item(uuid) to authenticated;
create function public.delete_menu_item(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$
 select private.delete_menu_item(p_id)
$$;
revoke execute on function public.delete_menu_item(uuid) from public,anon;
grant execute on function public.delete_menu_item(uuid) to authenticated;

-- Room type descriptions are part of the existing room editor. Bookings retain their rate snapshots.
drop function public.save_room_type(uuid,numeric,integer);
drop function private.save_room_type(uuid,numeric,integer);
create function private.save_room_type(p_id uuid,p_name text,p_description text,p_nightly_rate numeric,p_capacity integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.room_types; old jsonb;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 100
  or p_description is null or length(btrim(p_description))>500
  or p_nightly_rate is null or p_nightly_rate not between 0 and 1000000
  or p_capacity is null or p_capacity not between 1 and 20 then raise exception 'INVALID_INPUT';end if;
 select * into t from public.room_types where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 old:=to_jsonb(t);
 update public.room_types set name=btrim(p_name),description=btrim(p_description),nightly_rate=p_nightly_rate,capacity=p_capacity
  where id=p_id returning * into t;
 perform private.log('room_type_updated',t.id,old,to_jsonb(t));
 return to_jsonb(t);
exception when check_violation or unique_violation then raise exception 'INVALID_INPUT';
end $$;
revoke execute on function private.save_room_type(uuid,text,text,numeric,integer) from public,anon;
grant execute on function private.save_room_type(uuid,text,text,numeric,integer) to authenticated;
create function public.save_room_type(p_id uuid,p_name text,p_description text,p_nightly_rate numeric,p_capacity integer)
returns jsonb language sql security invoker set search_path='' as $$
 select private.save_room_type(p_id,p_name,p_description,p_nightly_rate,p_capacity)
$$;
revoke execute on function public.save_room_type(uuid,text,text,numeric,integer) from public,anon;
grant execute on function public.save_room_type(uuid,text,text,numeric,integer) to authenticated;

create function private.save_room(p_id uuid,p_room_number text,p_room_type_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rooms; old jsonb;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if p_room_number is null or length(btrim(p_room_number)) not between 1 and 30 or p_room_type_id is null then raise exception 'INVALID_INPUT';end if;
 select * into r from public.rooms where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if r.room_type_id<>p_room_type_id and exists(select 1 from public.room_bookings where room_id=p_id) then
  raise exception 'ROOM_TYPE_CHANGE_BLOCKED';
 end if;
 old:=to_jsonb(r);
 update public.rooms set room_number=btrim(p_room_number),room_type_id=p_room_type_id where id=p_id returning * into r;
 perform private.log('room_updated',r.id,old,to_jsonb(r));
 return to_jsonb(r);
exception when unique_violation then raise exception 'DUPLICATE_INVENTORY';
 when foreign_key_violation then raise exception 'NOT_FOUND';
end $$;
revoke execute on function private.save_room(uuid,text,uuid) from public,anon;
grant execute on function private.save_room(uuid,text,uuid) to authenticated;
create function public.save_room(p_id uuid,p_room_number text,p_room_type_id uuid) returns jsonb language sql security invoker set search_path='' as $$
 select private.save_room(p_id,p_room_number,p_room_type_id)
$$;
revoke execute on function public.save_room(uuid,text,uuid) from public,anon;
grant execute on function public.save_room(uuid,text,uuid) to authenticated;

create function private.delete_room(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rooms;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 select * into r from public.rooms where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if exists(select 1 from public.room_bookings where room_id=p_id)
  or exists(select 1 from public.orders where room_id=p_id) then raise exception 'ROOM_IN_USE';end if;
 delete from public.resource_blocks where room_id=p_id;
 delete from public.rooms where id=p_id;
 perform private.log('room_deleted',r.id,to_jsonb(r),null);
 return to_jsonb(r);
end $$;
revoke execute on function private.delete_room(uuid) from public,anon;
grant execute on function private.delete_room(uuid) to authenticated;
create function public.delete_room(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$
 select private.delete_room(p_id)
$$;
revoke execute on function public.delete_room(uuid) from public,anon;
grant execute on function public.delete_room(uuid) to authenticated;

create function private.delete_room_type(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.room_types;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 select * into t from public.room_types where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if exists(select 1 from public.rooms where room_type_id=p_id) then raise exception 'ROOM_TYPE_IN_USE';end if;
 delete from public.site_content where key='photo.room.'||p_id::text;
 delete from public.room_types where id=p_id;
 perform private.log('room_type_deleted',t.id,to_jsonb(t),null);
 return to_jsonb(t);
end $$;
revoke execute on function private.delete_room_type(uuid) from public,anon;
grant execute on function private.delete_room_type(uuid) to authenticated;
create function public.delete_room_type(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$
 select private.delete_room_type(p_id)
$$;
revoke execute on function public.delete_room_type(uuid) from public,anon;
grant execute on function public.delete_room_type(uuid) to authenticated;

