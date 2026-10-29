-- Staff confirm every customer and visitor booking.
-- A pending room request is held until check-in instead of 24 hours, and paying no longer confirms it.
-- A paid booking stays as it is; customers can also pay after staff confirm.
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
 values(null,'guest_online',null,p_name,p_email,p_phone,'pending',p_guests,price*(p_end-p_start),p_key,payload,p_start::timestamp at time zone 'Asia/Manila') returning * into r;
 insert into public.room_bookings(reservation_id,room_id,check_in,check_out,rate_at_booking,blocks_inventory) values(r.id,p_room,p_start,p_end,price,true);
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,after_values)
 values(null,p_name,'guest','guest_online_created',r.id,to_jsonb(r)-'guest_email'-'guest_phone'-'original_request');
 return jsonb_build_object('id',r.id,'reference',r.reference);
exception when exclusion_violation then raise exception 'AVAILABILITY_CONFLICT' using errcode='23P01';
end $$;

create or replace function private.open_payment(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.reservations; p public.payments;
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 select * into r from public.reservations where id=p_id for update;
 if not found or r.customer_id is distinct from u then raise exception 'NOT_FOUND';end if;
 if r.kind<>'hotel' or r.status not in('pending','confirmed') or (r.status='pending' and r.hold_expires_at<=now()) or r.total<=0
  or exists(select 1 from public.payments x where x.reservation_id=r.id and x.status='paid') then raise exception 'INVALID_TRANSITION';end if;
 insert into public.payments(reservation_id,amount) values(r.id,r.total) returning * into p;
 return jsonb_build_object('id',p.id,'amount',p.amount,'reference',r.reference);
end $$;

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
 values(null,'PayMongo','system','payment_'||outcome,r.id,jsonb_build_object('status',r.status),
  jsonb_build_object('status',r.status,'payment',p.id,'amount_paid',p_amount));
 return outcome;
end $$;

-- Holds already running end at check-in.
update public.reservations r set hold_expires_at=b.check_in::timestamp at time zone 'Asia/Manila'
from public.room_bookings b where b.reservation_id=r.id and r.status='pending' and r.hold_expires_at>now();
