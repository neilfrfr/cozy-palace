-- Step 1 of 2: drop the "On website" option. Adds a save function without it, so the
-- new frontend works before the old column and function go (step 2, after deploy).
create function private.save_menu_item(p_id uuid,p_name text,p_description text,p_section text,p_price numeric,p_available boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.menu_items; old jsonb;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 80
  or p_description is null or length(btrim(p_description))>500
  or p_section is null or p_price is null or p_price<0 or p_price>100000 or p_available is null then
  raise exception 'INVALID_INPUT';
 end if;
 if p_id is null then
  insert into public.menu_items(name,description,section,price,available,position)
  values(btrim(p_name),btrim(p_description),p_section,p_price,p_available,
   (select coalesce(max(position),0)+1 from public.menu_items where section=p_section)) returning * into m;
 else
  select * into m from public.menu_items where id=p_id and not archived for update;
  if not found then raise exception 'NOT_FOUND';end if;
  old:=to_jsonb(m);
  update public.menu_items set name=btrim(p_name),description=btrim(p_description),section=p_section,price=p_price,
   available=p_available,
   position=case when section=p_section then position
    else (select coalesce(max(position),0)+1 from public.menu_items where section=p_section) end
   where id=p_id returning * into m;
 end if;
 perform private.log(case when p_id is null then 'menu_item_created' else 'menu_item_updated' end,m.id,old,to_jsonb(m));
 return to_jsonb(m);
exception
 when unique_violation then raise exception 'DUPLICATE_NAME';
 when check_violation or not_null_violation or foreign_key_violation then raise exception 'INVALID_INPUT';
end $$;
revoke execute on function private.save_menu_item(uuid,text,text,text,numeric,boolean) from public,anon;
grant execute on function private.save_menu_item(uuid,text,text,text,numeric,boolean) to authenticated;
create function public.save_menu_item(p_id uuid,p_name text,p_description text,p_section text,p_price numeric,p_available boolean)
returns jsonb language sql security invoker set search_path='' as $$
 select private.save_menu_item(p_id,p_name,p_description,p_section,p_price,p_available)
$$;
revoke execute on function public.save_menu_item(uuid,text,text,text,numeric,boolean) from public,anon;
grant execute on function public.save_menu_item(uuid,text,text,text,numeric,boolean) to authenticated;
