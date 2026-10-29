-- PayMongo hosted checkout. One row per checkout attempt; card and wallet details never reach this database.
-- Customers open a payment; only the signed webhook (service_role) records it as paid.
create table public.payments (
 id uuid primary key default gen_random_uuid(), reservation_id uuid not null references public.reservations(id),
 amount numeric(12,2) not null check(amount>0), currency text not null default 'PHP' check(currency='PHP'),
 status text not null default 'open' check(status in('open','paid','review')),
 provider_payment_id text unique, amount_paid numeric(12,2),
 created_at timestamptz not null default now(), paid_at timestamptz
);
create index payment_reservation on public.payments(reservation_id,created_at desc);
alter table public.payments enable row level security;
create policy own_payments on public.payments for select to authenticated using(exists(select 1 from public.reservations r where r.id=reservation_id));
grant select on public.payments to authenticated;
grant usage on schema private to service_role;

-- The amount is copied from the stored total, never taken from the browser.
create function private.open_payment(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.reservations; p public.payments;
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 select * into r from public.reservations where id=p_id for update;
 if not found or r.customer_id is distinct from u then raise exception 'NOT_FOUND';end if;
 if r.kind<>'hotel' or r.status<>'pending' or r.hold_expires_at<=now() or r.total<=0
  or exists(select 1 from public.payments x where x.reservation_id=r.id and x.status='paid') then raise exception 'INVALID_TRANSITION';end if;
 insert into public.payments(reservation_id,amount) values(r.id,r.total) returning * into p;
 return jsonb_build_object('id',p.id,'amount',p.amount,'reference',r.reference);
end $$;
revoke execute on function private.open_payment(uuid) from public,anon;
grant execute on function private.open_payment(uuid) to authenticated;
create function public.open_payment(p_reservation_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.open_payment(p_reservation_id)$$;
revoke execute on function public.open_payment(uuid) from public,anon;
grant execute on function public.open_payment(uuid) to authenticated;

-- Replayed events are no-ops. Money that does not match a live hold is kept as 'review' for staff to refund.
create function private.record_payment(p_payment uuid,p_provider_id text,p_amount numeric,p_currency text) returns text language plpgsql security definer set search_path='' as $$
declare p public.payments; r public.reservations; outcome text;
begin
 if p_payment is null or p_provider_id is null or p_amount is null or p_currency is null then raise exception 'INVALID_INPUT';end if;
 select * into p from public.payments where id=p_payment for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if p.provider_payment_id is not null then return p.status;end if;
 select * into r from public.reservations where id=p.reservation_id for update;
 outcome:=case when p_currency='PHP' and p_amount=p.amount and p_amount=r.total and r.status='pending' and r.hold_expires_at>now() then 'paid' else 'review' end;
 update public.payments set status=outcome,provider_payment_id=p_provider_id,amount_paid=p_amount,paid_at=now() where id=p.id;
 if outcome='paid' then update public.reservations set status='confirmed',version=version+1,hold_expires_at=null where id=r.id;end if;
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,before_values,after_values)
 values(null,'PayMongo','system','payment_'||outcome,r.id,jsonb_build_object('status',r.status),
  jsonb_build_object('status',case when outcome='paid' then 'confirmed' else r.status end,'payment',p.id,'amount_paid',p_amount));
 return outcome;
end $$;
revoke execute on function private.record_payment(uuid,text,numeric,text) from public,anon,authenticated;
grant execute on function private.record_payment(uuid,text,numeric,text) to service_role;
create function public.record_payment(p_payment_id uuid,p_provider_payment_id text,p_amount numeric,p_currency text) returns text language sql security invoker set search_path='' as $$select private.record_payment(p_payment_id,p_provider_payment_id,p_amount,p_currency)$$;
revoke execute on function public.record_payment(uuid,text,numeric,text) from public,anon,authenticated;
grant execute on function public.record_payment(uuid,text,numeric,text) to service_role;
