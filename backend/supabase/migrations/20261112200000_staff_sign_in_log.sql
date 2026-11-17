-- FR11: staff and admin sign-ins go to the activity log. A shift runs from the first sign-in of the Manila day to its end.
-- Customers are ignored, so the auth callback can call this after any email link.
create function private.log_sign_in() returns void language plpgsql security definer set search_path='' as $$
begin
 if private.is_staff() then perform private.log('signed_in',auth.uid(),null,null);end if;
end $$;
revoke execute on function private.log_sign_in() from public,anon;
grant execute on function private.log_sign_in() to authenticated;
create function public.log_sign_in() returns void language sql security invoker set search_path='' as $$select private.log_sign_in()$$;
revoke execute on function public.log_sign_in() from public,anon;
grant execute on function public.log_sign_in() to authenticated;

-- My Activity: staff read their own log rows; admins keep reading every row through admin_logs.
create policy own_staff_logs on public.audit_logs for select to authenticated using(actor_id=auth.uid() and private.is_staff());
-- FR10: admins list every employee, admins included, for the activity log's employee filter.
create policy admin_roles on public.staff_roles for select to authenticated using(private.is_admin());
