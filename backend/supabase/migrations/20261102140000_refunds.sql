-- FR08 refunds. Staff send the refund from the Xendit dashboard, then record it here; this database never moves money.
alter table public.payments drop constraint payments_status_check;
alter table public.payments add constraint payments_status_check check(status in('open','paid','review','refunded'));
alter table public.payments
 add column refunded_at timestamptz,
 add column refunded_by uuid references public.profiles(id),
 add column refund_reference text check(length(refund_reference) between 1 and 200);

-- Money that confirmed a live stay ('paid' on a booking still going ahead) is never refundable here: cancel the booking first.
create function private.mark_payment_refunded(p_payment uuid,p_reference text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); p public.payments; r public.reservations; ref text:=btrim(p_reference); was text;
begin
 if not private.is_staff() then raise exception 'FORBIDDEN';end if;
 if p_payment is null or ref is null or length(ref) not between 1 and 200 then raise exception 'INVALID_INPUT';end if;
 select * into p from public.payments where id=p_payment for update;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into r from public.reservations where id=p.reservation_id;
 if not (p.status='review' or (p.status='paid' and r.status in('cancelled','expired'))) then raise exception 'INVALID_TRANSITION';end if;
 was:=p.status;
 update public.payments set status='refunded',refunded_at=now(),refunded_by=u,refund_reference=ref where id=p.id returning * into p;
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,before_values,after_values)
 select u,pr.full_name,coalesce(s.role,'customer'),'payment_refunded',r.id,
  jsonb_build_object('payment',p.id,'status',was),
  jsonb_build_object('payment',p.id,'status','refunded','amount_paid',p.amount_paid,'refund_reference',ref)
 from public.profiles pr left join public.staff_roles s on s.user_id=pr.id where pr.id=u;
 return to_jsonb(p);
end $$;
revoke execute on function private.mark_payment_refunded(uuid,text) from public,anon;
grant execute on function private.mark_payment_refunded(uuid,text) to authenticated;
create function public.mark_payment_refunded(p_payment_id uuid,p_reference text) returns jsonb language sql security invoker set search_path='' as $$select private.mark_payment_refunded(p_payment_id,p_reference)$$;
revoke execute on function public.mark_payment_refunded(uuid,text) from public,anon;
grant execute on function public.mark_payment_refunded(uuid,text) to authenticated;
