-- Tables can be renamed and deleted, and extras deleted, with the same rule as rooms:
-- anything with booking history is kept (deactivate an extra instead).

drop function public.save_table(uuid, integer);
drop function private.save_table(uuid, integer);
-- p_table_number null keeps the current number, so older callers still work.
create function private.save_table(p_id uuid, p_capacity integer, p_table_number text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.restaurant_tables; old jsonb;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if p_capacity is null or p_capacity not between 1 and 20
  or (p_table_number is not null and length(btrim(p_table_number)) not between 1 and 30) then raise exception 'INVALID_INPUT';end if;
 select * into t from public.restaurant_tables where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 old:=to_jsonb(t);
 update public.restaurant_tables set capacity=p_capacity, table_number=coalesce(btrim(p_table_number), table_number)
  where id=p_id returning * into t;
 perform private.log('table_updated',t.id,old,to_jsonb(t));
 return to_jsonb(t);
exception
 when unique_violation then raise exception 'DUPLICATE_INVENTORY';
 when check_violation then raise exception 'INVALID_INPUT';
end $$;
revoke execute on function private.save_table(uuid,integer,text) from public,anon;
grant execute on function private.save_table(uuid,integer,text) to authenticated;
create function public.save_table(p_id uuid, p_capacity integer, p_table_number text default null) returns jsonb language sql security invoker set search_path='' as $$
 select private.save_table(p_id, p_capacity, p_table_number)
$$;
revoke execute on function public.save_table(uuid,integer,text) from public,anon;
grant execute on function public.save_table(uuid,integer,text) to authenticated;

create function private.delete_table(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.restaurant_tables;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 select * into t from public.restaurant_tables where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if exists(select 1 from public.table_bookings where table_id=p_id) then raise exception 'TABLE_IN_USE';end if;
 delete from public.resource_blocks where table_id=p_id;
 delete from public.restaurant_tables where id=p_id;
 perform private.log('table_deleted',t.id,to_jsonb(t),null);
 return to_jsonb(t);
end $$;
revoke execute on function private.delete_table(uuid) from public,anon;
grant execute on function private.delete_table(uuid) to authenticated;
create function public.delete_table(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$
 select private.delete_table(p_id)
$$;
revoke execute on function public.delete_table(uuid) from public,anon;
grant execute on function public.delete_table(uuid) to authenticated;

create function private.delete_extra(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.extras;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 select * into e from public.extras where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if exists(select 1 from public.reservation_extras where extra_id=p_id) then raise exception 'EXTRA_IN_USE';end if;
 delete from public.extras where id=p_id;
 perform private.log('extra_deleted',e.id,to_jsonb(e),null);
 return to_jsonb(e);
end $$;
revoke execute on function private.delete_extra(uuid) from public,anon;
grant execute on function private.delete_extra(uuid) to authenticated;
create function public.delete_extra(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$
 select private.delete_extra(p_id)
$$;
revoke execute on function public.delete_extra(uuid) from public,anon;
grant execute on function public.delete_extra(uuid) to authenticated;
