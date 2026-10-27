-- Read-only security audit. No policy changes or writes.
-- Inspect this output before designing any RLS migration.
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies
where schemaname='public'
  and tablename in ('trade_events','trade_event_sources','exhibition_admin_profiles')
order by tablename,policyname;

select c.relname as table_name,c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
 ('trade_events','trade_event_sources','exhibition_admin_profiles');

select grantee,table_name,privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name in
 ('trade_events','trade_event_sources','exhibition_admin_profiles')
and grantee in ('anon','authenticated','service_role')
order by table_name,grantee,privilege_type;

select tgname,pg_get_triggerdef(t.oid) as trigger_definition
from pg_trigger t
where t.tgrelid='public.trade_events'::regclass and not t.tgisinternal
order by tgname;

select n.nspname,p.proname,pg_get_functiondef(p.oid) as function_definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
and p.proname in ('prepare_trade_event','exhibition_admin_role')
order by p.proname;

-- Verify that editor cannot change published -> draft/archived,
-- cannot insert publication_status='published', and cannot modify
-- published records without publisher rights.
-- IMPORTANT: SELECT/UPDATE policies alone cannot compare OLD vs NEW.
-- Trigger or a carefully designed server-side function may be necessary.
