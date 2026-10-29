-- Visitors without an account hear about their booking by email only: no private link, no self-service
-- cancel or online payment. Staff and admins see and change these bookings like any other.
-- Visitors can now also book a restaurant table. Everything visitor-facing runs as service_role.
drop function public.guest_reservation(text),public.cancel_guest_booking(text),public.open_guest_payment(text);
drop function private.guest_reservation(text),private.cancel_guest_booking(text),private.open_guest_payment(text),private.guest_link(text);
alter table public.reservations drop constraint reservation_channel_owner;
alter table public.reservations drop column guest_token_hash;
alter table public.reservations add constraint reservation_channel_owner check(
 (booking_source='customer_online' and customer_id is not null and created_by=customer_id and guest_full_name is null and guest_email is null and guest_phone is null) or
 (booking_source='staff_guest' and customer_id is null and created_by is not null and guest_full_name is not null and length(btrim(guest_full_name)) between 1 and 100) or
 (booking_source='guest_online' and customer_id is null and created_by is null and guest_full_name is not null and length(btrim(guest_full_name)) between 1 and 100 and guest_email is not null and guest_phone is not null));

-- Shared checks for both visitor bookings. Contact details arrive trimmed and lower-cased.
create function private.visitor_check(p_name text,p_email text,p_phone text,p_key uuid,p_ip text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_key is null or p_ip is null or p_name is null or length(p_name) not between 1 and 100 or p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  or p_phone is null or length(p_phone) not between 1 and 32 then raise exception 'INVALID_INPUT';end if;
end $$;
create function private.visitor_rate_limit(p_ip text,p_email text) returns void language plpgsql security definer set search_path='' as $$
begin
 if (select count(*) from private.guest_booking_attempts where ip=p_ip and at>now()-interval '1 hour')>=5
  or (select count(*) from public.reservations where booking_source='guest_online' and status='pending' and guest_email=p_email and hold_expires_at>now())>=2 then raise exception 'RATE_LIMITED';end if;
 insert into private.guest_booking_attempts(ip) values(p_ip);
end $$;

create or replace function private.book_as_guest(p_room uuid,p_start date,p_end date,p_guests integer,p_name text,p_email text,p_phone text,p_key uuid,p_ip text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reservations; payload jsonb; capacity integer; price numeric(12,2);
begin
 p_name:=btrim(p_name);p_email:=lower(btrim(p_email));p_phone:=btrim(p_phone);
 perform private.visitor_check(p_name,p_email,p_phone,p_key,p_ip);
 perform pg_advisory_xact_lock(hashtextextended('guest'||p_key::text,0));
 payload:=jsonb_build_object('room',p_room,'start',p_start,'end',p_end,'guests',p_guests,'name',p_name,'email',p_email,'phone',p_phone);
 select * into r from public.reservations where booking_source='guest_online' and idempotency_key=p_key;
 if found then
  if r.original_request<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('id',r.id,'reference',r.reference);
 end if;
 if p_start is null or p_end is null or p_guests is null or p_guests not between 1 and 20 or p_end<=p_start or p_end-p_start>365
  or p_start<=(now() at time zone 'Asia/Manila')::date then raise exception 'INVALID_INPUT';end if;
 perform private.visitor_rate_limit(p_ip,p_email);
 perform 1 from public.rooms where id=p_room for update;
 with expired as (
  update public.reservations x set status='expired',version=x.version+1 where x.status='pending' and x.hold_expires_at<=now() and exists(select 1 from public.room_bookings b where b.reservation_id=x.id and b.room_id=p_room) returning x.id
 ), released as (
  update public.room_bookings set blocks_inventory=false where reservation_id in(select id from expired) returning reservation_id
 ) insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id) select null,'System','system','hold_expired',reservation_id from released;
 select t.capacity,t.nightly_rate into capacity,price from public.rooms rm join public.room_types t on t.id=rm.room_type_id where rm.id=p_room and rm.operational_state='available';
 if not found then raise exception 'RESOURCE_UNAVAILABLE';end if;
 if p_guests>capacity then raise exception 'CAPACITY_EXCEEDED';end if;
 insert into public.reservations(customer_id,booking_source,created_by,guest_full_name,guest_email,guest_phone,status,guests,total,idempotency_key,original_request,hold_expires_at)
 values(null,'guest_online',null,p_name,p_email,p_phone,'pending',p_guests,price*(p_end-p_start),p_key,payload,least(now()+interval '24 hours',p_start::timestamp at time zone 'Asia/Manila')) returning * into r;
 insert into public.room_bookings(reservation_id,room_id,check_in,check_out,rate_at_booking,blocks_inventory) values(r.id,p_room,p_start,p_end,price,true);
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,after_values)
 values(null,p_name,'guest','guest_online_created',r.id,to_jsonb(r)-'guest_email'-'guest_phone'-'original_request');
 return jsonb_build_object('id',r.id,'reference',r.reference);
exception when exclusion_violation then raise exception 'AVAILABILITY_CONFLICT' using errcode='23P01';
end $$;

-- A visitor's table request is held until staff confirm it or the seating starts, like a customer's.
create function private.book_table_as_guest(p_table uuid,p_start timestamptz,p_guests integer,p_name text,p_email text,p_phone text,p_key uuid,p_ip text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reservations; payload jsonb; cap integer;
begin
 p_name:=btrim(p_name);p_email:=lower(btrim(p_email));p_phone:=btrim(p_phone);
 perform private.visitor_check(p_name,p_email,p_phone,p_key,p_ip);
 perform pg_advisory_xact_lock(hashtextextended('guest'||p_key::text,0));
 payload:=jsonb_build_object('table',p_table,'start',p_start,'guests',p_guests,'name',p_name,'email',p_email,'phone',p_phone);
 select * into r from public.reservations where booking_source='guest_online' and idempotency_key=p_key;
 if found then
  if r.original_request<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('id',r.id,'reference',r.reference);
 end if;
 if p_start is null or p_guests is null or p_guests not between 1 and 20 or not private.dining_slot(p_start) or p_start<=now() or p_start>now()+interval '180 days' then raise exception 'INVALID_INPUT';end if;
 perform private.visitor_rate_limit(p_ip,p_email);
 perform 1 from public.restaurant_tables where id=p_table for update;
 with expired as (
  update public.reservations x set status='expired',version=x.version+1
  where x.status='pending' and x.hold_expires_at<=now() and exists(select 1 from public.table_bookings t where t.reservation_id=x.id and t.table_id=p_table)
  returning x.id
 ), released as (
  update public.table_bookings t set blocks_inventory=false where t.reservation_id in(select id from expired) returning t.reservation_id
 ) insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id) select null,'System','system','hold_expired',reservation_id from released;
 select capacity into cap from public.restaurant_tables where id=p_table and operational_state='available';
 if not found then raise exception 'RESOURCE_UNAVAILABLE';end if;
 if p_guests>cap then raise exception 'CAPACITY_EXCEEDED';end if;
 insert into public.reservations(customer_id,kind,booking_source,created_by,guest_full_name,guest_email,guest_phone,status,guests,total,idempotency_key,original_request,hold_expires_at)
 values(null,'dining','guest_online',null,p_name,p_email,p_phone,'pending',p_guests,0,p_key,payload,p_start) returning * into r;
 insert into public.table_bookings(reservation_id,table_id,start_at,end_at,blocks_inventory) values(r.id,p_table,p_start,p_start+interval '2 hours',true);
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,after_values)
 values(null,p_name,'guest','guest_online_created',r.id,to_jsonb(r)-'guest_email'-'guest_phone'-'original_request');
 return jsonb_build_object('id',r.id,'reference',r.reference);
exception when exclusion_violation then raise exception 'AVAILABILITY_CONFLICT' using errcode='23P01';
end $$;
revoke execute on function private.visitor_check(text,text,text,uuid,text),private.visitor_rate_limit(text,text),private.book_table_as_guest(uuid,timestamptz,integer,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function private.book_table_as_guest(uuid,timestamptz,integer,text,text,text,uuid,text) to service_role;
create function public.book_table_as_guest(p_table_id uuid,p_start_at timestamptz,p_guests integer,p_guest_full_name text,p_guest_email text,p_guest_phone text,p_idempotency_key uuid,p_client_ip text) returns jsonb language sql security invoker set search_path='' as $$select private.book_table_as_guest(p_table_id,p_start_at,p_guests,p_guest_full_name,p_guest_email,p_guest_phone,p_idempotency_key,p_client_ip)$$;
revoke execute on function public.book_table_as_guest(uuid,timestamptz,integer,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.book_table_as_guest(uuid,timestamptz,integer,text,text,text,uuid,text) to service_role;

-- Staff and admins correct a visitor's contact details as they do a walk-in's.
create or replace function private.guest_booking(p_id uuid,p_version integer,p_room uuid,p_start date,p_end date,p_guests integer,p_name text,p_email text,p_phone text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.reservations; previous jsonb; payload jsonb; capacity integer; price numeric(12,2); result jsonb;
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if not private.is_staff() then raise exception 'FORBIDDEN';end if;
 p_name:=btrim(p_name);p_email:=nullif(lower(btrim(p_email)),'');p_phone:=nullif(btrim(p_phone),'');
 if p_name is null or length(p_name) not between 1 and 100 or (p_email is not null and (length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')) or (p_phone is not null and length(p_phone)>32) then raise exception 'INVALID_INPUT';end if;
 if p_id is null then
  if p_key is null then raise exception 'INVALID_INPUT';end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text||p_key::text,0));
  if not private.is_staff() then raise exception 'FORBIDDEN';end if;
  payload:=jsonb_build_object('room',p_room,'start',p_start,'end',p_end,'guests',p_guests,'name',p_name,'email',p_email,'phone',p_phone);
  select * into r from public.reservations where created_by=u and booking_source='staff_guest' and idempotency_key=p_key;
  if found then
   if r.original_request<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   return to_jsonb(r);
  end if;
  if p_start is null or p_end is null or p_start<(now() at time zone 'Asia/Manila')::date or p_end<=p_start or p_end-p_start>365 or p_guests is null or p_guests not between 1 and 20 then raise exception 'INVALID_INPUT';end if;
  perform 1 from public.rooms where id=p_room for update;
  perform 1 from public.staff_roles where user_id=u and role in('staff','admin') for share;
  if not found then raise exception 'FORBIDDEN';end if;
  with expired as (
   update public.reservations x set status='expired',version=x.version+1 where x.status='pending' and x.hold_expires_at<=now() and exists(select 1 from public.room_bookings b where b.reservation_id=x.id and b.room_id=p_room) returning x.id
  ), released as (
   update public.room_bookings set blocks_inventory=false where reservation_id in(select id from expired) returning reservation_id
  ) insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id) select null,'System','system','hold_expired',reservation_id from released;
  select t.capacity,t.nightly_rate into capacity,price from public.rooms rm join public.room_types t on t.id=rm.room_type_id where rm.id=p_room and rm.operational_state='available';
  if not found then raise exception 'RESOURCE_UNAVAILABLE';end if;
  if p_guests>capacity then raise exception 'CAPACITY_EXCEEDED';end if;
  insert into public.reservations(customer_id,booking_source,created_by,guest_full_name,guest_email,guest_phone,status,guests,total,idempotency_key,original_request) values(null,'staff_guest',u,p_name,p_email,p_phone,'confirmed',p_guests,price*(p_end-p_start),p_key,payload) returning * into r;
  insert into public.room_bookings(reservation_id,room_id,check_in,check_out,rate_at_booking,blocks_inventory) values(r.id,p_room,p_start,p_end,price,true);
 else
  select * into r from public.reservations where id=p_id;
  if not found then raise exception 'NOT_FOUND';end if;
  if r.booking_source not in('staff_guest','guest_online') then raise exception 'FORBIDDEN';end if;
  -- Email is how a visitor hears about their booking, so staff can correct it but not remove it.
  if r.booking_source='guest_online' and (p_email is null or p_phone is null) then raise exception 'INVALID_INPUT';end if;
  previous:=to_jsonb(r);
  perform private.reserve('update',p_id,p_version,p_room,p_start,p_end,p_guests,null,null);
  update public.reservations set guest_full_name=p_name,guest_email=p_email,guest_phone=p_phone where id=p_id returning * into r;
 end if;
 result:=to_jsonb(r);
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,before_values,after_values)
 select u,p.full_name,s.role,case when p_id is null then 'guest_booking_created' else 'guest_details_updated' end,r.id,previous-'guest_email'-'guest_phone'-'original_request',result-'guest_email'-'guest_phone'-'original_request' from public.profiles p join public.staff_roles s on s.user_id=p.id where p.id=u;
 return result;
exception when exclusion_violation then raise exception 'AVAILABILITY_CONFLICT' using errcode='23P01';
end $$;

-- Staff can filter the queue to visitor bookings.
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
 ), paged as(select * from matching order by created_at desc,id limit 20 offset (p_page-1)*20)
 select jsonb_build_object('count',(select count(*) from matching),'rows',coalesce((select jsonb_agg((to_jsonb(p)-'original_request'-'room_id'-'check_in'-'check_out'-'rate_at_booking')||jsonb_build_object('room_bookings',jsonb_build_array(jsonb_build_object('room_id',p.room_id,'check_in',p.check_in,'check_out',p.check_out,'rate_at_booking',p.rate_at_booking))) order by p.created_at desc,p.id) from paged p),'[]'::jsonb)) into result;
 return result;
end $$;
