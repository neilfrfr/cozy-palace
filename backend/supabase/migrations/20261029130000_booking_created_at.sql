-- When each room and table booking line was made, for staff logs. Existing lines take their reservation's time.
alter table public.room_bookings add column created_at timestamptz not null default now();
alter table public.table_bookings add column created_at timestamptz not null default now();
update public.room_bookings b set created_at=r.created_at from public.reservations r where r.id=b.reservation_id;
update public.table_bookings b set created_at=r.created_at from public.reservations r where r.id=b.reservation_id;
