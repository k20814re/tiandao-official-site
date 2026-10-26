-- DRAFT ONLY: run in staging after reviewing existing RLS policies.
-- Separate from the publication freeze. Does not grant publishing rights.
begin;
create or replace function public.exhibition_admin_role()
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p.role
  from public.exhibition_admin_profiles as p
  where p.user_id = (select auth.uid())
  limit 1
$$;
revoke all on function public.exhibition_admin_role() from public;
revoke all on function public.exhibition_admin_role() from anon;
grant execute on function public.exhibition_admin_role() to authenticated;

alter table public.exhibition_admin_profiles enable row level security;
revoke insert, update, delete on public.exhibition_admin_profiles from anon, authenticated;
grant select on public.exhibition_admin_profiles to authenticated;
drop policy if exists exhibition_profiles_read_self on public.exhibition_admin_profiles;
create policy exhibition_profiles_read_self
on public.exhibition_admin_profiles for select to authenticated
using (user_id = (select auth.uid()));

-- An admin profile must be provisioned out of band by a trusted operator.
-- Never accept a client-submitted role or bootstrap the first publisher
-- through an anonymous or authenticated browser request.
commit;
