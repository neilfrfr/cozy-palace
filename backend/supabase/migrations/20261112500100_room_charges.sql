-- FR12 room charges: staff enter a food order against a room number. It goes on the bill of the stay checked in to
-- that room, unpaid, and the whole bill is settled at the front desk at check-out. No online payment.
alter table public.orders add column room_id uuid references public.rooms(id);

-- create_order as in 20261101090000_menu_orders, plus p_room_number: a room charge, mutually exclusive with a reference.
drop function public.create_order(jsonb,text,text,uuid);
drop function private.create_order(jsonb,text,text,uuid);
create function private.create_order(p_items jsonb,p_reservation_reference text,p_note text,p_key uuid,p_room_number text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); o public.orders; r public.reservations; room uuid; n integer;
begin
 if not private.is_staff() then raise exception 'FORBIDDEN';end if;
 if p_key is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 30
  or length(p_note)>200 or (nullif(btrim(p_reservation_reference),'') is not null and nullif(btrim(p_room_number),'') is not null) then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||p_key::text,0));
 select * into o from public.orders where staff_id=u and idempotency_key=p_key;
 if found then return to_jsonb(o);end if;
 if nullif(btrim(p_room_number),'') is not null then
  -- The stay checked in to the room now; if an earlier guest was never checked out, the latest arrival wins.
  select x.* into r from public.reservations x join public.room_bookings b on b.reservation_id=x.id join public.rooms rm on rm.id=b.room_id
  where rm.room_number=btrim(p_room_number) and x.status='checked_in' order by b.check_in desc limit 1;
  if not found then raise exception 'NO_CURRENT_STAY';end if;
  select room_id into room from public.room_bookings where reservation_id=r.id;
 elsif nullif(btrim(p_reservation_reference),'') is not null then
  select * into r from public.reservations where reference=upper(btrim(p_reservation_reference));
  if not found then raise exception 'NOT_FOUND';end if;
 end if;
 insert into public.orders(customer_id,reservation_id,room_id,staff_id,total,note,idempotency_key)
 values(r.customer_id,r.id,room,u,0,nullif(btrim(p_note),''),p_key) returning * into o;
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
revoke execute on function private.create_order(jsonb,text,text,uuid,text) from public,anon;
grant execute on function private.create_order(jsonb,text,text,uuid,text) to authenticated;
create function public.create_order(p_items jsonb,p_reservation_reference text,p_note text,p_idempotency_key uuid,p_room_number text default null) returns jsonb language sql security invoker set search_path='' as $$select private.create_order(p_items,p_reservation_reference,p_note,p_idempotency_key,p_room_number)$$;
revoke execute on function public.create_order(jsonb,text,text,uuid,text) from public,anon;
grant execute on function public.create_order(jsonb,text,text,uuid,text) to authenticated;

-- mark_order_paid as in 20261103090000_admin_inventory, except room charges: they are paid only by settling the room bill.
create or replace function private.mark_order_paid(p_id uuid,p_version integer,p_method text,p_reference text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders; old jsonb;
begin
 if not private.is_staff() then raise exception 'FORBIDDEN';end if;
 select * into o from public.orders where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if o.version is distinct from p_version then raise exception 'VERSION_CONFLICT';end if;
 if o.status='cancelled' or o.paid_at is not null or o.room_id is not null then raise exception 'INVALID_TRANSITION';end if;
 old:=to_jsonb(o);
 update public.orders set paid_at=now(),paid_by=auth.uid(),payment_method=p_method,payment_reference=nullif(btrim(p_reference),''),version=version+1 where id=o.id returning * into o;
 perform private.log('order_paid',o.id,old,to_jsonb(o));
 return to_jsonb(o);
exception when check_violation then raise exception 'INVALID_INPUT';
end $$;

-- Front desk takes payment for every unpaid room charge of the stay at once; each order records who and when.
create function private.settle_room_bill(p_reservation uuid,p_method text,p_reference text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reservations; n integer; amount numeric(12,2);
begin
 if not private.is_staff() then raise exception 'FORBIDDEN';end if;
 select * into r from public.reservations where id=p_reservation for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if r.status not in('checked_in','completed') then raise exception 'INVALID_TRANSITION';end if;
 with paid as (
  update public.orders set paid_at=now(),paid_by=auth.uid(),payment_method=p_method,payment_reference=nullif(btrim(p_reference),''),version=version+1
  where reservation_id=r.id and room_id is not null and paid_at is null and status<>'cancelled' returning total
 ) select count(*),coalesce(sum(total),0) into n,amount from paid;
 if n=0 then raise exception 'INVALID_TRANSITION';end if;
 perform private.log('room_bill_settled',r.id,null,jsonb_build_object('orders',n,'amount',amount,'method',p_method,'reference',nullif(btrim(p_reference),'')));
 perform private.enqueue(r,'bill_settled',r.id||':bill_settled:'||extract(epoch from now()),null,amount);
 return jsonb_build_object('orders',n,'amount',amount);
exception when check_violation then raise exception 'INVALID_INPUT';
end $$;
revoke execute on function private.settle_room_bill(uuid,text,text) from public,anon;
grant execute on function private.settle_room_bill(uuid,text,text) to authenticated;
create function public.settle_room_bill(p_reservation_id uuid,p_method text,p_reference text) returns jsonb language sql security invoker set search_path='' as $$select private.settle_room_bill(p_reservation_id,p_method,p_reference)$$;
revoke execute on function public.settle_room_bill(uuid,text,text) from public,anon;
grant execute on function public.settle_room_bill(uuid,text,text) to authenticated;

-- FR09 order emails (see 20261112500000_purchase_emails).
-- New order or room charge; then any status change, or a counter payment. Room charges are paid only by
-- settling the bill, which sends one bill_settled email instead of one per order.
create function private.notify_order() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.reservations; ev text;
begin
 if new.reservation_id is null then return null;end if;
 if tg_op='INSERT' then ev:=case when new.room_id is null then 'order_placed' else 'room_charge' end;
 elsif new.status<>old.status or (old.paid_at is null and new.paid_at is not null and new.room_id is null) then ev:='order_updated';
 end if;
 if ev is null then return null;end if;
 select * into r from public.reservations where id=new.reservation_id;
 perform private.enqueue(r,ev,new.id||':'||ev||':'||new.version,new.id);
 return null;
end $$;
revoke execute on function private.notify_order() from public,anon,authenticated;
create trigger notify_order after insert or update on public.orders for each row execute function private.notify_order();
