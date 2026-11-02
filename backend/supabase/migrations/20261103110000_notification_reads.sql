-- FR09: the email sender (frontend/lib/notifications.ts) reads the booking as service_role to write each email.
-- Hosted Supabase does not grant service_role these tables by default, so every send failed with "Booking not found".
grant select on public.reservations, public.profiles, public.room_bookings, public.table_bookings to service_role;
