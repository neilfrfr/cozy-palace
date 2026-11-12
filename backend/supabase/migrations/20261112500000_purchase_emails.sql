-- FR09: email the guest after every purchase through the same notice list and outbox as booking events:
-- orders and their updates, room charges, a settled room bill, online payments and partial refunds.
-- Orders not linked to a booking (walk-ins) have no guest to tell. Rows without an email are stored as 'skipped'.
alter table public.notifications drop constraint notifications_event_check;
alter table public.notifications add constraint notifications_event_check
 check(event in('received','confirmed','changed','cancelled','expired','reminder','refunded',
  'paid','partially_refunded','order_placed','room_charge','order_updated','bill_settled'));
alter table public.notifications
 add column order_id uuid references public.orders(id) on delete cascade,
 add column amount numeric(12,2);

-- enqueue as in 20261102090000_notifications, plus the order and amount the email is about.
drop function private.enqueue(public.reservations,text,text);
create function private.enqueue(r public.reservations,p_event text,p_key text,p_order uuid default null,p_amount numeric default null) returns void language sql security definer set search_path='' as $$
 insert into public.notifications(reservation_id,recipient_id,email,event,event_key,delivery,order_id,amount)
 select r.id,case when r.booking_source='customer_online' then r.customer_id end,e.email,p_event,p_key,
  case when e.email is null then 'skipped' else 'pending' end,p_order,p_amount
 from (select coalesce((select u.email from auth.users u where u.id=r.customer_id and r.booking_source='customer_online'),r.guest_email) as email) e
 on conflict(event_key) do nothing
$$;
revoke execute on function private.enqueue(public.reservations,text,text,uuid,numeric) from public,anon,authenticated;

create function private.notify_payment() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.reservations;
begin
 select * into r from public.reservations where id=new.reservation_id;
 perform private.enqueue(r,'paid',new.id||':paid',null,new.amount_paid);
 return null;
end $$;
revoke execute on function private.notify_payment() from public,anon,authenticated;
create trigger notify_payment after update of status on public.payments for each row
 when (new.status='paid' and old.status is distinct from 'paid') execute function private.notify_payment();

-- A refund that leaves money still paid; the refund that returns the rest sends 'refunded' (notify_refund).
create function private.notify_partial_refund() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.payments; r public.reservations;
begin
 select * into p from public.payments where id=new.payment_id;
 if (select sum(amount) from public.refunds where payment_id=p.id and status='succeeded')>=p.amount_paid then return null;end if;
 select * into r from public.reservations where id=p.reservation_id;
 perform private.enqueue(r,'partially_refunded',new.id||':partially_refunded',null,new.amount);
 return null;
end $$;
revoke execute on function private.notify_partial_refund() from public,anon,authenticated;
create trigger notify_partial_refund after update of status on public.refunds for each row
 when (new.status='succeeded' and old.status is distinct from 'succeeded') execute function private.notify_partial_refund();

-- The email sender (service_role) also reads the order and the booking's extras.
grant select on public.orders, public.order_items, public.rooms, public.reservation_extras to service_role;
