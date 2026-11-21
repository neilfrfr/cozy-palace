alter table public.menu_items
  add column description text not null default ''
  check (char_length(description) <= 500);

create function private.save_menu_item(
  p_id uuid,
  p_name text,
  p_section text,
  p_price numeric,
  p_available boolean,
  p_description text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare m public.menu_items; old jsonb;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
 if p_price is null or p_price < 0 or p_price > 100000
    or p_available is null or p_description is null
    or char_length(p_description) > 500 then
   raise exception 'INVALID_INPUT';
 end if;
 if p_id is null then
  insert into public.menu_items(name,section,price,available,description)
  values(btrim(p_name),p_section,p_price,p_available,btrim(p_description))
  returning * into m;
 else
  select * into m from public.menu_items where id=p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  old:=to_jsonb(m);
  update public.menu_items
  set name=btrim(p_name),section=p_section,price=p_price,
      available=p_available,description=btrim(p_description)
  where id=p_id returning * into m;
 end if;
 perform private.log(
   case when p_id is null then 'menu_item_created' else 'menu_item_updated' end,
   m.id,old,to_jsonb(m)
 );
 return to_jsonb(m);
exception when check_violation or not_null_violation or unique_violation then
 raise exception 'INVALID_INPUT';
end
$$;

revoke execute on function private.save_menu_item(uuid,text,text,numeric,boolean,text)
  from public,anon;
grant execute on function private.save_menu_item(uuid,text,text,numeric,boolean,text)
  to authenticated;

create function public.save_menu_item(
  p_id uuid,
  p_name text,
  p_section text,
  p_price numeric,
  p_available boolean,
  p_description text
) returns jsonb
language sql security invoker set search_path=''
as $$
  select private.save_menu_item(p_id,p_name,p_section,p_price,p_available,p_description)
$$;
revoke execute on function public.save_menu_item(uuid,text,text,numeric,boolean,text)
  from public,anon;
grant execute on function public.save_menu_item(uuid,text,text,numeric,boolean,text)
  to authenticated;
