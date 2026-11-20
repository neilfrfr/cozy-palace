-- FR08 payment ledger. Staff record money taken at the desk (whole or a deposit) and accept review payments.
-- A null method means the payment came through Xendit.
alter table public.payments
 add column method text check(method in('cash','gcash','maya','card','bank_transfer')),
 add column payment_reference text check(length(payment_reference) between 1 and 100),
 add column recorded_by uuid references public.profiles(id),
 add column verified_by uuid references public.profiles(id),
 add column verified_at timestamptz;

-- What is still owed on a booking: total minus accepted payments.
create function private.booking_balance(r public.reservations) returns numeric language sql stable security definer set search_path='' as $$
 select r.total-coalesce((select sum(amount_paid) from public.payments where reservation_id=r.id and status='paid'),0)
$$;
revoke execute on function private.booking_balance(public.reservations) from public,anon,authenticated;

-- Bookings still going ahead can take money; an expired hold cannot.
create function private.takes_payment(r public.reservations) returns boolean language sql stable security definer set search_path='' as $$
 select r.kind='hotel' and (r.status in('confirmed','checked_in') or (r.status='pending' and r.hold_expires_at>now()))
$$;
revoke execute on function private.takes_payment(public.reservations) from public,anon,authenticated;

create function private.record_desk_payment(p_reservation uuid,p_amount numeric,p_method text,p_reference text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.reservations; p public.payments; ref text:=nullif(btrim(p_reference),'');
begin
 if not private.is_staff() then raise exception 'FORBIDDEN';end if;
 if p_reservation is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2)
  or p_method is null or p_method not in('cash','gcash','maya','card','bank_transfer') or length(ref)>100 then raise exception 'INVALID_INPUT';end if;
 select * into r from public.reservations where id=p_reservation for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if not private.takes_payment(r) then raise exception 'INVALID_TRANSITION';end if;
 if p_amount>private.booking_balance(r) then raise exception 'INVALID_AMOUNT';end if;
 insert into public.payments(reservation_id,amount,method,payment_reference,recorded_by)
  values(r.id,p_amount,p_method,ref,u) returning * into p;
 -- Insert then update, so notify_payment emails the guest as it does for Xendit payments.
 update public.payments set status='paid',amount_paid=p_amount,paid_at=now() where id=p.id returning * into p;
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,before_values,after_values)
 select u,pr.full_name,coalesce(s.role,'customer'),'payment_recorded',r.id,jsonb_build_object('status',r.status),
  jsonb_build_object('payment',p.id,'amount_paid',p_amount,'method',p_method,'reference',ref)
 from public.profiles pr left join public.staff_roles s on s.user_id=pr.id where pr.id=u;
 return to_jsonb(p);
end $$;
revoke execute on function private.record_desk_payment(uuid,numeric,text,text) from public,anon;
grant execute on function private.record_desk_payment(uuid,numeric,text,text) to authenticated;
create function public.record_desk_payment(p_reservation_id uuid,p_amount numeric,p_method text,p_reference text) returns jsonb language sql security invoker set search_path='' as $$select private.record_desk_payment(p_reservation_id,p_amount,p_method,p_reference)$$;
revoke execute on function public.record_desk_payment(uuid,numeric,text,text) from public,anon;
grant execute on function public.record_desk_payment(uuid,numeric,text,text) to authenticated;

-- A review payment (wrong amount, or a second payment) counts once staff accept it. One that would pay more
-- than is owed, or that already has a refund, must be refunded instead.
create function private.verify_payment(p_payment uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); p public.payments; r public.reservations;
begin
 if not private.is_staff() then raise exception 'FORBIDDEN';end if;
 if p_payment is null then raise exception 'INVALID_INPUT';end if;
 select * into p from public.payments where id=p_payment for update;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into r from public.reservations where id=p.reservation_id for update;
 if p.status<>'review' or not private.takes_payment(r) or exists(select 1 from public.refunds where payment_id=p.id)
  then raise exception 'INVALID_TRANSITION';end if;
 if p.amount_paid>private.booking_balance(r) then raise exception 'INVALID_AMOUNT';end if;
 update public.payments set status='paid',verified_by=u,verified_at=now() where id=p.id returning * into p;
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,before_values,after_values)
 select u,pr.full_name,coalesce(s.role,'customer'),'payment_verified',r.id,jsonb_build_object('payment',p.id,'status','review'),
  jsonb_build_object('payment',p.id,'status','paid','amount_paid',p.amount_paid)
 from public.profiles pr left join public.staff_roles s on s.user_id=pr.id where pr.id=u;
 return to_jsonb(p);
end $$;
revoke execute on function private.verify_payment(uuid) from public,anon;
grant execute on function private.verify_payment(uuid) to authenticated;
create function public.verify_payment(p_payment_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.verify_payment(p_payment_id)$$;
revoke execute on function public.verify_payment(uuid) from public,anon;
grant execute on function public.verify_payment(uuid) to authenticated;
