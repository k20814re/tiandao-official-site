-- READ-ONLY SECURITY AUDIT: inspect staging schema before any migration.
-- No writes. Results require human review; absence of a row is not proof of safety.
-- Execute in Supabase SQL Editor on an isolated staging project.
select 'trade_events_rls' as check_name, c.relname as object_name,
       c.relrowsecurity::text as detail
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='trade_events'
union all
select 'trade_events_policy', p.policyname,
       concat('cmd=',p.cmd,' roles=',array_to_string(p.roles,','),
              ' using=',coalesce(p.qual,'<none>'),
              ' check=',coalesce(p.with_check,'<none>'))
from pg_policies p
where p.schemaname='public' and p.tablename='trade_events'
union all
select 'trade_events_trigger', t.tgname,
       pg_get_triggerdef(t.oid)
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='trade_events' and not t.tgisinternal
order by check_name,object_name;

-- Show grants that may permit a browser client to modify trade_events.
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema='public' and table_name='trade_events'
order by grantee, privilege_type;

-- SECURITY DEFINER functions may bypass normal client RLS assumptions.
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer,
       pg_get_userbyid(p.proowner) as owner,
       p.proconfig as function_settings
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and (p.proname ilike '%exhibition%' or p.proname ilike '%trade_event%')
order by p.proname;

-- Expected pre-deployment observations:
-- * If trade_events_prepare_v1 permits publisher publication without MFA,
--   production publication is NOT protected by the proposed draft freeze.
-- * Review every permissive RLS policy, not only policies created by admin_v1.
-- * Review existing SECURITY DEFINER functions and table grants.
-- * Do not treat these queries as a substitute for staging role-based tests.
