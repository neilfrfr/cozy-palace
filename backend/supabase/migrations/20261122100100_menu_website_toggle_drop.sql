-- Step 2 of 2: apply only after the frontend without the "On website" option is live.
drop function public.save_menu_item(uuid,text,text,text,numeric,boolean,boolean);
drop function private.save_menu_item(uuid,text,text,text,numeric,boolean,boolean);
alter table public.menu_items drop column on_website;
