-- Dining reservations: one restaurant table for a fixed two-hour seating, no payment.
-- Kept apart from private.reserve, which assumes every reservation has a room.

-- Bookable start times (Asia/Manila). Keep in step with diningSlots in frontend/lib/dining.ts.
create function private.dining_slot(p_start timestamptz) returns boolean language sql stable set search_path='' as $$
 select extract(second from l)=0 and extract(minute from l) in(0,30)
  and (l::time between '11:00' and '14:00' or l::time between '17:00' and '21:00')
 from (select p_start at time zone 'Asia/Manila' l) s
$$;
revoke execute on function private.dining_slot(timestamptz) from public,anon;
grant execute on function private.dining_slot(timestamptz) to authenticated;

create function private.dining(p_op text,p_id uuid,p_version integer,p_table uuid,p_start timestamptz,p_guests integer,p_name text,p_email text,p_phone text,p_key uuid,p_status text)
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
revoke execute on function private.dining(text,uuid,integer,uuid,timestamptz,integer,text,text,text,uuid,text) from public,anon;
grant execute on function private.dining(text,uuid,integer,uuid,timestamptz,integer,text,text,text,uuid,text) to authenticated;
create function public.book_table(p_table_id uuid,p_start_at timestamptz,p_guests integer,p_idempotency_key uuid,p_guest_full_name text default null,p_guest_email text default null,p_guest_phone text default null) returns jsonb language sql security invoker set search_path='' as $$select private.dining('create',null,null,p_table_id,p_start_at,p_guests,p_guest_full_name,p_guest_email,p_guest_phone,p_idempotency_key,null)$$;
create function public.cancel_table_booking(p_id uuid,p_version integer) returns jsonb language sql security invoker set search_path='' as $$select private.dining('cancel',p_id,p_version,null,null,null,null,null,null,null,null)$$;
create function public.set_table_booking_status(p_id uuid,p_version integer,p_status text) returns jsonb language sql security invoker set search_path='' as $$select private.dining('status',p_id,p_version,null,null,null,null,null,null,null,p_status)$$;
revoke execute on function public.book_table(uuid,timestamptz,integer,uuid,text,text,text),public.cancel_table_booking(uuid,integer),public.set_table_booking_status(uuid,integer,text) from public,anon;
grant execute on function public.book_table(uuid,timestamptz,integer,uuid,text,text,text),public.cancel_table_booking(uuid,integer),public.set_table_booking_status(uuid,integer,text) to authenticated;

-- Tables taken during a seating that starts at p_start. Ids only, never who booked them.
create function private.booked_tables(p_start timestamptz) returns table(table_id uuid) language plpgsql stable security definer set search_path='' as $$
begin
 if p_start is null then raise exception 'INVALID_INPUT';end if;
 return query select distinct b.table_id from public.table_bookings b join public.reservations r on r.id=b.reservation_id
  where b.blocks_inventory and (r.status<>'pending' or r.hold_expires_at>now())
   and tstzrange(b.start_at,b.end_at,'[)') && tstzrange(p_start,p_start+interval '2 hours','[)');
end $$;
revoke execute on function private.booked_tables(timestamptz) from public;
grant execute on function private.booked_tables(timestamptz) to anon,authenticated;
create function public.booked_tables(p_start_at timestamptz) returns table(table_id uuid) language sql stable security invoker set search_path='' as $$select * from private.booked_tables(p_start_at)$$;
revoke execute on function public.booked_tables(timestamptz) from public;
grant execute on function public.booked_tables(timestamptz) to anon,authenticated;

-- Room operations must not touch dining reservations, which have no room allocation.
create function private.require_hotel(p_id uuid) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if exists(select 1 from public.reservations where id=p_id and kind<>'hotel') then raise exception 'NOT_FOUND';end if;
end $$;
revoke execute on function private.require_hotel(uuid) from public,anon;
grant execute on function private.require_hotel(uuid) to authenticated;
create or replace function public.update_reservation(p_id uuid,p_version integer,p_room_id uuid,p_check_in date,p_check_out date,p_guests integer) returns jsonb language plpgsql security invoker set search_path='' as $$
begin perform private.require_hotel(p_id);return private.reserve('update',p_id,p_version,p_room_id,p_check_in,p_check_out,p_guests,null,null);end $$;
create or replace function public.transition_reservation(p_id uuid,p_version integer,p_status text) returns jsonb language plpgsql security invoker set search_path='' as $$
begin perform private.require_hotel(p_id);return private.reserve('transition',p_id,p_version,null,null,null,null,null,p_status);end $$;
create or replace function public.update_guest_reservation(p_id uuid,p_version integer,p_room_id uuid,p_check_in date,p_check_out date,p_guests integer,p_guest_full_name text,p_guest_email text,p_guest_phone text) returns jsonb language plpgsql security invoker set search_path='' as $$
begin perform private.require_hotel(p_id);return private.guest_booking(p_id,p_version,p_room_id,p_check_in,p_check_out,p_guests,p_guest_full_name,p_guest_email,p_guest_phone,null);end $$;
