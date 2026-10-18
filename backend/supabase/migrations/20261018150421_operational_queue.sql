-- SECURITY INVOKER preserves RLS; role checks deny customer use of operational search.
create function public.operational_queue(p_query text,p_date date,p_status text,p_source text,p_page integer,p_staying boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 if not private.is_staff() then raise exception 'FORBIDDEN';end if;
 if p_query is null or length(p_query)>100 or p_page is null or p_page not between 1 and 10000 or p_staying is null or (p_status is not null and p_status not in('pending','confirmed','checked_in','completed','cancelled','expired')) or (p_source is not null and p_source not in('customer_online','staff_guest')) then raise exception 'INVALID_INPUT';end if;
 with matching as (
 select r.*,c.full_name customer_name,a.full_name creator_name,b.room_id,b.check_in,b.check_out,b.rate_at_booking,rm.room_number,t.name room_type_name
 from public.reservations r join public.room_bookings b on b.reservation_id=r.id join public.rooms rm on rm.id=b.room_id join public.room_types t on t.id=rm.room_type_id left join public.profiles c on c.id=r.customer_id left join public.profiles a on a.id=r.created_by
 where r.kind='hotel' and r.status<>'draft' and (p_status is null or r.status=p_status) and (p_source is null or r.booking_source=p_source)
 and (p_date is null or (not p_staying and b.check_in=p_date) or (p_staying and b.check_in<=p_date and b.check_out>p_date))
 and (p_query='' or position(lower(p_query) in lower(r.reference))>0 or position(lower(p_query) in lower(coalesce(r.guest_full_name,c.full_name,'')))>0)
 ), paged as(select * from matching order by created_at desc,id limit 20 offset (p_page-1)*20)
 select jsonb_build_object('count',(select count(*) from matching),'rows',coalesce((select jsonb_agg((to_jsonb(p)-'original_request'-'room_id'-'check_in'-'check_out'-'rate_at_booking')||jsonb_build_object('room_bookings',jsonb_build_array(jsonb_build_object('room_id',p.room_id,'check_in',p.check_in,'check_out',p.check_out,'rate_at_booking',p.rate_at_booking))) order by p.created_at desc,p.id) from paged p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke execute on function public.operational_queue(text,date,text,text,integer,boolean) from public,anon;
grant execute on function public.operational_queue(text,date,text,text,integer,boolean) to authenticated;
