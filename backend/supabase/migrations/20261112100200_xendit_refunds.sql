-- FR08: staff send refunds through Xendit's Refund API. One row per refund request; full or partial.
-- A request stays 'pending' until Xendit's refund callback says it succeeded or failed.
-- The manual "mark refunded" record (mark_payment_refunded) stays as the fallback.
create table public.refunds (
 id uuid primary key default gen_random_uuid(),
 payment_id uuid not null references public.payments(id),
 amount numeric(12,2) not null check(amount>0),
 status text not null default 'pending' check(status in('pending','succeeded','failed')),
 provider_refund_id text check(length(provider_refund_id) between 1 and 100),
 failure_code text check(length(failure_code) between 1 and 100),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 completed_at timestamptz
);
-- At most one refund in flight per payment: a double click or a second tab cannot send two.
create unique index refunds_one_pending on public.refunds(payment_id) where status='pending';
alter table public.refunds enable row level security;
create policy staff_refunds on public.refunds for select to authenticated using(private.is_staff());
grant select on public.refunds to authenticated;

-- Same refundable rule as mark_payment_refunded; the amount is checked against what has not been refunded yet.
create function private.request_refund(p_payment uuid,p_amount numeric) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); p public.payments; r public.reservations; f public.refunds; remaining numeric;
begin
 if not private.is_staff() then raise exception 'FORBIDDEN';end if;
 if p_payment is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) then raise exception 'INVALID_INPUT';end if;
 select * into p from public.payments where id=p_payment for update;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into r from public.reservations where id=p.reservation_id;
 if p.provider_payment_id is null or not (p.status='review' or (p.status='paid' and r.status in('cancelled','expired'))) then raise exception 'INVALID_TRANSITION';end if;
 if exists(select 1 from public.refunds where payment_id=p.id and status='pending') then raise exception 'REFUND_PENDING';end if;
 remaining:=p.amount_paid-coalesce((select sum(amount) from public.refunds where payment_id=p.id and status='succeeded'),0);
 if p_amount>remaining then raise exception 'INVALID_INPUT';end if;
 insert into public.refunds(payment_id,amount,created_by) values(p.id,p_amount,u) returning * into f;
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,before_values,after_values)
 select u,pr.full_name,coalesce(s.role,'customer'),'refund_requested',r.id,jsonb_build_object('payment',p.id,'status',p.status),
  jsonb_build_object('payment',p.id,'refund',f.id,'amount',p_amount)
 from public.profiles pr left join public.staff_roles s on s.user_id=pr.id where pr.id=u;
 return jsonb_build_object('id',f.id,'invoice_id',p.provider_payment_id,'amount',f.amount,'booking_status',r.status);
end $$;
revoke execute on function private.request_refund(uuid,numeric) from public,anon;
grant execute on function private.request_refund(uuid,numeric) to authenticated;
create function public.request_refund(p_payment_id uuid,p_amount numeric) returns jsonb language sql security invoker set search_path='' as $$select private.request_refund(p_payment_id,p_amount)$$;
revoke execute on function public.request_refund(uuid,numeric) from public,anon;
grant execute on function public.request_refund(uuid,numeric) to authenticated;

-- Only the app server (Xendit's callback, or a request Xendit rejected) settles a refund. Replays are no-ops.
-- Once everything paid has come back, the payment becomes 'refunded', which also notifies the guest (notify_refund).
create function private.settle_refund(p_refund uuid,p_status text,p_provider_id text,p_failure text) returns text language plpgsql security definer set search_path='' as $$
declare f public.refunds; p public.payments; total numeric;
begin
 if p_refund is null or p_status not in('succeeded','failed') then raise exception 'INVALID_INPUT';end if;
 select * into f from public.refunds where id=p_refund;
 if not found then raise exception 'NOT_FOUND';end if;
 -- Payment first, as request_refund locks it.
 select * into p from public.payments where id=f.payment_id for update;
 select * into f from public.refunds where id=p_refund for update;
 if f.status<>'pending' then return f.status;end if;
 update public.refunds set status=p_status,provider_refund_id=coalesce(left(p_provider_id,100),provider_refund_id),
  failure_code=left(p_failure,100),completed_at=now() where id=f.id returning * into f;
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,before_values,after_values)
 values(null,'Xendit','system','refund_'||p_status,p.reservation_id,jsonb_build_object('refund',f.id,'status','pending'),
  jsonb_build_object('refund',f.id,'status',p_status,'amount',f.amount,'provider_refund_id',f.provider_refund_id,'failure_code',f.failure_code));
 if p_status='succeeded' and p.status<>'refunded' then
  select sum(amount) into total from public.refunds where payment_id=p.id and status='succeeded';
  if total>=p.amount_paid then
   update public.payments set status='refunded',refunded_at=now(),refunded_by=f.created_by,refund_reference=coalesce(f.provider_refund_id,'Xendit refund') where id=p.id;
  end if;
 end if;
 return p_status;
end $$;
revoke execute on function private.settle_refund(uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.settle_refund(uuid,text,text,text) to service_role;
create function public.settle_refund(p_refund_id uuid,p_status text,p_provider_refund_id text,p_failure_code text) returns text language sql security invoker set search_path='' as $$select private.settle_refund(p_refund_id,p_status,p_provider_refund_id,p_failure_code)$$;
revoke execute on function public.settle_refund(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.settle_refund(uuid,text,text,text) to service_role;
