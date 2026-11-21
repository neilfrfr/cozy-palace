-- Admin-tailored menu: editable sections, manual ordering, a website toggle, and archive/restore.
-- Items already on an order can't be hard-deleted (order_items FK), so "delete" archives them.

create table public.menu_sections (
 id uuid primary key default gen_random_uuid(),
 name text unique not null check(length(btrim(name)) between 1 and 40),
 description text not null default '' check(length(description)<=200),
 position integer not null default 0
);
insert into public.menu_sections(name,description,position) values
 ('Appetizers','A thoughtful beginning, prepared to awaken the palate.',1),
 ('Main Course','Seasonal favorites and generous plates from our kitchen.',2),
 ('Dessert','A sweet finish, made for sharing and savoring.',3),
 ('Drinks','Refreshing pours and carefully chosen favorites.',4);
alter table public.menu_sections enable row level security;
create policy public_menu_sections on public.menu_sections for select to anon,authenticated using(true);
revoke all on public.menu_sections from anon,authenticated;
grant select on public.menu_sections to anon,authenticated;

alter table public.menu_items drop constraint menu_items_section_check;
-- Renaming a section carries its items with it.
alter table public.menu_items add constraint menu_items_section_fkey
 foreign key(section) references public.menu_sections(name) on update cascade;
alter table public.menu_items
 add column archived boolean not null default false,
 add column on_website boolean not null default true,
 add column position integer not null default 0;
update public.menu_items m set position=r.n
 from (select id,row_number() over(partition by section order by name) n from public.menu_items) r where r.id=m.id;
-- An archived item's name can be reused by a new item.
alter table public.menu_items drop constraint menu_items_name_key;
create unique index menu_items_active_name on public.menu_items(name) where not archived;

-- Items
drop function public.save_menu_item(uuid,text,text,text,numeric,boolean);
drop function private.save_menu_item(uuid,text,text,text,numeric,boolean);
create function private.save_menu_item(p_id uuid,p_name text,p_description text,p_section text,p_price numeric,p_available boolean,p_on_website boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.menu_items; old jsonb;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 80
  or p_description is null or length(btrim(p_description))>500
  or p_section is null or p_price is null or p_price<0 or p_price>100000 or p_available is null or p_on_website is null then
  raise exception 'INVALID_INPUT';
 end if;
 if p_id is null then
  insert into public.menu_items(name,description,section,price,available,on_website,position)
  values(btrim(p_name),btrim(p_description),p_section,p_price,p_available,p_on_website,
   (select coalesce(max(position),0)+1 from public.menu_items where section=p_section)) returning * into m;
 else
  select * into m from public.menu_items where id=p_id and not archived for update;
  if not found then raise exception 'NOT_FOUND';end if;
  old:=to_jsonb(m);
  update public.menu_items set name=btrim(p_name),description=btrim(p_description),section=p_section,price=p_price,
   available=p_available,on_website=p_on_website,
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
revoke execute on function private.save_menu_item(uuid,text,text,text,numeric,boolean,boolean) from public,anon;
grant execute on function private.save_menu_item(uuid,text,text,text,numeric,boolean,boolean) to authenticated;
create function public.save_menu_item(p_id uuid,p_name text,p_description text,p_section text,p_price numeric,p_available boolean,p_on_website boolean)
returns jsonb language sql security invoker set search_path='' as $$
 select private.save_menu_item(p_id,p_name,p_description,p_section,p_price,p_available,p_on_website)
$$;
revoke execute on function public.save_menu_item(uuid,text,text,text,numeric,boolean,boolean) from public,anon;
grant execute on function public.save_menu_item(uuid,text,text,text,numeric,boolean,boolean) to authenticated;

-- Active item: archive it. Archived item: delete it for good, unless an order still uses it.
create or replace function private.delete_menu_item(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.menu_items;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 select * into m from public.menu_items where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if not m.archived then
  update public.menu_items set archived=true,available=false where id=p_id;
  perform private.log('menu_item_archived',m.id,to_jsonb(m),null);
 else
  if exists(select 1 from public.order_items where menu_item_id=p_id) then raise exception 'MENU_ITEM_IN_USE';end if;
  delete from public.site_content where key='photo.menu.'||p_id::text;
  delete from public.menu_items where id=p_id;
  perform private.log('menu_item_deleted',m.id,to_jsonb(m),null);
 end if;
 return to_jsonb(m);
end $$;

create function private.restore_menu_item(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.menu_items;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 update public.menu_items set archived=false,available=true,
  position=(select coalesce(max(position),0)+1 from public.menu_items x where x.section=menu_items.section and not x.archived)
  where id=p_id and archived returning * into m;
 if not found then raise exception 'NOT_FOUND';end if;
 perform private.log('menu_item_restored',m.id,null,to_jsonb(m));
 return to_jsonb(m);
exception when unique_violation then raise exception 'DUPLICATE_NAME';
end $$;
revoke execute on function private.restore_menu_item(uuid) from public,anon;
grant execute on function private.restore_menu_item(uuid) to authenticated;
create function public.restore_menu_item(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$
 select private.restore_menu_item(p_id)
$$;
revoke execute on function public.restore_menu_item(uuid) from public,anon;
grant execute on function public.restore_menu_item(uuid) to authenticated;

-- Swap an item with its neighbour in the same section.
create function private.move_menu_item(p_id uuid,p_up boolean) returns void language plpgsql security definer set search_path='' as $$
declare m public.menu_items; n public.menu_items;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 select * into m from public.menu_items where id=p_id and not archived for update;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into n from public.menu_items where section=m.section and not archived and id<>m.id
  and case when p_up then (position,name)<(m.position,m.name) else (position,name)>(m.position,m.name) end
  order by case when p_up then position end desc, case when p_up then name end desc,
   case when not p_up then position end, case when not p_up then name end
  limit 1 for update;
 if not found then return;end if;
 update public.menu_items set position=case when id=m.id then n.position else m.position end where id in(m.id,n.id);
 -- Equal positions would make the swap a no-op, so nudge the mover past its neighbour.
 if m.position=n.position then
  update public.menu_items set position=position+case when p_up then -1 else 1 end where id=m.id;
 end if;
 perform private.log('menu_reordered',m.id,null,null);
end $$;
revoke execute on function private.move_menu_item(uuid,boolean) from public,anon;
grant execute on function private.move_menu_item(uuid,boolean) to authenticated;
create function public.move_menu_item(p_id uuid,p_up boolean) returns void language sql security invoker set search_path='' as $$
 select private.move_menu_item(p_id,p_up)
$$;
revoke execute on function public.move_menu_item(uuid,boolean) from public,anon;
grant execute on function public.move_menu_item(uuid,boolean) to authenticated;

-- Sections
create function private.save_menu_section(p_id uuid,p_name text,p_description text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.menu_sections; old jsonb;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 40 or p_description is null or length(btrim(p_description))>200 then
  raise exception 'INVALID_INPUT';
 end if;
 if p_id is null then
  insert into public.menu_sections(name,description,position)
  values(btrim(p_name),btrim(p_description),(select coalesce(max(position),0)+1 from public.menu_sections)) returning * into s;
 else
  select * into s from public.menu_sections where id=p_id for update;
  if not found then raise exception 'NOT_FOUND';end if;
  old:=to_jsonb(s);
  update public.menu_sections set name=btrim(p_name),description=btrim(p_description) where id=p_id returning * into s;
 end if;
 perform private.log(case when p_id is null then 'menu_section_created' else 'menu_section_updated' end,s.id,old,to_jsonb(s));
 return to_jsonb(s);
exception when unique_violation then raise exception 'DUPLICATE_NAME';
end $$;
revoke execute on function private.save_menu_section(uuid,text,text) from public,anon;
grant execute on function private.save_menu_section(uuid,text,text) to authenticated;
create function public.save_menu_section(p_id uuid,p_name text,p_description text) returns jsonb language sql security invoker set search_path='' as $$
 select private.save_menu_section(p_id,p_name,p_description)
$$;
revoke execute on function public.save_menu_section(uuid,text,text) from public,anon;
grant execute on function public.save_menu_section(uuid,text,text) to authenticated;

-- Only an empty section can go. Its archived items move to the first remaining section.
create function private.delete_menu_section(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.menu_sections; other text;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 select * into s from public.menu_sections where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if exists(select 1 from public.menu_items where section=s.name and not archived) then raise exception 'SECTION_IN_USE';end if;
 select name into other from public.menu_sections where id<>p_id order by position,name limit 1;
 if other is null then raise exception 'LAST_SECTION';end if;
 update public.menu_items set section=other where section=s.name;
 delete from public.menu_sections where id=p_id;
 perform private.log('menu_section_deleted',s.id,to_jsonb(s),null);
 return to_jsonb(s);
end $$;
revoke execute on function private.delete_menu_section(uuid) from public,anon;
grant execute on function private.delete_menu_section(uuid) to authenticated;
create function public.delete_menu_section(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$
 select private.delete_menu_section(p_id)
$$;
revoke execute on function public.delete_menu_section(uuid) from public,anon;
grant execute on function public.delete_menu_section(uuid) to authenticated;

create function private.move_menu_section(p_id uuid,p_up boolean) returns void language plpgsql security definer set search_path='' as $$
declare s public.menu_sections; n public.menu_sections;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 select * into s from public.menu_sections where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into n from public.menu_sections where id<>s.id
  and case when p_up then (position,name)<(s.position,s.name) else (position,name)>(s.position,s.name) end
  order by case when p_up then position end desc, case when p_up then name end desc,
   case when not p_up then position end, case when not p_up then name end
  limit 1 for update;
 if not found then return;end if;
 update public.menu_sections set position=case when id=s.id then n.position else s.position end where id in(s.id,n.id);
 if s.position=n.position then
  update public.menu_sections set position=position+case when p_up then -1 else 1 end where id=s.id;
 end if;
 perform private.log('menu_reordered',s.id,null,null);
end $$;
revoke execute on function private.move_menu_section(uuid,boolean) from public,anon;
grant execute on function private.move_menu_section(uuid,boolean) to authenticated;
create function public.move_menu_section(p_id uuid,p_up boolean) returns void language sql security invoker set search_path='' as $$
 select private.move_menu_section(p_id,p_up)
$$;
revoke execute on function public.move_menu_section(uuid,boolean) from public,anon;
grant execute on function public.move_menu_section(uuid,boolean) to authenticated;
