-- Payments now come from Xendit hosted invoices; only the audit actor name changes.
create or replace function private.record_payment(p_payment uuid,p_provider_id text,p_amount numeric,p_currency text) returns text language plpgsql security definer set search_path='' as $$
declare p public.payments; r public.reservations; outcome text;
begin
 if p_payment is null or p_provider_id is null or p_amount is null or p_currency is null then raise exception 'INVALID_INPUT';end if;
 select * into p from public.payments where id=p_payment for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if p.provider_payment_id is not null then return p.status;end if;
 select * into r from public.reservations where id=p.reservation_id for update;
 outcome:=case when p_currency='PHP' and p_amount=p.amount and p_amount=r.total and (r.status='confirmed' or (r.status='pending' and r.hold_expires_at>now()))
  and not exists(select 1 from public.payments x where x.reservation_id=r.id and x.status='paid') then 'paid' else 'review' end;
 update public.payments set status=outcome,provider_payment_id=p_provider_id,amount_paid=p_amount,paid_at=now() where id=p.id;
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,before_values,after_values)
 values(null,'Xendit','system','payment_'||outcome,r.id,jsonb_build_object('status',r.status),
  jsonb_build_object('status',r.status,'payment',p.id,'amount_paid',p_amount));
 return outcome;
end $$;
