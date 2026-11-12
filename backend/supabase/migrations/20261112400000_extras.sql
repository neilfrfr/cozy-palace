-- FR03: paid extras and packages a guest adds to a room booking. Admins set them; each booking keeps a snapshot,
-- so later price changes never alter it. Prices are worked out here, never taken from the browser.
create table public.extras (
 id uuid primary key default gen_random_uuid(), name text unique not null check(length(btrim(name)) between 1 and 80),
 description text not null default '' check(length(description)<=300),
 kind text not null default 'extra' check(kind in('extra','package')),
 price numeric(12,2) not null check(price between 0 and 100000),
 pricing text not null check(pricing in('per_night','per_stay')),
 max_quantity integer not null check(max_quantity between 1 and 20),
 active boolean not null default true
);
create table public.reservation_extras (
 reservation_id uuid not null references public.reservations(id) on delete cascade, extra_id uuid not null references public.extras(id),
 name text not null, unit_price numeric(12,2) not null check(unit_price>=0), pricing text not null check(pricing in('per_night','per_stay')),
 quantity integer not null check(quantity between 1 and 20), line_total numeric(12,2) not null check(line_total>=0),
 primary key(reservation_id,extra_id)
);
alter table public.extras enable row level security;
alter table public.reservation_extras enable row level security;
create policy public_extras on public.extras for select to anon,authenticated using(true);
create policy own_reservation_extras on public.reservation_extras for select to authenticated using(exists(select 1 from public.reservations r where r.id=reservation_id));
revoke all on public.extras,public.reservation_extras from anon,authenticated;
grant select on public.extras to anon,authenticated;
grant select on public.reservation_extras to authenticated;

-- Reprices a booking's extras for its number of nights and returns their sum. Keep in step with extrasTotal in frontend/lib/extras.ts.
create function private.price_extras(p_reservation uuid,p_nights integer) returns numeric language sql security definer set search_path='' as $$
 with priced as (
  update public.reservation_extras set line_total=unit_price*quantity*case when pricing='per_night' then p_nights else 1 end
  where reservation_id=p_reservation returning line_total
 ) select coalesce(sum(line_total),0) from priced
$$;
-- p_extras: [{"id": uuid, "quantity": int}]. Inactive items, unknown ids, repeats and quantities outside 1..max are rejected.
create function private.add_extras(p_reservation uuid,p_extras jsonb,p_nights integer) returns numeric language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if p_extras is null or jsonb_typeof(p_extras)<>'array' or jsonb_array_length(p_extras)>20 then raise exception 'INVALID_INPUT';end if;
 insert into public.reservation_extras(reservation_id,extra_id,name,unit_price,pricing,quantity,line_total)
 select p_reservation,e.id,e.name,e.price,e.pricing,(x->>'quantity')::integer,0 from jsonb_array_elements(p_extras) x
 join public.extras e on e.id=(x->>'id')::uuid and e.active and (x->>'quantity')::integer between 1 and e.max_quantity;
 get diagnostics n=row_count;
 if n<>jsonb_array_length(p_extras) then raise exception 'INVALID_INPUT';end if;
 return private.price_extras(p_reservation,p_nights);
exception when invalid_text_representation or numeric_value_out_of_range or unique_violation then raise exception 'INVALID_INPUT';
end $$;
revoke execute on function private.price_extras(uuid,integer),private.add_extras(uuid,jsonb,integer) from public,anon,authenticated;

-- Admins add, edit and deactivate extras; items are never deleted because bookings refer to them.
create function private.save_extra(p_id uuid,p_name text,p_description text,p_kind text,p_price numeric,p_pricing text,p_max_quantity integer,p_active boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.extras; old jsonb;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if p_id is null then
  insert into public.extras(name,description,kind,price,pricing,max_quantity,active) values(btrim(p_name),btrim(p_description),p_kind,p_price,p_pricing,p_max_quantity,p_active) returning * into e;
 else
  select * into e from public.extras where id=p_id for update;
  if not found then raise exception 'NOT_FOUND';end if;
  old:=to_jsonb(e);
  update public.extras set name=btrim(p_name),description=btrim(p_description),kind=p_kind,price=p_price,pricing=p_pricing,max_quantity=p_max_quantity,active=p_active where id=p_id returning * into e;
 end if;
 perform private.log(case when p_id is null then 'extra_created' when (old->>'active')::boolean and not e.active then 'extra_deactivated' else 'extra_updated' end,e.id,old,to_jsonb(e));
 return to_jsonb(e);
exception when check_violation or not_null_violation or unique_violation then raise exception 'INVALID_INPUT';
end $$;
revoke execute on function private.save_extra(uuid,text,text,text,numeric,text,integer,boolean) from public,anon;
grant execute on function private.save_extra(uuid,text,text,text,numeric,text,integer,boolean) to authenticated;
create function public.save_extra(p_id uuid,p_name text,p_description text,p_kind text,p_price numeric,p_pricing text,p_max_quantity integer,p_active boolean) returns jsonb language sql security invoker set search_path='' as $$select private.save_extra(p_id,p_name,p_description,p_kind,p_price,p_pricing,p_max_quantity,p_active)$$;
revoke execute on function public.save_extra(uuid,text,text,text,numeric,text,integer,boolean) from public,anon;
grant execute on function public.save_extra(uuid,text,text,text,numeric,text,integer,boolean) to authenticated;

-- private.reserve as in 20261112100100_cancellation_cutoff, plus p_extras: a new booking adds its extras to the
-- total, and an edit reprices them for the new number of nights. The other wrappers keep calling it without extras.
drop function private.reserve(text,uuid,integer,uuid,date,date,integer,uuid,text);
create function private.reserve(p_op text,p_id uuid,p_version integer,p_room uuid,p_start date,p_end date,p_guests integer,p_key uuid,p_status text,p_extras jsonb default '[]')
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.reservations; old_r jsonb; allocation public.room_bookings;
 capacity integer; price numeric(12,2); payload jsonb; target text; result jsonb;
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if p_op='create' then
  if private.is_staff() then raise exception 'FORBIDDEN';end if;
  if p_key is null then raise exception 'INVALID_INPUT';end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text||p_key::text,0));
  payload:=jsonb_build_object('room',p_room,'start',p_start,'end',p_end,'guests',p_guests,'extras',p_extras);
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
  update public.reservations set total=total+private.add_extras(r.id,p_extras,p_end-p_start) where id=r.id returning * into r;
 elsif p_op='update' then
  if r.status not in('draft','pending','confirmed') then raise exception 'INVALID_TRANSITION';end if;
  if (private.is_staff() and p_start<(now() at time zone 'Asia/Manila')::date) or (not private.is_staff() and p_start<=(now() at time zone 'Asia/Manila')::date) then raise exception 'INVALID_INPUT';end if;
  if r.customer_id=u and r.status<>'draft' and allocation.check_in<=(now() at time zone 'Asia/Manila')::date then raise exception 'POLICY_RESTRICTED';end if;
  -- Preserve the agreed rate when editing the same resource; new room uses its current rate.
  if allocation.room_id=p_room then price:=allocation.rate_at_booking;end if;
  update public.room_bookings set room_id=p_room,check_in=p_start,check_out=p_end,rate_at_booking=price where reservation_id=r.id;
  update public.reservations set guests=p_guests,total=price*(p_end-p_start)+private.price_extras(r.id,p_end-p_start),version=version+1,hold_expires_at=case when status='pending' then p_start::timestamp at time zone 'Asia/Manila' else hold_expires_at end where id=r.id returning * into r;
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
revoke execute on function private.reserve(text,uuid,integer,uuid,date,date,integer,uuid,text,jsonb) from public,anon;
grant execute on function private.reserve(text,uuid,integer,uuid,date,date,integer,uuid,text,jsonb) to authenticated;
drop function public.create_reservation(uuid,date,date,integer,uuid);
create function public.create_reservation(p_room_id uuid,p_check_in date,p_check_out date,p_guests integer,p_idempotency_key uuid,p_extras jsonb default '[]') returns jsonb language sql security invoker set search_path='' as $$ select private.reserve('create',null,null,p_room_id,p_check_in,p_check_out,p_guests,p_idempotency_key,null,p_extras) $$;
revoke execute on function public.create_reservation(uuid,date,date,integer,uuid,jsonb) from public,anon;
grant execute on function public.create_reservation(uuid,date,date,integer,uuid,jsonb) to authenticated;

-- private.book_as_guest as in 20261029140000_staff_confirm_bookings, plus p_extras.
drop function public.book_as_guest(uuid,date,date,integer,text,text,text,uuid,text);
drop function private.book_as_guest(uuid,date,date,integer,text,text,text,uuid,text);
create function private.book_as_guest(p_room uuid,p_start date,p_end date,p_guests integer,p_name text,p_email text,p_phone text,p_key uuid,p_ip text,p_extras jsonb default '[]')
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reservations; payload jsonb; capacity integer; price numeric(12,2);
begin
 p_name:=btrim(p_name);p_email:=lower(btrim(p_email));p_phone:=btrim(p_phone);
 perform private.visitor_check(p_name,p_email,p_phone,p_key,p_ip);
 perform pg_advisory_xact_lock(hashtextextended('guest'||p_key::text,0));
 payload:=jsonb_build_object('room',p_room,'start',p_start,'end',p_end,'guests',p_guests,'name',p_name,'email',p_email,'phone',p_phone,'extras',p_extras);
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
 update public.reservations set total=total+private.add_extras(r.id,p_extras,p_end-p_start) where id=r.id returning * into r;
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,after_values)
 values(null,p_name,'guest','guest_online_created',r.id,to_jsonb(r)-'guest_email'-'guest_phone'-'original_request');
 return jsonb_build_object('id',r.id,'reference',r.reference);
exception when exclusion_violation then raise exception 'AVAILABILITY_CONFLICT' using errcode='23P01';
end $$;
revoke execute on function private.book_as_guest(uuid,date,date,integer,text,text,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.book_as_guest(uuid,date,date,integer,text,text,text,uuid,text,jsonb) to service_role;
create function public.book_as_guest(p_room_id uuid,p_check_in date,p_check_out date,p_guests integer,p_guest_full_name text,p_guest_email text,p_guest_phone text,p_idempotency_key uuid,p_client_ip text,p_extras jsonb default '[]') returns jsonb language sql security invoker set search_path='' as $$select private.book_as_guest(p_room_id,p_check_in,p_check_out,p_guests,p_guest_full_name,p_guest_email,p_guest_phone,p_idempotency_key,p_client_ip,p_extras)$$;
revoke execute on function public.book_as_guest(uuid,date,date,integer,text,text,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.book_as_guest(uuid,date,date,integer,text,text,text,uuid,text,jsonb) to service_role;

-- Starting items; prices are placeholders for the admin to set.
insert into public.extras(name,description,kind,price,pricing,max_quantity) values
 ('Extra mattress','A roll-away bed made up in your room.','extra',800,'per_night',2),
 ('Extra bedding','A spare set of pillows, sheets and a blanket.','extra',300,'per_stay',3),
 ('Amenity kit','Toiletries, slippers and bottled water for one guest.','extra',250,'per_stay',4),
 ('Breakfast package','Breakfast for two at the restaurant each morning.','package',900,'per_night',1);
