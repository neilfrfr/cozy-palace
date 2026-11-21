create function private.delete_menu_item(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.menu_items;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
 select * into m from public.menu_items where id=p_id for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if exists(select 1 from public.order_items where menu_item_id=p_id) then
  raise exception 'ITEM_HAS_ORDERS';
 end if;
 delete from public.menu_items where id=p_id;
 perform private.log('menu_item_deleted',p_id,to_jsonb(m),null);
 return to_jsonb(m);
end $$;
revoke execute on function private.delete_menu_item(uuid) from public,anon,authenticated;
grant execute on function private.delete_menu_item(uuid) to authenticated;
create function public.delete_menu_item(p_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select private.delete_menu_item(p_id)
$$;
revoke execute on function public.delete_menu_item(uuid) from public,anon;
grant execute on function public.delete_menu_item(uuid) to authenticated;
