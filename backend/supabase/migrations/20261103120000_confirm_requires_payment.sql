-- FR03/FR08: an online customer's room request is confirmed only once it is paid.
-- Visitor and staff-made bookings (no online payment) and table bookings keep the staff-only rule.
-- A trigger covers every path that confirms, not just the staff button.
create function private.require_payment_to_confirm() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind='hotel' and new.booking_source='customer_online'
  and not exists(select 1 from public.payments p where p.reservation_id=new.id and p.status='paid')
 then raise exception 'PAYMENT_REQUIRED';end if;
 return new;
end $$;
revoke execute on function private.require_payment_to_confirm() from public,anon,authenticated;
create trigger require_payment_to_confirm before update of status on public.reservations for each row
 when (new.status='confirmed' and old.status='pending') execute function private.require_payment_to_confirm();
