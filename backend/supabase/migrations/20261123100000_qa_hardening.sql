-- Payments and refunds are read through RLS and written only by SECURITY DEFINER functions,
-- so the API roles need SELECT (signed-in) and nothing else.
revoke all on public.payments, public.refunds from anon, authenticated;
grant select on public.payments, public.refunds to authenticated;

-- The dashboard's "auto-enable RLS" helper runs from its event trigger; nobody should call it over the API.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
