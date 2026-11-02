-- FR02: admins edit room-type rates and capacity, table capacity, and close a room or table for a date range.
-- FR12: staff mark an order paid with its method. Every change goes to the activity log (FR11).
create table public.resource_blocks (
 id uuid primary key default gen_random_uuid(),
 room_id uuid references public.rooms(id), table_id uuid references public.restaurant_tables(id),
 starts_on date not null, ends_on date not null, reason text not null check(length(btrim(reason)) between 1 and 200),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 check((room_id is null)<>(table_id is null)), check(ends_on>starts_on and ends_on-starts_on<=366)
);
create index resource_blocks_room on public.resource_blocks(room_id,starts_on);
create index resource_blocks_table on public.resource_blocks(table_id,starts_on);
alter table public.resource_blocks enable row level security;
create policy staff_blocks on public.resource_blocks for select to authenticated using(private.is_staff());
revoke all on public.resource_blocks from anon,authenticated;
grant select on public.resource_blocks to authenticated;

-- Closed nights are [starts_on, ends_on), like a stay.
create function private.blocked(p_room uuid,p_table uuid,p_from date,p_to date) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.resource_blocks k where (k.room_id=p_room or k.table_id=p_table)
  and daterange(k.starts_on,k.ends_on,'[)') && daterange(p_from,p_to,'[)'))
$$;
revoke execute on function private.blocked(uuid,uuid,date,date) from public,anon,authenticated;

-- Every booking path already turns exclusion_violation into AVAILABILITY_CONFLICT, so a closure is refused
-- exactly like a double booking. The resource row lock serializes this check with add_block.
create function private.check_room_block() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and old.blocks_inventory and old.room_id=new.room_id and old.check_in=new.check_in and old.check_out=new.check_out then return new;end if;
 perform 1 from public.rooms where id=new.room_id for update;
 if private.blocked(new.room_id,null,new.check_in,new.check_out) then raise exception 'AVAILABILITY_CONFLICT' using errcode='23P01';end if;
 return new;
end $$;
create function private.check_table_block() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and old.blocks_inventory and old.table_id=new.table_id and old.start_at=new.start_at and old.end_at=new.end_at then return new;end if;
 perform 1 from public.restaurant_tables where id=new.table_id for update;
 if private.blocked(null,new.table_id,(new.start_at at time zone 'Asia/Manila')::date,(new.end_at at time zone 'Asia/Manila')::date+1) then
  raise exception 'AVAILABILITY_CONFLICT' using errcode='23P01';end if;
 return new;
end $$;
revoke execute on function private.check_room_block(),private.check_table_block() from public,anon,authenticated;
create trigger room_booking_closed before insert or update on public.room_bookings for each row when (new.blocks_inventory) execute function private.check_room_block();
create trigger table_booking_closed before insert or update on public.table_bookings for each row when (new.blocks_inventory) execute function private.check_table_block();

-- Searches and date pickers hide closed rooms, nights and tables too.
create or replace function private.available(p_start date,p_end date,p_guests integer) returns setof public.rooms language plpgsql security definer set search_path='' as $$
begin
 if p_start is null or p_end is null or p_end<=p_start or p_guests is null or p_guests<1 or p_guests>20 or p_end-p_start>365 then raise exception 'INVALID_INPUT';end if;
 return query select rm.* from public.rooms rm join public.room_types t on t.id=rm.room_type_id where rm.operational_state='available' and t.capacity>=p_guests
  and not private.blocked(rm.id,null,p_start,p_end)
  and not exists(select 1 from public.room_bookings b join public.reservations r on r.id=b.reservation_id where b.room_id=rm.id and b.blocks_inventory and (r.status<>'pending' or r.hold_expires_at>now()) and daterange(b.check_in,b.check_out,'[)') && daterange(p_start,p_end,'[)'));
end $$;
create or replace function private.booked_ranges(p_from date,p_to date,p_exclude uuid) returns table(room_id uuid,check_in date,check_out date) language plpgsql stable security definer set search_path='' as $$
begin
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>400 then raise exception 'INVALID_INPUT';end if;
 return query select * from (
  select b.room_id,b.check_in,b.check_out from public.room_bookings b join public.reservations r on r.id=b.reservation_id where b.blocks_inventory and (r.status<>'pending' or r.hold_expires_at>now()) and (p_exclude is null or r.id<>p_exclude) and daterange(b.check_in,b.check_out,'[)') && daterange(p_from,p_to,'[)')
  union all
  select k.room_id,k.starts_on,k.ends_on from public.resource_blocks k where k.room_id is not null and daterange(k.starts_on,k.ends_on,'[)') && daterange(p_from,p_to,'[)')
 ) x order by 1,2;
end $$;
create or replace function private.booked_tables(p_start timestamptz) returns table(table_id uuid) language plpgsql stable security definer set search_path='' as $$
begin
 if p_start is null then raise exception 'INVALID_INPUT';end if;
 return query select b.table_id from public.table_bookings b join public.reservations r on r.id=b.reservation_id
  where b.blocks_inventory and (r.status<>'pending' or r.hold_expires_at>now())
   and tstzrange(b.start_at,b.end_at,'[)') && tstzrange(p_start,p_start+interval '2 hours','[)')
  union
  select k.table_id from public.resource_blocks k where k.table_id is not null and (p_start at time zone 'Asia/Manila')::date>=k.starts_on and (p_start at time zone 'Asia/Manila')::date<k.ends_on;
end $$;

-- BR12: a closure that overlaps live bookings is refused; staff move or cancel those bookings first.
create function private.add_block(p_room uuid,p_table uuid,p_from date,p_to date,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare k public.resource_blocks; n integer;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if (p_room is null)=(p_table is null) or p_from is null or p_to is null or p_to<=p_from or p_to-p_from>366
  or p_to<=(now() at time zone 'Asia/Manila')::date or length(btrim(p_reason)) not between 1 and 200 then raise exception 'INVALID_INPUT';end if;
 if p_room is not null then
  perform 1 from public.rooms where id=p_room for update;
  if not found then raise exception 'NOT_FOUND';end if;
  select count(*) into n from public.room_bookings b join public.reservations r on r.id=b.reservation_id
   where b.room_id=p_room and b.blocks_inventory and (r.status<>'pending' or r.hold_expires_at>now()) and daterange(b.check_in,b.check_out,'[)') && daterange(p_from,p_to,'[)');
 else
  perform 1 from public.restaurant_tables where id=p_table for update;
  if not found then raise exception 'NOT_FOUND';end if;
  select count(*) into n from public.table_bookings b join public.reservations r on r.id=b.reservation_id
   where b.table_id=p_table and b.blocks_inventory and (r.status<>'pending' or r.hold_expires_at>now())
    and tstzrange(b.start_at,b.end_at,'[)') && tstzrange(p_from::timestamp at time zone 'Asia/Manila',p_to::timestamp at time zone 'Asia/Manila','[)');
 end if;
 if n>0 then raise exception 'RESOURCE_HAS_BOOKINGS';end if;
 insert into public.resource_blocks(room_id,table_id,starts_on,ends_on,reason,created_by) values(p_room,p_table,p_from,p_to,btrim(p_reason),auth.uid()) returning * into k;
 perform private.log('inventory_closed',coalesce(p_room,p_table),null,to_jsonb(k));
 return to_jsonb(k);
end $$;
create function private.remove_block(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare k public.resource_blocks;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 delete from public.resource_blocks where id=p_id returning * into k;
 if not found then raise exception 'NOT_FOUND';end if;
 perform private.log('inventory_reopened',coalesce(k.room_id,k.table_id),to_jsonb(k),null);
end $$;

-- Existing bookings keep their rate snapshot (rate_at_booking); only new bookings use the new rate.
create function private.save_room_type(p_id uuid,p_rate numeric,p_capacity integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.room_types; old jsonb;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if p_rate is null or p_rate<0 or p_rate>1000000 or p_capacity is null or p_capacity not between 1 and 20 then raise exception 'INVALID_INPUT';end if;
 select * into t from public.room_types where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 old:=to_jsonb(t);
 update public.room_types set nightly_rate=p_rate,capacity=p_capacity where id=p_id returning * into t;
 perform private.log('room_type_updated',t.id,old,to_jsonb(t));
 return to_jsonb(t);
end $$;
create function private.save_table(p_id uuid,p_capacity integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.restaurant_tables; old jsonb;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if p_capacity is null or p_capacity not between 1 and 20 then raise exception 'INVALID_INPUT';end if;
 select * into t from public.restaurant_tables where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 old:=to_jsonb(t);
 update public.restaurant_tables set capacity=p_capacity where id=p_id returning * into t;
 perform private.log('table_updated',t.id,old,to_jsonb(t));
 return to_jsonb(t);
end $$;

-- FR12 order payments: recorded by staff at the counter; this database never moves money.
alter table public.orders
 add column paid_at timestamptz, add column paid_by uuid references public.profiles(id),
 add column payment_method text check(payment_method in('cash','gcash','maya','card','bank_transfer')),
 add column payment_reference text check(length(payment_reference) between 1 and 100),
 add constraint order_paid_complete check((paid_at is null)=(payment_method is null) and (paid_at is null)=(paid_by is null));
create function private.mark_order_paid(p_id uuid,p_version integer,p_method text,p_reference text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders; old jsonb;
begin
 if not private.is_staff() then raise exception 'FORBIDDEN';end if;
 select * into o from public.orders where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if o.version is distinct from p_version then raise exception 'VERSION_CONFLICT';end if;
 if o.status='cancelled' or o.paid_at is not null then raise exception 'INVALID_TRANSITION';end if;
 old:=to_jsonb(o);
 update public.orders set paid_at=now(),paid_by=auth.uid(),payment_method=p_method,payment_reference=nullif(btrim(p_reference),''),version=version+1 where id=o.id returning * into o;
 perform private.log('order_paid',o.id,old,to_jsonb(o));
 return to_jsonb(o);
exception when check_violation then raise exception 'INVALID_INPUT';
end $$;
-- A paid order can no longer be cancelled here: refunds are a separate, recorded step.
create or replace function private.transition_order(p_id uuid,p_version integer,p_status text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders; old jsonb;
begin
 if not private.is_staff() then raise exception 'FORBIDDEN';end if;
 select * into o from public.orders where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if o.version is distinct from p_version then raise exception 'VERSION_CONFLICT';end if;
 if o.status<>'open' or p_status not in('completed','cancelled') or (p_status='cancelled' and o.paid_at is not null) then raise exception 'INVALID_TRANSITION';end if;
 old:=to_jsonb(o);
 update public.orders set status=p_status,version=version+1 where id=o.id returning * into o;
 perform private.log('order_'||p_status,o.id,old,to_jsonb(o));
 return to_jsonb(o);
end $$;

revoke execute on function private.add_block(uuid,uuid,date,date,text),private.remove_block(uuid),private.save_room_type(uuid,numeric,integer),private.save_table(uuid,integer),private.mark_order_paid(uuid,integer,text,text) from public,anon;
grant execute on function private.add_block(uuid,uuid,date,date,text),private.remove_block(uuid),private.save_room_type(uuid,numeric,integer),private.save_table(uuid,integer),private.mark_order_paid(uuid,integer,text,text) to authenticated;
create function public.add_block(p_room_id uuid,p_table_id uuid,p_from date,p_to date,p_reason text) returns jsonb language sql security invoker set search_path='' as $$select private.add_block(p_room_id,p_table_id,p_from,p_to,p_reason)$$;
create function public.remove_block(p_id uuid) returns void language sql security invoker set search_path='' as $$select private.remove_block(p_id)$$;
create function public.save_room_type(p_id uuid,p_nightly_rate numeric,p_capacity integer) returns jsonb language sql security invoker set search_path='' as $$select private.save_room_type(p_id,p_nightly_rate,p_capacity)$$;
create function public.save_table(p_id uuid,p_capacity integer) returns jsonb language sql security invoker set search_path='' as $$select private.save_table(p_id,p_capacity)$$;
create function public.mark_order_paid(p_id uuid,p_version integer,p_method text,p_reference text) returns jsonb language sql security invoker set search_path='' as $$select private.mark_order_paid(p_id,p_version,p_method,p_reference)$$;
revoke execute on function public.add_block(uuid,uuid,date,date,text),public.remove_block(uuid),public.save_room_type(uuid,numeric,integer),public.save_table(uuid,integer),public.mark_order_paid(uuid,integer,text,text) from public,anon;
grant execute on function public.add_block(uuid,uuid,date,date,text),public.remove_block(uuid),public.save_room_type(uuid,numeric,integer),public.save_table(uuid,integer),public.mark_order_paid(uuid,integer,text,text) to authenticated;
