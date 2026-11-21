-- Drag-to-reorder saves a whole section's (or the section list's) new order in one call.
-- p_ids must be exactly the current set, so a stale page can't drop or duplicate rows.

create function private.reorder_menu_items(p_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare s text;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 select section into s from public.menu_items where id=p_ids[1] and not archived;
 if s is null
  or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x)
  or (select array_agg(id order by id) from public.menu_items where section=s and not archived)
     is distinct from (select array_agg(x order by x) from unnest(p_ids) x) then
  raise exception 'MENU_CHANGED';
 end if;
 update public.menu_items m set position=o.n from unnest(p_ids) with ordinality o(id,n) where m.id=o.id;
 perform private.log('menu_reordered',p_ids[1],null,jsonb_build_object('section',s,'order',to_jsonb(p_ids)));
end $$;
revoke execute on function private.reorder_menu_items(uuid[]) from public,anon;
grant execute on function private.reorder_menu_items(uuid[]) to authenticated;
create function public.reorder_menu_items(p_ids uuid[]) returns void language sql security invoker set search_path='' as $$
 select private.reorder_menu_items(p_ids)
$$;
revoke execute on function public.reorder_menu_items(uuid[]) from public,anon;
grant execute on function public.reorder_menu_items(uuid[]) to authenticated;

create function private.reorder_menu_sections(p_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if coalesce(cardinality(p_ids),0)=0
  or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x)
  or (select array_agg(id order by id) from public.menu_sections)
     is distinct from (select array_agg(x order by x) from unnest(p_ids) x) then
  raise exception 'MENU_CHANGED';
 end if;
 update public.menu_sections m set position=o.n from unnest(p_ids) with ordinality o(id,n) where m.id=o.id;
 perform private.log('menu_reordered',p_ids[1],null,jsonb_build_object('sections',to_jsonb(p_ids)));
end $$;
revoke execute on function private.reorder_menu_sections(uuid[]) from public,anon;
grant execute on function private.reorder_menu_sections(uuid[]) to authenticated;
create function public.reorder_menu_sections(p_ids uuid[]) returns void language sql security invoker set search_path='' as $$
 select private.reorder_menu_sections(p_ids)
$$;
revoke execute on function public.reorder_menu_sections(uuid[]) from public,anon;
grant execute on function public.reorder_menu_sections(uuid[]) to authenticated;
