-- FR08/FR09: tell the guest when staff record a refund, through the same notice list and email outbox as booking events.
alter table public.notifications drop constraint notifications_event_check;
alter table public.notifications add constraint notifications_event_check
 check(event in('received','confirmed','changed','cancelled','expired','reminder','refunded'));

create function private.notify_refund() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.reservations;
begin
 select * into r from public.reservations where id=new.reservation_id;
 perform private.enqueue(r,'refunded',new.id||':refunded');
 return null;
end $$;
revoke execute on function private.notify_refund() from public,anon,authenticated;
create trigger notify_refund after update of status on public.payments for each row
 when (new.status='refunded' and old.status is distinct from 'refunded') execute function private.notify_refund();
