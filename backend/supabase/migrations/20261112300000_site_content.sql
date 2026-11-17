-- Client #8/#9: admin-editable website text and photo URLs. A missing row means the page uses its built-in default.
create table public.site_content (
 key text primary key check(key ~ '^[a-z0-9]+(\.[a-z0-9-]+)+$' and length(key)<=100),
 value text not null check(length(value)<=2000),
 updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
create policy public_site_content on public.site_content for select to anon,authenticated using(true);
create policy admin_site_content on public.site_content for all to authenticated using(private.is_admin()) with check(private.is_admin());
revoke all on public.site_content from anon,authenticated;
grant select on public.site_content to anon,authenticated;
grant insert,update,delete on public.site_content to authenticated;

-- Placeholder contact details for the admin to replace from the Website page.
insert into public.site_content(key,value) values
 ('contact.phone','+63 2 8123 4567'),
 ('contact.email','hello@cozypalace.example'),
 ('contact.address','123 Placeholder Street, Makati City, Metro Manila, Philippines'),
 ('contact.hours',E'Front desk: open 24 hours\nRestaurant: 11:00–14:00 and 17:00–21:00')
on conflict(key) do nothing;
