-- FR09: one row per booking event. It is the in-app notice (for account holders) and the email outbox.
-- A trigger writes it in the same transaction as the booking change, so the intent can't be lost;
-- a worker (service_role) sends the email later and records attempts. Email failure never touches the booking.
create table public.notifications (
 id uuid primary key default gen_random_uuid(), reservation_id uuid not null references public.reservations(id) on delete cascade,
 recipient_id uuid references public.profiles(id), email text,
 event text not null check(event in('received','confirmed','changed','cancelled','expired','reminder')),
 event_key text unique not null, created_at timestamptz not null default now(), read_at timestamptz,
 delivery text not null default 'pending' check(delivery in('pending','sending','sent','failed','skipped')),
 attempts integer not null default 0, last_error text, next_attempt_at timestamptz not null default now(), sent_at timestamptz
);
create index notifications_recipient on public.notifications(recipient_id,created_at desc);
create index notifications_due on public.notifications(next_attempt_at) where delivery in('pending','sending','failed');
alter table public.notifications enable row level security;
create policy own_notifications on public.notifications for select to authenticated using(recipient_id=auth.uid());
revoke all on public.notifications from anon,authenticated;
grant select on public.notifications to authenticated;

create function private.enqueue(r public.reservations,p_event text,p_key text) returns void language sql security definer set search_path='' as $$
 insert into public.notifications(reservation_id,recipient_id,email,event,event_key,delivery)
 select r.id,case when r.booking_source='customer_online' then r.customer_id end,e.email,p_event,p_key,
  case when e.email is null then 'skipped' else 'pending' end
 from (select coalesce((select u.email from auth.users u where u.id=r.customer_id and r.booking_source='customer_online'),r.guest_email) as email) e
 on conflict(event_key) do nothing
$$;
revoke execute on function private.enqueue(public.reservations,text,text) from public,anon,authenticated;

create function private.notify_booking() returns trigger language plpgsql security definer set search_path='' as $$
declare ev text;
begin
 if tg_op='INSERT' or new.status<>old.status then
  ev:=case new.status when 'pending' then 'received' when 'confirmed' then 'confirmed' when 'cancelled' then 'cancelled' when 'expired' then 'expired' end;
 elsif new.version>old.version and new.status in('pending','confirmed') then ev:='changed';
 end if;
 if ev is not null then perform private.enqueue(new,ev,new.id||':'||ev||':'||new.version);end if;
 return null;
end $$;
revoke execute on function private.notify_booking() from public,anon,authenticated;
create trigger notify_booking after insert or update on public.reservations for each row execute function private.notify_booking();

-- Confirmed stays and tables starting tomorrow in Manila; the event key makes a rerun harmless.
create function public.enqueue_reminders() returns integer language plpgsql security definer set search_path='' as $$
declare r public.reservations; n integer:=0; tomorrow date:=(now() at time zone 'Asia/Manila')::date+1;
begin
 for r in select x.* from public.reservations x where x.status='confirmed' and (
  exists(select 1 from public.room_bookings b where b.reservation_id=x.id and b.check_in=tomorrow) or
  exists(select 1 from public.table_bookings t where t.reservation_id=x.id and (t.start_at at time zone 'Asia/Manila')::date=tomorrow))
 loop perform private.enqueue(r,'reminder',r.id||':reminder');n:=n+1;end loop;
 return n;
end $$;

-- Hands the worker up to p_limit due emails and marks them sending; rows stuck in sending for 10 minutes are retried.
create function public.claim_notifications(p_limit integer) returns setof public.notifications language sql security definer set search_path='' as $$
 update public.notifications n set delivery='sending',attempts=n.attempts+1,next_attempt_at=now()+interval '10 minutes'
 where n.id in(select id from public.notifications where delivery in('pending','sending','failed') and next_attempt_at<=now() and attempts<5
  order by next_attempt_at limit least(p_limit,50) for update skip locked)
 returning n.*
$$;
-- Retries back off 15, 30, 45 and 60 minutes; after 5 attempts the row stays failed for staff to see.
create function public.finish_notification(p_id uuid,p_error text) returns void language sql security definer set search_path='' as $$
 update public.notifications set delivery=case when p_error is null then 'sent' else 'failed' end,
  sent_at=case when p_error is null then now() end,last_error=left(p_error,500),next_attempt_at=now()+attempts*interval '15 minutes'
 where id=p_id and delivery='sending'
$$;
revoke execute on function public.enqueue_reminders(),public.claim_notifications(integer),public.finish_notification(uuid,text) from public,anon,authenticated;
grant execute on function public.enqueue_reminders(),public.claim_notifications(integer),public.finish_notification(uuid,text) to service_role;

create function private.mark_notifications_read() returns void language sql security definer set search_path='' as $$
 update public.notifications set read_at=now() where recipient_id=auth.uid() and read_at is null
$$;
revoke execute on function private.mark_notifications_read() from public,anon;
grant execute on function private.mark_notifications_read() to authenticated;
create function public.mark_notifications_read() returns void language sql security invoker set search_path='' as $$select private.mark_notifications_read()$$;
revoke execute on function public.mark_notifications_read() from public,anon;
grant execute on function public.mark_notifications_read() to authenticated;
