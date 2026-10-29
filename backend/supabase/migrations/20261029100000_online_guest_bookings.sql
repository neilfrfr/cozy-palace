-- Visitors book a room without an account. The booking is reached only through a private link whose
-- token is shown once; the database keeps its SHA-256. All of these run as service_role from the app
-- server, which passes the visitor's IP for rate limiting.
alter table public.reservations alter column created_by drop not null, add column guest_token_hash bytea unique;
alter table public.reservations drop constraint reservation_channel_owner;
alter table public.reservations add constraint reservation_channel_owner check(
 (booking_source='customer_online' and customer_id is not null and created_by=customer_id and guest_full_name is null and guest_email is null and guest_phone is null and guest_token_hash is null) or
 (booking_source='staff_guest' and customer_id is null and created_by is not null and guest_full_name is not null and length(btrim(guest_full_name)) between 1 and 100 and guest_token_hash is null) or
 (booking_source='guest_online' and customer_id is null and created_by is null and guest_token_hash is not null and guest_full_name is not null and length(btrim(guest_full_name)) between 1 and 100 and guest_email is not null and guest_phone is not null));
create unique index reservation_online_guest_request on public.reservations(idempotency_key) where booking_source='guest_online';
create index reservation_online_guest_email on public.reservations(guest_email) where booking_source='guest_online' and status='pending';
create table private.guest_booking_attempts(ip text not null, at timestamptz not null default now());
create index guest_booking_attempt_ip on private.guest_booking_attempts(ip,at);
grant usage on schema private to service_role;

create function private.book_as_guest(p_room uuid,p_start date,p_end date,p_guests integer,p_name text,p_email text,p_phone text,p_key uuid,p_ip text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reservations; payload jsonb; capacity integer; price numeric(12,2); token text;
begin
 p_name:=btrim(p_name);p_email:=lower(btrim(p_email));p_phone:=btrim(p_phone);
 if p_key is null or p_ip is null or p_name is null or length(p_name) not between 1 and 100 or p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  or p_phone is null or length(p_phone) not between 1 and 32 then raise exception 'INVALID_INPUT';end if;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 perform pg_advisory_xact_lock(hashtextextended('guest'||p_key::text,0));
 payload:=jsonb_build_object('room',p_room,'start',p_start,'end',p_end,'guests',p_guests,'name',p_name,'email',p_email,'phone',p_phone);
 select * into r from public.reservations where booking_source='guest_online' and idempotency_key=p_key;
 if found then
  -- Only the page that generated the key can replay it; a fresh link replaces one it never received.
  if r.original_request<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  update public.reservations set guest_token_hash=sha256(convert_to(token,'UTF8')) where id=r.id;
  return jsonb_build_object('id',r.id,'reference',r.reference,'token',token);
 end if;
 if p_start is null or p_end is null or p_guests is null or p_guests not between 1 and 20 or p_end<=p_start or p_end-p_start>365
  or p_start<=(now() at time zone 'Asia/Manila')::date then raise exception 'INVALID_INPUT';end if;
 if (select count(*) from private.guest_booking_attempts where ip=p_ip and at>now()-interval '1 hour')>=5
  or (select count(*) from public.reservations where booking_source='guest_online' and status='pending' and guest_email=p_email and hold_expires_at>now())>=2 then raise exception 'RATE_LIMITED';end if;
 insert into private.guest_booking_attempts(ip) values(p_ip);
 perform 1 from public.rooms where id=p_room for update;
 with expired as (
  update public.reservations x set status='expired',version=x.version+1 where x.status='pending' and x.hold_expires_at<=now() and exists(select 1 from public.room_bookings b where b.reservation_id=x.id and b.room_id=p_room) returning x.id
 ), released as (
  update public.room_bookings set blocks_inventory=false where reservation_id in(select id from expired) returning reservation_id
 ) insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id) select null,'System','system','hold_expired',reservation_id from released;
 select t.capacity,t.nightly_rate into capacity,price from public.rooms rm join public.room_types t on t.id=rm.room_type_id where rm.id=p_room and rm.operational_state='available';
 if not found then raise exception 'RESOURCE_UNAVAILABLE';end if;
 if p_guests>capacity then raise exception 'CAPACITY_EXCEEDED';end if;
 insert into public.reservations(customer_id,booking_source,created_by,guest_full_name,guest_email,guest_phone,guest_token_hash,status,guests,total,idempotency_key,original_request,hold_expires_at)
 values(null,'guest_online',null,p_name,p_email,p_phone,sha256(convert_to(token,'UTF8')),'pending',p_guests,price*(p_end-p_start),p_key,payload,least(now()+interval '24 hours',p_start::timestamp at time zone 'Asia/Manila')) returning * into r;
 insert into public.room_bookings(reservation_id,room_id,check_in,check_out,rate_at_booking,blocks_inventory) values(r.id,p_room,p_start,p_end,price,true);
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,after_values)
 values(null,p_name,'guest','guest_online_created',r.id,to_jsonb(r)-'guest_email'-'guest_phone'-'original_request'-'guest_token_hash');
 return jsonb_build_object('id',r.id,'reference',r.reference,'token',token);
exception when exclusion_violation then raise exception 'AVAILABILITY_CONFLICT' using errcode='23P01';
end $$;

-- Locks and returns the booking a link points to.
create function private.guest_link(p_token text) returns public.reservations language plpgsql security definer set search_path='' as $$
declare r public.reservations;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'NOT_FOUND';end if;
 select * into r from public.reservations where guest_token_hash=sha256(convert_to(p_token,'UTF8')) for update;
 if not found then raise exception 'NOT_FOUND';end if;
 return r;
end $$;

create function private.guest_reservation(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reservations:=private.guest_link(p_token);
begin
 return (to_jsonb(r)-'guest_token_hash'-'original_request'-'idempotency_key')||jsonb_build_object('room_bookings',
  (select coalesce(jsonb_agg(jsonb_build_object('room_id',b.room_id,'check_in',b.check_in,'check_out',b.check_out,'rate_at_booking',b.rate_at_booking,
   'room_number',rm.room_number,'room_type',t.name)),'[]') from public.room_bookings b join public.rooms rm on rm.id=b.room_id join public.room_types t on t.id=rm.room_type_id where b.reservation_id=r.id));
end $$;

-- Unpaid requests only; once paid, cancelling means a refund, which staff handle.
create function private.cancel_guest_booking(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reservations:=private.guest_link(p_token);
begin
 if r.status<>'pending' or exists(select 1 from public.payments p where p.reservation_id=r.id and p.status<>'open') then raise exception 'POLICY_RESTRICTED';end if;
 update public.reservations set status='cancelled',version=version+1,hold_expires_at=null where id=r.id returning * into r;
 update public.room_bookings set blocks_inventory=false where reservation_id=r.id;
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,before_values,after_values)
 values(null,r.guest_full_name,'guest','cancelled',r.id,jsonb_build_object('status','pending'),jsonb_build_object('status','cancelled'));
 return jsonb_build_object('id',r.id,'status',r.status);
end $$;

-- Same rules as private.open_payment, reached by link instead of by account.
create function private.open_guest_payment(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reservations:=private.guest_link(p_token); p public.payments;
begin
 if r.kind<>'hotel' or r.status<>'pending' or r.hold_expires_at<=now() or r.total<=0
  or exists(select 1 from public.payments x where x.reservation_id=r.id and x.status='paid') then raise exception 'INVALID_TRANSITION';end if;
 insert into public.payments(reservation_id,amount) values(r.id,r.total) returning * into p;
 return jsonb_build_object('id',p.id,'amount',p.amount,'reference',r.reference);
end $$;

revoke execute on function private.book_as_guest(uuid,date,date,integer,text,text,text,uuid,text),private.guest_link(text),private.guest_reservation(text),private.cancel_guest_booking(text),private.open_guest_payment(text) from public,anon,authenticated;
grant execute on function private.book_as_guest(uuid,date,date,integer,text,text,text,uuid,text),private.guest_link(text),private.guest_reservation(text),private.cancel_guest_booking(text),private.open_guest_payment(text) to service_role;
create function public.book_as_guest(p_room_id uuid,p_check_in date,p_check_out date,p_guests integer,p_guest_full_name text,p_guest_email text,p_guest_phone text,p_idempotency_key uuid,p_client_ip text) returns jsonb language sql security invoker set search_path='' as $$select private.book_as_guest(p_room_id,p_check_in,p_check_out,p_guests,p_guest_full_name,p_guest_email,p_guest_phone,p_idempotency_key,p_client_ip)$$;
create function public.guest_reservation(p_token text) returns jsonb language sql security invoker set search_path='' as $$select private.guest_reservation(p_token)$$;
create function public.cancel_guest_booking(p_token text) returns jsonb language sql security invoker set search_path='' as $$select private.cancel_guest_booking(p_token)$$;
create function public.open_guest_payment(p_token text) returns jsonb language sql security invoker set search_path='' as $$select private.open_guest_payment(p_token)$$;
revoke execute on function public.book_as_guest(uuid,date,date,integer,text,text,text,uuid,text),public.guest_reservation(text),public.cancel_guest_booking(text),public.open_guest_payment(text) from public,anon,authenticated;
grant execute on function public.book_as_guest(uuid,date,date,integer,text,text,text,uuid,text),public.guest_reservation(text),public.cancel_guest_booking(text),public.open_guest_payment(text) to service_role;
