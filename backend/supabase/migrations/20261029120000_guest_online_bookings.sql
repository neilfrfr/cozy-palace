-- Account-free customer bookings. Guest records are written only through
-- narrow security-definer RPCs; public callers never receive table access.
alter table public.reservations alter column created_by drop not null;
alter table public.reservations drop constraint reservation_channel_owner;
alter table public.reservations add constraint reservation_channel_owner check(
 (booking_source='customer_online' and customer_id is not null and created_by=customer_id and guest_full_name is null and guest_email is null and guest_phone is null) or
 (booking_source='staff_guest' and customer_id is null and created_by is not null and guest_full_name is not null and length(btrim(guest_full_name)) between 1 and 100) or
 (booking_source='guest_online' and customer_id is null and created_by is null and guest_full_name is not null and length(btrim(guest_full_name)) between 2 and 100 and guest_email is not null and guest_phone is not null));
create unique index reservation_guest_online_request on public.reservations(idempotency_key) where booking_source='guest_online';
create index reservation_guest_email_created on public.reservations(guest_email,created_at desc) where booking_source='guest_online';

create function private.valid_public_guest_phone(p_phone text) returns boolean
language sql immutable set search_path='' as $$
 select p_phone ~ '^\+639[0-9]{9}$'
     or p_phone ~ '^\+65[689][0-9]{7}$'
     or p_phone ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'
     or p_phone ~ '^\+44[1237][0-9]{9}$'
     or p_phone ~ '^\+61[23478][0-9]{8}$'
     or p_phone ~ '^\+91[6-9][0-9]{9}$'
$$;
revoke execute on function private.valid_public_guest_phone(text) from public,anon,authenticated;

create function public.create_guest_room_booking(
 p_room_id uuid,p_check_in date,p_check_out date,p_guests integer,
 p_guest_full_name text,p_guest_email text,p_guest_phone text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reservations; cap integer; price numeric(12,2); payload jsonb; result jsonb;
begin
 p_guest_full_name:=btrim(p_guest_full_name);
 p_guest_email:=lower(btrim(p_guest_email));
 p_guest_phone:=btrim(p_guest_phone);
 if auth.uid() is not null or p_idempotency_key is null or p_guest_full_name is null or length(p_guest_full_name) not between 2 and 100 or p_guest_email is null or length(p_guest_email)>254 or p_guest_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or p_guest_phone is null or not private.valid_public_guest_phone(p_guest_phone) then raise exception 'INVALID_INPUT';end if;
 if p_check_in is null or p_check_out is null or p_check_in<=(now() at time zone 'Asia/Manila')::date or p_check_out<=p_check_in or p_check_out-p_check_in>365 or p_guests is null or p_guests not between 1 and 20 then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
 payload:=jsonb_build_object('room',p_room_id,'start',p_check_in,'end',p_check_out,'guests',p_guests,'name',p_guest_full_name,'email',p_guest_email,'phone',p_guest_phone);
 select * into r from public.reservations where booking_source='guest_online' and idempotency_key=p_idempotency_key;
 if found then
  if r.original_request<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('id',r.id,'reference',r.reference,'status',r.status);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_guest_email,0));
 if (select count(*) from public.reservations where booking_source='guest_online' and guest_email=p_guest_email and created_at>now()-interval '1 hour')>=3 then raise exception 'RATE_LIMITED';end if;
 perform 1 from public.rooms where id=p_room_id for update;
 with expired as (
   update public.reservations x set status='expired',version=x.version+1
   where x.status='pending' and x.hold_expires_at<=now()
    and exists(select 1 from public.room_bookings b where b.reservation_id=x.id and b.room_id=p_room_id)
   returning x.id
 ), released as (
   update public.room_bookings b set blocks_inventory=false where b.reservation_id in(select id from expired) returning b.reservation_id
 ) insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id)
   select null,'System','system','hold_expired',reservation_id from released;
 select t.capacity,t.nightly_rate into cap,price from public.rooms rm join public.room_types t on t.id=rm.room_type_id where rm.id=p_room_id and rm.operational_state='available';
 if not found then raise exception 'RESOURCE_UNAVAILABLE';end if;
 if p_guests>cap then raise exception 'CAPACITY_EXCEEDED';end if;
 insert into public.reservations(customer_id,kind,booking_source,created_by,guest_full_name,guest_email,guest_phone,status,guests,total,idempotency_key,original_request,hold_expires_at)
 values(null,'hotel','guest_online',null,p_guest_full_name,p_guest_email,p_guest_phone,'pending',p_guests,price*(p_check_out-p_check_in),p_idempotency_key,payload,least(now()+interval '24 hours',p_check_in::timestamp at time zone 'Asia/Manila')) returning * into r;
 insert into public.room_bookings(reservation_id,room_id,check_in,check_out,rate_at_booking,blocks_inventory)
 values(r.id,p_room_id,p_check_in,p_check_out,price,true);
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,after_values)
 values(null,'Guest','guest','guest_booking_created',r.id,jsonb_build_object('kind','hotel','reference',r.reference,'status',r.status));
 return jsonb_build_object('id',r.id,'reference',r.reference,'status',r.status);
exception when exclusion_violation then raise exception 'AVAILABILITY_CONFLICT' using errcode='23P01';
end $$;
revoke execute on function public.create_guest_room_booking(uuid,date,date,integer,text,text,text,uuid) from public,authenticated;
grant execute on function public.create_guest_room_booking(uuid,date,date,integer,text,text,text,uuid) to anon;

create function public.create_guest_table_booking(
 p_table_id uuid,p_start_at timestamptz,p_guests integer,
 p_guest_full_name text,p_guest_email text,p_guest_phone text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reservations; cap integer; payload jsonb;
begin
 p_guest_full_name:=btrim(p_guest_full_name);p_guest_email:=lower(btrim(p_guest_email));p_guest_phone:=btrim(p_guest_phone);
 if auth.uid() is not null or p_idempotency_key is null or p_guest_full_name is null or length(p_guest_full_name) not between 2 and 100 or p_guest_email is null or length(p_guest_email)>254 or p_guest_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or p_guest_phone is null or not private.valid_public_guest_phone(p_guest_phone) then raise exception 'INVALID_INPUT';end if;
 if p_start_at is null or p_guests is null or p_guests not between 1 and 20 or not private.dining_slot(p_start_at) or p_start_at<=now() or p_start_at>now()+interval '180 days' then raise exception 'INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
 payload:=jsonb_build_object('table',p_table_id,'start',p_start_at,'guests',p_guests,'name',p_guest_full_name,'email',p_guest_email,'phone',p_guest_phone);
 select * into r from public.reservations where booking_source='guest_online' and idempotency_key=p_idempotency_key;
 if found then
  if r.original_request<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('id',r.id,'reference',r.reference,'status',r.status);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_guest_email,0));
 if (select count(*) from public.reservations where booking_source='guest_online' and guest_email=p_guest_email and created_at>now()-interval '1 hour')>=3 then raise exception 'RATE_LIMITED';end if;
 perform 1 from public.restaurant_tables where id=p_table_id for update;
 with expired as (
   update public.reservations x set status='expired',version=x.version+1
   where x.status='pending' and x.hold_expires_at<=now()
    and exists(select 1 from public.table_bookings b where b.reservation_id=x.id and b.table_id=p_table_id)
   returning x.id
 ), released as (
   update public.table_bookings b set blocks_inventory=false where b.reservation_id in(select id from expired) returning b.reservation_id
 ) insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id)
   select null,'System','system','hold_expired',reservation_id from released;
 select capacity into cap from public.restaurant_tables where id=p_table_id and operational_state='available';
 if not found then raise exception 'RESOURCE_UNAVAILABLE';end if;
 if p_guests>cap then raise exception 'CAPACITY_EXCEEDED';end if;
 insert into public.reservations(customer_id,kind,booking_source,created_by,guest_full_name,guest_email,guest_phone,status,guests,total,idempotency_key,original_request,hold_expires_at)
 values(null,'dining','guest_online',null,p_guest_full_name,p_guest_email,p_guest_phone,'pending',p_guests,0,p_idempotency_key,payload,p_start_at) returning * into r;
 insert into public.table_bookings(reservation_id,table_id,start_at,end_at,blocks_inventory)
 values(r.id,p_table_id,p_start_at,p_start_at+interval '2 hours',true);
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,after_values)
 values(null,'Guest','guest','table_guest_booking_created',r.id,jsonb_build_object('kind','dining','reference',r.reference,'status',r.status));
 return jsonb_build_object('id',r.id,'reference',r.reference,'status',r.status);
exception when exclusion_violation then raise exception 'AVAILABILITY_CONFLICT' using errcode='23P01';
end $$;
revoke execute on function public.create_guest_table_booking(uuid,timestamptz,integer,text,text,text,uuid) from public,authenticated;
grant execute on function public.create_guest_table_booking(uuid,timestamptz,integer,text,text,text,uuid) to anon;

-- Lookup requires the full name and high-entropy confirmation reference, and
-- returns only itinerary details. Contact data and internal ids stay private.
create function public.find_guest_booking(p_first_name text,p_last_name text,p_reference text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.reservations; full_parts text[]; details jsonb;
begin
 p_first_name:=lower(btrim(p_first_name));p_last_name:=lower(btrim(p_last_name));p_reference:=upper(btrim(p_reference));
 if p_first_name is null or p_last_name is null or p_reference is null or length(p_first_name) not between 1 and 60 or length(p_last_name) not between 1 and 60 or p_reference !~ '^CP-[A-F0-9]{12}$' then return null;end if;
 select * into r from public.reservations where reference=p_reference and booking_source='guest_online';
 if not found then return null;end if;
 full_parts:=regexp_split_to_array(lower(btrim(r.guest_full_name)),'\s+');
 if full_parts[1]<>p_first_name or full_parts[array_length(full_parts,1)]<>p_last_name then return null;end if;
 if r.kind='hotel' then
  select jsonb_build_object('checkIn',b.check_in,'checkOut',b.check_out,'room',rm.room_number) into details
  from public.room_bookings b join public.rooms rm on rm.id=b.room_id where b.reservation_id=r.id;
 else
  select jsonb_build_object('date',to_char(b.start_at at time zone 'Asia/Manila','YYYY-MM-DD'),'time',to_char(b.start_at at time zone 'Asia/Manila','HH12:MI AM'),'table',t.table_number) into details
  from public.table_bookings b join public.restaurant_tables t on t.id=b.table_id where b.reservation_id=r.id;
 end if;
 return jsonb_build_object('reference',r.reference,'kind',r.kind,'status',r.status,'guestName',r.guest_full_name,'guests',r.guests,'total',r.total,'currency',r.currency,'details',details);
end $$;
revoke execute on function public.find_guest_booking(text,text,text) from public;
grant execute on function public.find_guest_booking(text,text,text) to anon,authenticated;

-- Make the new source available in the staff queue filters.
create or replace function public.operational_queue(p_query text,p_date date,p_status text,p_source text,p_page integer,p_staying boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 if not private.is_staff() then raise exception 'FORBIDDEN';end if;
 if p_query is null or length(p_query)>100 or p_page is null or p_page not between 1 and 10000 or p_staying is null or (p_status is not null and p_status not in('pending','confirmed','checked_in','completed','cancelled','expired')) or (p_source is not null and p_source not in('customer_online','staff_guest','guest_online')) then raise exception 'INVALID_INPUT';end if;
 with matching as (
  select r.*,c.full_name customer_name,a.full_name creator_name,b.room_id,b.check_in,b.check_out,b.rate_at_booking,rm.room_number,t.name room_type_name
  from public.reservations r join public.room_bookings b on b.reservation_id=r.id join public.rooms rm on rm.id=b.room_id join public.room_types t on t.id=rm.room_type_id left join public.profiles c on c.id=r.customer_id left join public.profiles a on a.id=r.created_by
  where r.kind='hotel' and r.status<>'draft' and (p_status is null or r.status=p_status) and (p_source is null or r.booking_source=p_source)
   and (p_date is null or (not p_staying and b.check_in=p_date) or (p_staying and b.check_in<=p_date and b.check_out>p_date))
   and (p_query='' or position(lower(p_query) in lower(r.reference))>0 or position(lower(p_query) in lower(coalesce(r.guest_full_name,c.full_name,'')))>0)
 ), paged as (select * from matching order by created_at desc,id limit 20 offset (p_page-1)*20)
 select jsonb_build_object('count',(select count(*) from matching),'rows',coalesce((select jsonb_agg((to_jsonb(p)-'original_request'-'room_id'-'check_in'-'check_out'-'rate_at_booking')||jsonb_build_object('room_bookings',jsonb_build_array(jsonb_build_object('room_id',p.room_id,'check_in',p.check_in,'check_out',p.check_out,'rate_at_booking',p.rate_at_booking))) order by p.created_at desc,p.id) from paged p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke execute on function public.operational_queue(text,date,text,text,integer,boolean) from public,anon;
grant execute on function public.operational_queue(text,date,text,text,integer,boolean) to authenticated;
