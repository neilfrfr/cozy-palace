-- FR05/AT03: a guest without an account looks up one booking with first name, last name and reference.
-- Only the app server calls this (it passes the visitor's IP). The reference alone reveals nothing, and
-- the answer leaves out contact details. Signed-in customers use My Reservations instead.
create table private.guest_lookup_attempts(ip text not null, at timestamptz not null default now());
create index guest_lookup_attempt_ip on private.guest_lookup_attempts(ip,at);

create function private.find_guest_booking(p_first text,p_last text,p_reference text,p_ip text) returns jsonb language plpgsql security definer set search_path='' as $$
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
  'stay',(select jsonb_build_object('room',t.name||' · Room '||rm.room_number,'check_in',b.check_in,'check_out',b.check_out)
   from public.room_bookings b join public.rooms rm on rm.id=b.room_id join public.room_types t on t.id=rm.room_type_id where b.reservation_id=r.id),
  'table',(select jsonb_build_object('table',tb.table_number,'start_at',x.start_at)
   from public.table_bookings x join public.restaurant_tables tb on tb.id=x.table_id where x.reservation_id=r.id),
  'history',(select coalesce(jsonb_agg(jsonb_build_object('action',a.action,'at',a.occurred_at) order by a.occurred_at),'[]'::jsonb)
   from public.audit_logs a where a.record_id=r.id));
end $$;
revoke execute on function private.find_guest_booking(text,text,text,text) from public,anon,authenticated;
grant execute on function private.find_guest_booking(text,text,text,text) to service_role;
create function public.find_guest_booking(p_first_name text,p_last_name text,p_reference text,p_client_ip text) returns jsonb language sql security invoker set search_path='' as $$select private.find_guest_booking(p_first_name,p_last_name,p_reference,p_client_ip)$$;
revoke execute on function public.find_guest_booking(text,text,text,text) from public,anon,authenticated;
grant execute on function public.find_guest_booking(text,text,text,text) to service_role;
