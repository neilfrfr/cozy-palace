-- Admin-only inventory creation. Existing read policies make new resources bookable immediately.
create function private.create_room_type(
 p_name text,
 p_description text,
 p_capacity integer,
 p_nightly_rate numeric
) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.room_types;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 100
  or p_description is null or length(btrim(p_description))>500
  or p_capacity is null or p_capacity not between 1 and 20
  or p_nightly_rate is null or p_nightly_rate not between 0 and 1000000 then
  raise exception 'INVALID_INPUT';
 end if;
 insert into public.room_types(name,description,capacity,nightly_rate)
 values(btrim(p_name),btrim(p_description),p_capacity,p_nightly_rate)
 returning * into t;
 perform private.log('room_type_created',t.id,null,to_jsonb(t));
 return to_jsonb(t);
exception
 when check_violation then raise exception 'INVALID_INPUT';
end $$;

create function private.create_room(p_room_number text,p_room_type_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rooms;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if p_room_number is null or length(btrim(p_room_number)) not between 1 and 30 or p_room_type_id is null then
  raise exception 'INVALID_INPUT';
 end if;
 insert into public.rooms(room_number,room_type_id)
 values(btrim(p_room_number),p_room_type_id)
 returning * into r;
 perform private.log('room_created',r.id,null,to_jsonb(r));
 return to_jsonb(r);
exception
 when check_violation then raise exception 'INVALID_INPUT';
 when foreign_key_violation then raise exception 'NOT_FOUND';
end $$;

create function private.create_table(p_table_number text,p_capacity integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.restaurant_tables;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if p_table_number is null or length(btrim(p_table_number)) not between 1 and 30
  or p_capacity is null or p_capacity not between 1 and 20 then
  raise exception 'INVALID_INPUT';
 end if;
 insert into public.restaurant_tables(table_number,capacity)
 values(btrim(p_table_number),p_capacity)
 returning * into t;
 perform private.log('table_created',t.id,null,to_jsonb(t));
 return to_jsonb(t);
exception
 when check_violation then raise exception 'INVALID_INPUT';
end $$;

revoke execute on function private.create_room_type(text,text,integer,numeric),private.create_room(text,uuid),private.create_table(text,integer) from public,anon;
grant execute on function private.create_room_type(text,text,integer,numeric),private.create_room(text,uuid),private.create_table(text,integer) to authenticated;

create function public.create_room_type(p_name text,p_description text,p_capacity integer,p_nightly_rate numeric) returns jsonb language sql security invoker set search_path='' as $$select private.create_room_type(p_name,p_description,p_capacity,p_nightly_rate)$$;
create function public.create_room(p_room_number text,p_room_type_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.create_room(p_room_number,p_room_type_id)$$;
create function public.create_table(p_table_number text,p_capacity integer) returns jsonb language sql security invoker set search_path='' as $$select private.create_table(p_table_number,p_capacity)$$;

revoke execute on function public.create_room_type(text,text,integer,numeric),public.create_room(text,uuid),public.create_table(text,integer) from public,anon;
grant execute on function public.create_room_type(text,text,integer,numeric),public.create_room(text,uuid),public.create_table(text,integer) to authenticated;
