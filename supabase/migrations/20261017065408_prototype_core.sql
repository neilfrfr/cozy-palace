-- Apply to an isolated Supabase development project. All writes go through guarded RPCs.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon;

create table public.profiles (
 id uuid primary key references auth.users(id), full_name text not null default 'Guest', created_at timestamptz not null default now()
);
create table public.staff_roles (
 user_id uuid primary key references public.profiles(id), role text not null check(role in ('staff','admin'))
);
create table public.room_types (
 id uuid primary key default gen_random_uuid(), name text not null, description text not null,
 capacity integer not null check(capacity>0), nightly_rate numeric(12,2) not null check(nightly_rate>=0)
);
create table public.rooms (
 id uuid primary key default gen_random_uuid(), room_number text unique not null,
 room_type_id uuid not null references public.room_types(id), operational_state text not null default 'available' check(operational_state in ('available','out_of_service'))
);
create table public.restaurant_tables (
 id uuid primary key default gen_random_uuid(), table_number text unique not null, capacity integer not null check(capacity>0), operational_state text not null default 'available' check(operational_state in ('available','out_of_service'))
);
create table public.reservations (
 id uuid primary key default gen_random_uuid(), reference text unique not null default ('CP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 customer_id uuid not null references public.profiles(id), kind text not null default 'hotel' check(kind in ('hotel','dining')),
 status text not null default 'draft' check(status in ('draft','pending','confirmed','checked_in','seated','completed','cancelled','expired')),
 guests integer not null check(guests>0), total numeric(12,2) not null check(total>=0), currency text not null default 'PHP' check(currency='PHP'),
 version integer not null default 1 check(version>0), idempotency_key uuid not null, original_request jsonb not null,
 hold_expires_at timestamptz, created_at timestamptz not null default now(), unique(customer_id,idempotency_key)
);
create table public.room_bookings (
 reservation_id uuid primary key references public.reservations(id) on delete cascade,
 room_id uuid not null references public.rooms(id), check_in date not null, check_out date not null,
 rate_at_booking numeric(12,2) not null check(rate_at_booking>=0), blocks_inventory boolean not null default false,
 check(check_out>check_in)
);
-- Database constraints remain authoritative under concurrent API requests.
alter table public.room_bookings add constraint room_no_overlap exclude using gist
(room_id extensions.gist_uuid_ops with =, daterange(check_in,check_out,'[)') with &&) where(blocks_inventory);
create table public.table_bookings (
 reservation_id uuid primary key references public.reservations(id) on delete cascade,
 table_id uuid not null references public.restaurant_tables(id), start_at timestamptz not null, end_at timestamptz not null,
 blocks_inventory boolean not null default false, check(end_at>start_at)
);
alter table public.table_bookings add constraint table_no_overlap exclude using gist
(table_id extensions.gist_uuid_ops with =, tstzrange(start_at,end_at,'[)') with &&) where(blocks_inventory);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id),
 actor_name text not null, actor_role text not null, action text not null, record_id uuid not null,
 before_values jsonb, after_values jsonb, occurred_at timestamptz not null default clock_timestamp()
);
create index reservations_customer_created on public.reservations(customer_id,created_at desc);
create index reservations_status on public.reservations(status);
create index audit_record_time on public.audit_logs(record_id,occurred_at desc);
create index audit_actor_time on public.audit_logs(actor_id,occurred_at desc);
create index room_type_idx on public.rooms(room_type_id);
create index room_allocation_idx on public.room_bookings(room_id);
create index table_allocation_idx on public.table_bookings(table_id);

create function private.on_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,full_name) values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'full_name',''),'Guest'),100));return new;end $$;
revoke execute on function private.on_signup() from public,anon,authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.on_signup();

create function private.is_staff() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.staff_roles where user_id=auth.uid() and role in('staff','admin'))
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.staff_roles where user_id=auth.uid() and role='admin')
$$;
revoke execute on function private.is_staff(),private.is_admin() from public,anon;
grant execute on function private.is_staff(),private.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.staff_roles enable row level security;
alter table public.room_types enable row level security;
alter table public.rooms enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.reservations enable row level security;
alter table public.room_bookings enable row level security;
alter table public.table_bookings enable row level security;
alter table public.audit_logs enable row level security;
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid() or private.is_staff());
create policy own_role on public.staff_roles for select to authenticated using(user_id=auth.uid());
create policy public_room_types on public.room_types for select to anon,authenticated using(true);
create policy public_rooms on public.rooms for select to anon,authenticated using(true);
create policy public_tables on public.restaurant_tables for select to anon,authenticated using(true);
create policy own_reservations on public.reservations for select to authenticated using(customer_id=auth.uid() or private.is_staff());
create policy own_room_bookings on public.room_bookings for select to authenticated using(exists(select 1 from public.reservations r where r.id=reservation_id));
create policy own_table_bookings on public.table_bookings for select to authenticated using(exists(select 1 from public.reservations r where r.id=reservation_id));
create policy admin_logs on public.audit_logs for select to authenticated using(private.is_admin());
revoke all on public.profiles,public.staff_roles,public.room_types,public.rooms,public.restaurant_tables,public.reservations,public.room_bookings,public.table_bookings,public.audit_logs from anon,authenticated;
grant select on public.room_types,public.rooms,public.restaurant_tables to anon,authenticated;
grant select on public.profiles,public.staff_roles,public.reservations,public.room_bookings,public.table_bookings,public.audit_logs to authenticated;

-- Private mutation capability: every path checks identity, owner/role, version and business input.
-- Public invoker wrappers expose only these guarded capabilities through the Data API.
create function private.reserve(p_op text,p_id uuid,p_version integer,p_room uuid,p_start date,p_end date,p_guests integer,p_key uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.reservations; old_r jsonb; allocation public.room_bookings;
 capacity integer; price numeric(12,2); payload jsonb; target text; result jsonb;
begin
 if u is null then raise exception 'UNAUTHORIZED';end if;
 if p_op='create' then
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
  if r.customer_id<>u and not private.is_staff() then raise exception 'FORBIDDEN';end if;
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
 if p_op<>'create' then
  select * into r from public.reservations where id=p_id for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if r.customer_id<>u and not private.is_staff() then raise exception 'FORBIDDEN';end if;
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
  if p_start<=(now() at time zone 'Asia/Manila')::date then raise exception 'INVALID_INPUT';end if;
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
 select u,p.full_name,coalesce(s.role,'customer'),case when p_op='transition' then p_status else p_op end,r.id,old_r,case when p_op='delete' then null else result end from public.profiles p left join public.staff_roles s on s.user_id=p.id where p.id=u;
 return result;
exception when exclusion_violation then raise exception 'AVAILABILITY_CONFLICT' using errcode='23P01';
end $$;
revoke execute on function private.reserve(text,uuid,integer,uuid,date,date,integer,uuid,text) from public,anon;
grant execute on function private.reserve(text,uuid,integer,uuid,date,date,integer,uuid,text) to authenticated;
create function public.create_reservation(p_room_id uuid,p_check_in date,p_check_out date,p_guests integer,p_idempotency_key uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.reserve('create',null,null,p_room_id,p_check_in,p_check_out,p_guests,p_idempotency_key,null) $$;
create function public.update_reservation(p_id uuid,p_version integer,p_room_id uuid,p_check_in date,p_check_out date,p_guests integer) returns jsonb language sql security invoker set search_path='' as $$select private.reserve('update',p_id,p_version,p_room_id,p_check_in,p_check_out,p_guests,null,null)$$;
create function public.submit_reservation(p_id uuid,p_version integer) returns jsonb language sql security invoker set search_path='' as $$select private.reserve('submit',p_id,p_version,null,null,null,null,null,null)$$;
create function public.delete_draft(p_id uuid,p_version integer) returns jsonb language sql security invoker set search_path='' as $$select private.reserve('delete',p_id,p_version,null,null,null,null,null,null)$$;
create function public.transition_reservation(p_id uuid,p_version integer,p_status text) returns jsonb language sql security invoker set search_path='' as $$select private.reserve('transition',p_id,p_version,null,null,null,null,null,p_status)$$;
revoke execute on function public.create_reservation(uuid,date,date,integer,uuid), public.update_reservation(uuid,integer,uuid,date,date,integer),public.submit_reservation(uuid,integer),public.delete_draft(uuid,integer),public.transition_reservation(uuid,integer,text) from public,anon;
grant execute on function public.create_reservation(uuid,date,date,integer,uuid), public.update_reservation(uuid,integer,uuid,date,date,integer),public.submit_reservation(uuid,integer),public.delete_draft(uuid,integer),public.transition_reservation(uuid,integer,text) to authenticated;

-- Public availability returns inventory only, never personal booking data.
create function private.available(p_start date,p_end date,p_guests integer) returns setof public.rooms language plpgsql security definer set search_path='' as $$
begin
 if p_start is null or p_end is null or p_end<=p_start or p_guests is null or p_guests<1 or p_guests>20 or p_end-p_start>365 then raise exception 'INVALID_INPUT';end if;
 return query select rm.* from public.rooms rm join public.room_types t on t.id=rm.room_type_id where rm.operational_state='available' and t.capacity>=p_guests and not exists(select 1 from public.room_bookings b join public.reservations r on r.id=b.reservation_id where b.room_id=rm.id and b.blocks_inventory and (r.status<>'pending' or r.hold_expires_at>now()) and daterange(b.check_in,b.check_out,'[)') && daterange(p_start,p_end,'[)'));
end $$;
revoke execute on function private.available(date,date,integer) from public;
grant execute on function private.available(date,date,integer) to anon,authenticated;
create function public.search_availability(p_check_in date,p_check_out date,p_guests integer) returns setof public.rooms language sql security invoker set search_path='' as $$select * from private.available(p_check_in,p_check_out,p_guests)$$;
revoke execute on function public.search_availability(date,date,integer) from public;
grant execute on function public.search_availability(date,date,integer) to anon,authenticated;
