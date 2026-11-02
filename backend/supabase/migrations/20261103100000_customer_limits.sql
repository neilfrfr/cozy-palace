-- A customer may have at most 3 requests waiting for staff (rooms and tables together). Holds now last until
-- check-in, so without a cap one free account could hold every room. Visitors have their own limit (visitor_rate_limit).
create function private.limit_pending() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Only the customer's own submits count; staff actions on a customer's booking are never blocked.
 if new.customer_id is null or new.customer_id is distinct from auth.uid() or (tg_op='UPDATE' and old.status='pending') then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('pending:'||new.customer_id::text,0));
 if (select count(*) from public.reservations where customer_id=new.customer_id and status='pending' and hold_expires_at>now() and id<>new.id)>=3
  then raise exception 'TOO_MANY_PENDING';end if;
 return new;
end $$;
revoke execute on function private.limit_pending() from public,anon,authenticated;
create trigger reservations_pending_limit before insert or update of status on public.reservations
 for each row when (new.status='pending') execute function private.limit_pending();

-- Repeat "Pay" clicks reuse the booking's live Xendit invoice instead of opening another payable one.
alter table public.payments
 add column checkout_url text check(checkout_url ~ '^https://'),
 add column checkout_expires_at timestamptz;

create or replace function private.open_payment(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.reservations; p public.payments;
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 select * into r from public.reservations where id=p_id for update;
 if not found or r.customer_id is distinct from u then raise exception 'NOT_FOUND';end if;
 if r.kind<>'hotel' or r.status not in('pending','confirmed') or (r.status='pending' and r.hold_expires_at<=now()) or r.total<=0
  or exists(select 1 from public.payments x where x.reservation_id=r.id and x.status='paid') then raise exception 'INVALID_TRANSITION';end if;
 -- A changed total needs a new invoice; the old one, if still paid, lands in review (record_payment checks the amount).
 select * into p from public.payments where reservation_id=r.id and status='open' and amount=r.total
  and checkout_expires_at>now()+interval '10 minutes' order by created_at desc limit 1;
 if not found then
  insert into public.payments(reservation_id,amount) values(r.id,r.total) returning * into p;
 end if;
 return jsonb_build_object('id',p.id,'amount',p.amount,'reference',r.reference,'checkout_url',p.checkout_url);
end $$;

-- Only the app server stores the invoice link it got from Xendit.
create function private.save_checkout(p_payment uuid,p_url text,p_expires timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_url !~ '^https://' or p_expires is null then raise exception 'INVALID_INPUT';end if;
 update public.payments set checkout_url=p_url,checkout_expires_at=p_expires where id=p_payment and status='open' and checkout_url is null;
end $$;
revoke execute on function private.save_checkout(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function private.save_checkout(uuid,text,timestamptz) to service_role;
create function public.save_checkout(p_payment_id uuid,p_checkout_url text,p_expires_at timestamptz) returns void language sql security invoker set search_path='' as $$select private.save_checkout(p_payment_id,p_checkout_url,p_expires_at)$$;
revoke execute on function public.save_checkout(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.save_checkout(uuid,text,timestamptz) to service_role;

-- The daily job clears rate-limit records once they no longer count (the longest window is one hour).
create function private.prune_rate_limits() returns integer language plpgsql security definer set search_path='' as $$
declare a integer; b integer;
begin
 delete from private.guest_booking_attempts where at<now()-interval '1 day';
 get diagnostics a=row_count;
 delete from private.guest_lookup_attempts where at<now()-interval '1 day';
 get diagnostics b=row_count;
 return a+b;
end $$;
revoke execute on function private.prune_rate_limits() from public,anon,authenticated;
grant execute on function private.prune_rate_limits() to service_role;
create function public.prune_rate_limits() returns integer language sql security invoker set search_path='' as $$select private.prune_rate_limits()$$;
revoke execute on function public.prune_rate_limits() from public,anon,authenticated;
grant execute on function public.prune_rate_limits() to service_role;
