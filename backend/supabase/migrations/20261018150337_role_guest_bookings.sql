-- Preserve history; share one authoritative reservation and allocation ledger.
alter table public.reservations add column booking_source text not null default 'customer_online', add column created_by uuid references public.profiles(id), add column guest_full_name text, add column guest_email text, add column guest_phone text;
update public.reservations set created_by=customer_id;
alter table public.reservations alter column created_by set not null;
alter table public.reservations alter column created_by set default auth.uid();
alter table public.reservations alter column customer_id drop not null;
alter table public.reservations add constraint reservation_channel_owner check(
 (booking_source='customer_online' and customer_id is not null and created_by=customer_id and guest_full_name is null and guest_email is null and guest_phone is null) or
 (booking_source='staff_guest' and customer_id is null and guest_full_name is not null and length(btrim(guest_full_name)) between 1 and 100));
alter table public.reservations add constraint reservation_guest_contact check((guest_email is null or (length(guest_email)<=254 and guest_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')) and (guest_phone is null or length(guest_phone)<=32));
create unique index reservation_guest_request on public.reservations(created_by,idempotency_key) where booking_source='staff_guest';
create index reservation_creator on public.reservations(created_by);
create index room_booking_arrival on public.room_bookings(check_in,reservation_id);
create index room_booking_departure on public.room_bookings(check_out,reservation_id);
drop policy own_reservations on public.reservations;
create policy own_reservations on public.reservations for select to authenticated using(private.is_admin() or (private.is_staff() and status<>'draft') or (not private.is_staff() and customer_id=auth.uid() and booking_source='customer_online'));
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
  update public.reservations set guests=p_guests,total=price*(p_end-p_start),version=version+1 where id=r.id returning * into r;
 elsif p_op='submit' then
  if r.status<>'draft' then raise exception 'INVALID_TRANSITION';end if;
  if p_start<=(now() at time zone 'Asia/Manila')::date then raise exception 'INVALID_INPUT';end if;
  update public.room_bookings set blocks_inventory=true where reservation_id=r.id;
  update public.reservations set status='pending',version=version+1,hold_expires_at=least(now()+interval '24 hours',p_start::timestamp at time zone 'Asia/Manila') where id=r.id returning * into r;
 elsif p_op='transition' then
  if not private.is_staff() then raise exception 'FORBIDDEN';end if;
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
create function private.guest_booking(p_id uuid,p_version integer,p_room uuid,p_start date,p_end date,p_guests integer,p_name text,p_email text,p_phone text,p_key uuid)
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
  if r.booking_source<>'staff_guest' then raise exception 'FORBIDDEN';end if;
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
revoke execute on function private.guest_booking(uuid,integer,uuid,date,date,integer,text,text,text,uuid) from public,anon;
grant execute on function private.guest_booking(uuid,integer,uuid,date,date,integer,text,text,text,uuid) to authenticated;
create function public.create_guest_reservation(p_room_id uuid,p_check_in date,p_check_out date,p_guests integer,p_guest_full_name text,p_guest_email text,p_guest_phone text,p_idempotency_key uuid) returns jsonb language sql security invoker set search_path='' as $$select private.guest_booking(null,null,p_room_id,p_check_in,p_check_out,p_guests,p_guest_full_name,p_guest_email,p_guest_phone,p_idempotency_key)$$;
create function public.update_guest_reservation(p_id uuid,p_version integer,p_room_id uuid,p_check_in date,p_check_out date,p_guests integer,p_guest_full_name text,p_guest_email text,p_guest_phone text) returns jsonb language sql security invoker set search_path='' as $$select private.guest_booking(p_id,p_version,p_room_id,p_check_in,p_check_out,p_guests,p_guest_full_name,p_guest_email,p_guest_phone,null)$$;
revoke execute on function public.create_guest_reservation(uuid,date,date,integer,text,text,text,uuid),public.update_guest_reservation(uuid,integer,uuid,date,date,integer,text,text,text) from public,anon;
grant execute on function public.create_guest_reservation(uuid,date,date,integer,text,text,text,uuid),public.update_guest_reservation(uuid,integer,uuid,date,date,integer,text,text,text) to authenticated;
