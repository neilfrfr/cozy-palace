-- Guests may cancel online until 23:59 Manila two days before the stay or seating; from the day before, only staff can.
-- Signed-in customers can now cancel their own pending or confirmed room bookings, as they already could tables.
-- Keep in step with guestCanCancel in frontend/lib/operations/schema.ts.
create function private.guest_can_cancel(p_date date) returns boolean language sql stable set search_path='' as $$
 select p_date-(now() at time zone 'Asia/Manila')::date>=2
$$;
revoke execute on function private.guest_can_cancel(date) from public,anon;
grant execute on function private.guest_can_cancel(date) to authenticated;

create or replace function private.reserve(p_op text,p_id uuid,p_version integer,p_room uuid,p_start date,p_end date,p_guests integer,p_key uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.reservations; old_r jsonb; allocation public.room_bookings;
 capacity integer; price numeric(12,2); payload jsonb; target text; result jsonb;
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if p_op='create' then
  if private.is_staff() then raise exception 'FORBIDDEN';end if;
  if p_key is null then raise exception 'INVALID_INPUT';end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text||p_key::text,0));
  payload:=jsonb_build_object('room',p_room,'start',p_start,'end',p_end,'guests',p_guests);
  select * into r from public.reservations where customer_id=u and idempotency_key=p_key;
  if found then
   if r.original_request<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   return to_jsonb(r);
  end if;
 else
  select * into r from public.reservations where id=p_id;
  if not found then raise exception 'NOT_FOUND';end if;
  if not private.is_staff() and (r.customer_id is distinct from u or r.booking_source<>'customer_online') then raise exception 'FORBIDDEN';end if;
  if private.is_staff() and (r.status='draft' or p_op in('submit','delete')) then raise exception 'FORBIDDEN';end if;
  if p_version is null or r.version<>p_version then raise exception 'VERSION_CONFLICT';end if;
  old_r:=to_jsonb(r);
  select * into allocation from public.room_bookings where reservation_id=r.id;
  if p_op in('submit','transition','delete') then
   p_room:=allocation.room_id;p_start:=allocation.check_in;p_end:=allocation.check_out;p_guests:=r.guests;
  end if;
 end if;
 -- Lock all affected resources before locking reservation rows, including deletion.
 -- A concurrently changed allocation increments version; re-read and reject it after locks.
 perform 1 from public.rooms where id in(p_room,allocation.room_id) order by id for update;
 if private.is_staff() then
  perform 1 from public.staff_roles where user_id=u and role in('staff','admin') for share;
  if not found then raise exception 'FORBIDDEN';end if;
 end if;
 if p_op<>'create' then
  select * into r from public.reservations where id=p_id for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if not private.is_staff() and (r.customer_id is distinct from u or r.booking_source<>'customer_online') then raise exception 'FORBIDDEN';end if;
  if private.is_staff() and (r.status='draft' or p_op in('submit','delete')) then raise exception 'FORBIDDEN';end if;
  if p_version is null or r.version<>p_version then raise exception 'VERSION_CONFLICT';end if;
  old_r:=to_jsonb(r);
 end if;
 if p_op in('create','update','submit','transition') then
  if p_start is null or p_end is null or p_guests is null or p_guests<1 or p_guests>20 or p_end<=p_start or p_end-p_start>365 then raise exception 'INVALID_INPUT';end if;
  -- Reconcile stale holds under the resource locks; do not treat background cleanup as an employee action.
  with expired as (
   update public.reservations x set status='expired',version=x.version+1
   where x.status='pending' and x.hold_expires_at<=now() and x.id is distinct from p_id
    and exists(select 1 from public.room_bookings b where b.reservation_id=x.id and b.room_id=p_room)
   returning x.id
  ), released as (
   update public.room_bookings b set blocks_inventory=false where b.reservation_id in(select id from expired) returning b.reservation_id
  ) insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id)
   select null,'System','system','hold_expired',reservation_id from released;
  if p_op<>'create' and r.status='pending' and r.hold_expires_at<=now() and not (p_op='transition' and p_status in('expired','cancelled')) then raise exception 'INVALID_TRANSITION';end if;
  select t.capacity,t.nightly_rate into capacity,price from public.rooms rm join public.room_types t on rm.room_type_id=t.id where rm.id=p_room and rm.operational_state='available';
  if not found then raise exception 'RESOURCE_UNAVAILABLE';end if;
  if p_guests>capacity then raise exception 'CAPACITY_EXCEEDED';end if;
 end if;
 if p_op='create' then
  if p_start<=(now() at time zone 'Asia/Manila')::date then raise exception 'INVALID_INPUT';end if;
  insert into public.reservations(customer_id,guests,total,idempotency_key,original_request) values(u,p_guests,price*(p_end-p_start),p_key,payload) returning * into r;
  insert into public.room_bookings(reservation_id,room_id,check_in,check_out,rate_at_booking) values(r.id,p_room,p_start,p_end,price);
 elsif p_op='update' then
  if r.status not in('draft','pending','confirmed') then raise exception 'INVALID_TRANSITION';end if;
  if (private.is_staff() and p_start<(now() at time zone 'Asia/Manila')::date) or (not private.is_staff() and p_start<=(now() at time zone 'Asia/Manila')::date) then raise exception 'INVALID_INPUT';end if;
  if r.customer_id=u and r.status<>'draft' and allocation.check_in<=(now() at time zone 'Asia/Manila')::date then raise exception 'POLICY_RESTRICTED';end if;
  -- Preserve the agreed rate when editing the same resource; new room uses its current rate.
  if allocation.room_id=p_room then price:=allocation.rate_at_booking;end if;
  update public.room_bookings set room_id=p_room,check_in=p_start,check_out=p_end,rate_at_booking=price where reservation_id=r.id;
  update public.reservations set guests=p_guests,total=price*(p_end-p_start),version=version+1,hold_expires_at=case when status='pending' then p_start::timestamp at time zone 'Asia/Manila' else hold_expires_at end where id=r.id returning * into r;
 elsif p_op='submit' then
  if r.status<>'draft' then raise exception 'INVALID_TRANSITION';end if;
  if p_start<=(now() at time zone 'Asia/Manila')::date then raise exception 'INVALID_INPUT';end if;
  update public.room_bookings set blocks_inventory=true where reservation_id=r.id;
  update public.reservations set status='pending',version=version+1,hold_expires_at=p_start::timestamp at time zone 'Asia/Manila' where id=r.id returning * into r;
 elsif p_op='transition' then
  -- Customers may only cancel their own active booking, and only before the cutoff.
  if not private.is_staff() then
   if p_status is distinct from 'cancelled' or r.status not in('pending','confirmed') then raise exception 'FORBIDDEN';end if;
   if not private.guest_can_cancel(allocation.check_in) then raise exception 'CANCEL_CUTOFF';end if;
  end if;
  target:=p_status;
  if target='checked_in' and not ((now() at time zone 'Asia/Manila')::date>=allocation.check_in and (now() at time zone 'Asia/Manila')::date<allocation.check_out) then raise exception 'POLICY_RESTRICTED';end if;
  if not ((r.status='pending' and target in('confirmed','cancelled','expired')) or (r.status='confirmed' and target in('checked_in','cancelled')) or (r.status='checked_in' and target='completed')) then raise exception 'INVALID_TRANSITION';end if;
  if target='expired' and r.hold_expires_at>now() then raise exception 'POLICY_RESTRICTED';end if;
  update public.room_bookings set blocks_inventory=target in('pending','confirmed','checked_in') where reservation_id=r.id;
  update public.reservations set status=target,version=version+1,hold_expires_at=case when target='pending' then hold_expires_at else null end where id=r.id returning * into r;
 elsif p_op='delete' then
  if r.status<>'draft' then raise exception 'INVALID_TRANSITION';end if;
  delete from public.reservations where id=r.id;
 else raise exception 'INVALID_INPUT';end if;
 result:=to_jsonb(r);
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,before_values,after_values)
 select u,p.full_name,coalesce(s.role,'customer'),case when p_op='transition' then p_status else p_op end,r.id,old_r-'guest_email'-'guest_phone'-'original_request',case when p_op='delete' then null else result-'guest_email'-'guest_phone'-'original_request' end from public.profiles p left join public.staff_roles s on s.user_id=p.id where p.id=u;
 return result;
exception when exclusion_violation then raise exception 'AVAILABILITY_CONFLICT' using errcode='23P01';
end $$;
create or replace function private.dining(p_op text,p_id uuid,p_version integer,p_table uuid,p_start timestamptz,p_guests integer,p_name text,p_email text,p_phone text,p_key uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); staff boolean:=private.is_staff(); r public.reservations; b public.table_bookings; old_r jsonb; payload jsonb; cap integer; result jsonb;
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if p_op='create' then
  if p_key is null then raise exception 'INVALID_INPUT';end if;
  if staff then
   p_name:=btrim(p_name);p_email:=nullif(lower(btrim(p_email)),'');p_phone:=nullif(btrim(p_phone),'');
   if p_name is null or length(p_name) not between 1 and 100 or (p_email is not null and (length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')) or (p_phone is not null and length(p_phone)>32) then raise exception 'INVALID_INPUT';end if;
  elsif p_name is not null or p_email is not null or p_phone is not null then raise exception 'INVALID_INPUT';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text||p_key::text,0));
  payload:=jsonb_build_object('table',p_table,'start',p_start,'guests',p_guests,'name',p_name,'email',p_email,'phone',p_phone);
  select * into r from public.reservations where created_by=u and idempotency_key=p_key;
  if found then
   if r.original_request<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   return to_jsonb(r);
  end if;
  if p_start is null or p_guests is null or p_guests not between 1 and 20 or not private.dining_slot(p_start) or p_start>now()+interval '180 days' then raise exception 'INVALID_INPUT';end if;
  -- Guests book ahead; staff may seat a walk-in into a seating already under way.
  if (not staff and p_start<=now()) or (staff and p_start+interval '2 hours'<=now()) then raise exception 'INVALID_INPUT';end if;
 else
  select * into r from public.reservations where id=p_id;
  if not found or r.kind<>'dining' then raise exception 'NOT_FOUND';end if;
  select * into b from public.table_bookings where reservation_id=r.id;
  p_table:=b.table_id;
 end if;
 -- Lock the table before the reservation row, as private.reserve does for rooms.
 perform 1 from public.restaurant_tables where id=p_table for update;
 if staff then
  perform 1 from public.staff_roles where user_id=u and role in('staff','admin') for share;
  if not found then raise exception 'FORBIDDEN';end if;
 end if;
 if p_op<>'create' then
  select * into r from public.reservations where id=p_id for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if not staff and (r.customer_id is distinct from u or r.booking_source<>'customer_online') then raise exception 'FORBIDDEN';end if;
  if p_version is null or r.version<>p_version then raise exception 'VERSION_CONFLICT';end if;
  old_r:=to_jsonb(r);
 end if;
 -- Release lapsed holds on this table so the exclusion constraint only sees live bookings.
 with expired as (
  update public.reservations x set status='expired',version=x.version+1
  where x.status='pending' and x.hold_expires_at<=now() and x.id is distinct from p_id
   and exists(select 1 from public.table_bookings t where t.reservation_id=x.id and t.table_id=p_table)
  returning x.id
 ), released as (
  update public.table_bookings t set blocks_inventory=false where t.reservation_id in(select id from expired) returning t.reservation_id
 ) insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id)
  select null,'System','system','hold_expired',reservation_id from released;
 if p_op='create' then
  select capacity into cap from public.restaurant_tables where id=p_table and operational_state='available';
  if not found then raise exception 'RESOURCE_UNAVAILABLE';end if;
  if p_guests>cap then raise exception 'CAPACITY_EXCEEDED';end if;
  if staff then
   insert into public.reservations(customer_id,kind,booking_source,created_by,guest_full_name,guest_email,guest_phone,status,guests,total,idempotency_key,original_request)
   values(null,'dining','staff_guest',u,p_name,p_email,p_phone,'confirmed',p_guests,0,p_key,payload) returning * into r;
  else
   -- Guest requests hold the table until staff confirm or the seating starts.
   insert into public.reservations(customer_id,kind,status,guests,total,idempotency_key,original_request,hold_expires_at)
   values(u,'dining','pending',p_guests,0,p_key,payload,p_start) returning * into r;
  end if;
  insert into public.table_bookings(reservation_id,table_id,start_at,end_at,blocks_inventory) values(r.id,p_table,p_start,p_start+interval '2 hours',true);
 elsif p_op='cancel' then
  if staff then raise exception 'FORBIDDEN';end if;
  if r.status not in('pending','confirmed') or b.start_at<=now() then raise exception 'POLICY_RESTRICTED';end if;
  if not private.guest_can_cancel((b.start_at at time zone 'Asia/Manila')::date) then raise exception 'CANCEL_CUTOFF';end if;
  update public.table_bookings set blocks_inventory=false where reservation_id=r.id;
  update public.reservations set status='cancelled',version=version+1,hold_expires_at=null where id=r.id returning * into r;
 elsif p_op='status' then
  if not staff then raise exception 'FORBIDDEN';end if;
  -- Staff run the floor at their discretion: any active status may move to any other.
  if p_status is null or p_status not in('confirmed','seated','completed','cancelled') or p_status=r.status then raise exception 'INVALID_TRANSITION';end if;
  if p_status in('seated','completed') and (b.start_at at time zone 'Asia/Manila')::date<>(now() at time zone 'Asia/Manila')::date then raise exception 'POLICY_RESTRICTED';end if;
  if p_status in('confirmed','seated') and b.end_at<=now() then raise exception 'POLICY_RESTRICTED';end if;
  -- Reopening re-claims the table; the exclusion constraint rejects it if someone took the slot.
  update public.table_bookings set blocks_inventory=p_status in('confirmed','seated') where reservation_id=r.id;
  update public.reservations set status=p_status,version=version+1,hold_expires_at=null where id=r.id returning * into r;
 else raise exception 'INVALID_INPUT';end if;
 result:=to_jsonb(r);
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,before_values,after_values)
 select u,p.full_name,coalesce(s.role,'customer'),'table_'||case when p_op='status' then p_status else p_op end,r.id,old_r-'guest_email'-'guest_phone'-'original_request',result-'guest_email'-'guest_phone'-'original_request' from public.profiles p left join public.staff_roles s on s.user_id=p.id where p.id=u;
 return result;
exception when exclusion_violation then raise exception 'AVAILABILITY_CONFLICT' using errcode='23P01';
end $$;
