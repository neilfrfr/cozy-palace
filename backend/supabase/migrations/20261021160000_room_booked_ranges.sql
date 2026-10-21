-- Booked date ranges per room, so date pickers can grey out nights that are
-- already taken. Uses the same blocking rule as private.available and returns
-- only room ids and dates, never who booked them.
create function private.booked_ranges(p_from date,p_to date,p_exclude uuid) returns table(room_id uuid,check_in date,check_out date) language plpgsql stable security definer set search_path='' as $$
begin
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>400 then raise exception 'INVALID_INPUT';end if;
 return query select b.room_id,b.check_in,b.check_out from public.room_bookings b join public.reservations r on r.id=b.reservation_id where b.blocks_inventory and (r.status<>'pending' or r.hold_expires_at>now()) and (p_exclude is null or r.id<>p_exclude) and daterange(b.check_in,b.check_out,'[)') && daterange(p_from,p_to,'[)') order by b.room_id,b.check_in;
end $$;
revoke execute on function private.booked_ranges(date,date,uuid) from public;
grant execute on function private.booked_ranges(date,date,uuid) to anon,authenticated;
create function public.room_booked_ranges(p_from date,p_to date,p_exclude_reservation uuid default null) returns table(room_id uuid,check_in date,check_out date) language sql stable security invoker set search_path='' as $$select * from private.booked_ranges(p_from,p_to,p_exclude_reservation)$$;
revoke execute on function public.room_booked_ranges(date,date,uuid) from public;
grant execute on function public.room_booked_ranges(date,date,uuid) to anon,authenticated;
