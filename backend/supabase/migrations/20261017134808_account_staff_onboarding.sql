-- Additive onboarding migration. Public registration never selects a role.
alter table public.profiles add column phone text not null default '' check(length(phone)<=30);
create table public.staff_members (
 id uuid primary key default gen_random_uuid(),
 email text unique not null check(email=lower(btrim(email)) and length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 full_name text not null check(length(btrim(full_name)) between 1 and 100),
 job_title text not null check(length(btrim(job_title)) between 1 and 100),
 user_id uuid unique references public.profiles(id),
 state text not null default 'pending' check(state in('pending','active')),
 version integer not null default 1,
 created_at timestamptz not null default now(),
 check((state='pending' and user_id is null) or (state='active' and user_id is not null))
);
alter table public.staff_members enable row level security;
revoke all on public.staff_members from anon,authenticated;
grant select on public.staff_members to authenticated;
create policy admin_staff_directory on public.staff_members for select to authenticated using(private.is_admin());
-- Existing trusted staff remain visible; admin authority itself is never edited here.
insert into public.staff_members(email,full_name,job_title,user_id,state)
 select lower(btrim(u.email)),coalesce(nullif(btrim(p.full_name),''),'Staff'),'Staff',p.id,'active'
 from public.staff_roles r join public.profiles p on p.id=r.user_id join auth.users u on u.id=p.id
 where r.role='staff' and u.email is not null;

create function private.account_audit(p_action text,p_record uuid,p_before jsonb,p_after jsonb)
returns void language sql security definer set search_path='' as $$
 insert into public.audit_logs(actor_id,actor_name,actor_role,action,record_id,before_values,after_values)
 select p.id,p.full_name,coalesce(r.role,'customer'),p_action,p_record,p_before,p_after
 from public.profiles p left join public.staff_roles r on r.user_id=p.id where p.id=auth.uid()
$$;
revoke all on function private.account_audit(text,uuid,jsonb,jsonb) from public,anon,authenticated;

create function private.manage_staff(p_op text,p_id uuid,p_version integer,p_email text,p_name text,p_title text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare member public.staff_members; previous jsonb;
begin
 -- Serialize staffing changes with invitation acceptance to avoid revoke/accept races.
 perform pg_advisory_xact_lock(75020261020);
 if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
 if p_op='create' then
  p_email:=lower(btrim(p_email));
 else
  select * into member from public.staff_members where id=p_id for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if p_version is null or member.version<>p_version then raise exception 'VERSION_CONFLICT';end if;
  previous:=to_jsonb(member);
  if exists(select 1 from public.staff_roles where user_id=member.user_id and role='admin') or exists(select 1 from auth.users u join public.staff_roles r on r.user_id=u.id where lower(u.email)=member.email and r.role='admin') then raise exception 'PROTECTED_ADMIN';end if;
 end if;
 if p_op in('create','update') and (p_name is null or length(btrim(p_name)) not between 1 and 100 or p_title is null or length(btrim(p_title)) not between 1 and 100) then raise exception 'INVALID_INPUT';end if;
 if p_op='create' then
  if p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'INVALID_INPUT';end if;
  if exists(select 1 from auth.users u join public.staff_roles r on r.user_id=u.id where lower(btrim(u.email))=p_email and r.role='admin') then raise exception 'PROTECTED_ADMIN';end if;
  insert into public.staff_members(email,full_name,job_title) values(p_email,btrim(p_name),btrim(p_title)) returning * into member;
 elsif p_op='update' then
  update public.staff_members set full_name=btrim(p_name),job_title=btrim(p_title),version=version+1 where id=p_id returning * into member;
  if member.user_id is not null then update public.profiles set full_name=member.full_name where id=member.user_id;end if;
 elsif p_op='delete' then
  delete from public.staff_roles where user_id=member.user_id and role='staff';
  delete from public.staff_members where id=member.id;
 else raise exception 'INVALID_INPUT';end if;
 perform private.account_audit('staff_'||case p_op when 'create' then 'created' when 'update' then 'updated' else 'deleted' end,member.id,previous,case when p_op='delete' then null else to_jsonb(member) end);
 return to_jsonb(member);
exception when unique_violation then raise exception 'DUPLICATE_EMAIL';
end $$;
revoke all on function private.manage_staff(text,uuid,integer,text,text,text) from public,anon;
grant execute on function private.manage_staff(text,uuid,integer,text,text,text) to authenticated;

create function private.accept_staff() returns boolean language plpgsql security definer set search_path='' as $$
declare u auth.users; member public.staff_members;
begin
 perform pg_advisory_xact_lock(75020261020);
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 select * into u from auth.users where id=auth.uid();
 select * into member from public.staff_members where email=lower(btrim(u.email)) for update;
 if not found then return false;end if;
 if u.email_confirmed_at is null then raise exception 'EMAIL_NOT_VERIFIED';end if;
 if member.user_id is not null and member.user_id<>u.id then raise exception 'FORBIDDEN';end if;
 if exists(select 1 from public.staff_roles where user_id=u.id and role='admin') then return true;end if;
 if member.state='active' then return true;end if;
 insert into public.staff_roles(user_id,role) values(u.id,'staff') on conflict(user_id) do nothing;
 update public.profiles set full_name=member.full_name where id=u.id;
 update public.staff_members set user_id=u.id,state='active',version=version+1 where id=member.id returning * into member;
 perform private.account_audit('staff_activated',member.id,null,to_jsonb(member));
 return true;
end $$;
revoke all on function private.accept_staff() from public,anon;
grant execute on function private.accept_staff() to authenticated;

create function private.edit_profile(p_name text,p_phone text) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_profile public.profiles; result public.profiles;
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 100 or length(coalesce(p_phone,''))>30 or coalesce(p_phone,'') !~ '^[0-9+() .-]*$' then raise exception 'INVALID_INPUT';end if;
 select * into old_profile from public.profiles where id=auth.uid() for update;
 update public.profiles set full_name=btrim(p_name),phone=btrim(coalesce(p_phone,'')) where id=auth.uid() returning * into result;
 perform private.account_audit('profile_updated',auth.uid(),to_jsonb(old_profile),to_jsonb(result));return to_jsonb(result);
end $$;
revoke all on function private.edit_profile(text,text) from public,anon;
grant execute on function private.edit_profile(text,text) to authenticated;
create function public.create_staff_member(p_email text,p_name text,p_title text) returns jsonb language sql security invoker set search_path='' as $$select private.manage_staff('create',null,null,p_email,p_name,p_title)$$;
create function public.update_staff_member(p_id uuid,p_version integer,p_name text,p_title text) returns jsonb language sql security invoker set search_path='' as $$select private.manage_staff('update',p_id,p_version,null,p_name,p_title)$$;
create function public.delete_staff_member(p_id uuid,p_version integer) returns jsonb language sql security invoker set search_path='' as $$select private.manage_staff('delete',p_id,p_version,null,null,null)$$;
create function public.accept_staff_invitation() returns boolean language sql security invoker set search_path='' as $$select private.accept_staff()$$;
create function public.update_profile(p_name text,p_phone text) returns jsonb language sql security invoker set search_path='' as $$select private.edit_profile(p_name,p_phone)$$;
revoke all on function public.create_staff_member(text,text,text),public.update_staff_member(uuid,integer,text,text),public.delete_staff_member(uuid,integer),public.accept_staff_invitation(),public.update_profile(text,text) from public,anon;
grant execute on function public.create_staff_member(text,text,text),public.update_staff_member(uuid,integer,text,text),public.delete_staff_member(uuid,integer),public.accept_staff_invitation(),public.update_profile(text,text) to authenticated;
