-- New bookings and orders get plain numbers in creation order, each from its own sequence.
-- Existing CP-/OR- codes are kept as they are and still match every lookup (exact text compare).
create sequence private.reservation_reference_seq as bigint no cycle;
create sequence private.order_reference_seq as bigint no cycle;
revoke all on sequence private.reservation_reference_seq, private.order_reference_seq from public, anon, authenticated;
-- Rows are only inserted by security definer functions, which run as the sequences' owner.
alter table public.reservations alter column reference set default nextval('private.reservation_reference_seq')::text;
alter table public.orders alter column reference set default nextval('private.order_reference_seq')::text;
