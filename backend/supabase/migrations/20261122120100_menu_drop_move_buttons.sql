-- Apply only after the drag-to-reorder frontend is live: the up/down buttons were the last callers.
drop function public.move_menu_item(uuid,boolean);
drop function private.move_menu_item(uuid,boolean);
drop function public.move_menu_section(uuid,boolean);
drop function private.move_menu_section(uuid,boolean);
