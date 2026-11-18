-- Visitors without an account can pay online again. They prove the booking is theirs the same way
-- Find a Reservation does (name + booking number, rate-limited per IP); payment rules match private.open_payment.
create function private.guest_payable(r public.reservations) returns boolean language sql stable security definer set search_path='' as $$
 select r.kind='hotel' and (r.status='confirmed' or (r.status='pending' and r.hold_expires_at>now())) and r.total>0
  and not exists(select 1 from public.payments x where x.reservation_id=r.id and x.status='paid')
$$;
revoke execute on function private.guest_payable(public.reservations) from public,anon,authenticated;
grant execute on function private.guest_payable(public.reservations) to service_role;

create or replace function private.find_guest_booking(p_first text,p_last text,p_reference text,p_ip text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reservations; stored text;
 first text:=lower(regexp_replace(btrim(p_first),'\s+',' ','g')); last text:=lower(regexp_replace(btrim(p_last),'\s+',' ','g'));
begin
 if nullif(p_ip,'') is null or coalesce(first,'')='' or coalesce(last,'')='' or length(first)>50 or length(last)>50
  or length(p_reference)>20 then raise exception 'INVALID_INPUT';end if;
 if (select count(*) from private.guest_lookup_attempts where ip=p_ip and at>now()-interval '1 hour')>=10 then raise exception 'RATE_LIMITED';end if;
 insert into private.guest_lookup_attempts(ip) values(p_ip);
 select * into r from public.reservations where reference=upper(btrim(p_reference)) and booking_source in('guest_online','staff_guest');
 if not found then return null;end if;
 -- The form stored one full name: first name must start it and last name end it; middle names may sit between.
 stored:=lower(regexp_replace(btrim(r.guest_full_name),'\s+',' ','g'));
 if not (stored=first||' '||last or (left(stored,length(first)+1)=first||' ' and right(stored,length(last)+1)=' '||last)) then return null;end if;
 return jsonb_build_object('reference',r.reference,'kind',r.kind,'status',r.status,'guests',r.guests,'total',r.total,'created_at',r.created_at,
  'payable',private.guest_payable(r),
  'stay',(select jsonb_build_object('room',t.name||' · Room '||rm.room_number,'check_in',b.check_in,'check_out',b.check_out)
   from public.room_bookings b join public.rooms rm on rm.id=b.room_id join public.room_types t on t.id=rm.room_type_id where b.reservation_id=r.id),
  'table',(select jsonb_build_object('table',tb.table_number,'start_at',x.start_at)
   from public.table_bookings x join public.restaurant_tables tb on tb.id=x.table_id where x.reservation_id=r.id),
  'history',(select coalesce(jsonb_agg(jsonb_build_object('action',a.action,'at',a.occurred_at) order by a.occurred_at),'[]'::jsonb)
   from public.audit_logs a where a.record_id=r.id));
end $$;

create function private.open_guest_payment(p_first text,p_last text,p_reference text,p_ip text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reservations; p public.payments;
begin
 -- Same matching and rate limit as the lookup; a miss reads as not found.
 if private.find_guest_booking(p_first,p_last,p_reference,p_ip) is null then raise exception 'NOT_FOUND';end if;
 select * into r from public.reservations where reference=upper(btrim(p_reference)) and booking_source in('guest_online','staff_guest') for update;
 if not private.guest_payable(r) then raise exception 'INVALID_TRANSITION';end if;
 select * into p from public.payments where reservation_id=r.id and status='open' and amount=r.total
  and checkout_expires_at>now()+interval '10 minutes' order by created_at desc limit 1;
 if not found then
  insert into public.payments(reservation_id,amount) values(r.id,r.total) returning * into p;
 end if;
 return jsonb_build_object('id',p.id,'amount',p.amount,'reference',r.reference,'checkout_url',p.checkout_url);
end $$;
revoke execute on function private.open_guest_payment(text,text,text,text) from public,anon,authenticated;
grant execute on function private.open_guest_payment(text,text,text,text) to service_role;
create function public.open_guest_payment(p_first_name text,p_last_name text,p_reference text,p_client_ip text) returns jsonb language sql security invoker set search_path='' as $$select private.open_guest_payment(p_first_name,p_last_name,p_reference,p_client_ip)$$;
revoke execute on function public.open_guest_payment(text,text,text,text) from public,anon,authenticated;
grant execute on function public.open_guest_payment(text,text,text,text) to service_role;
