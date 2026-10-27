-- Disposable PostgreSQL CI database ONLY. No production data or real credentials.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
grant usage on schema public,auth to anon,authenticated,service_role;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function auth.role() returns text language sql stable as $$
 select nullif(current_setting('request.jwt.claim.role',true),'')
$$;
-- Reproduce broad Supabase defaults so backend-only migrations must revoke them.
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
create table public.exhibition_admin_profiles(user_id uuid primary key references auth.users(id),role text not null);
create table public.trade_events(id uuid primary key default gen_random_uuid(),publication_status text not null default 'draft' check(publication_status in('draft','published','archived')));
insert into auth.users values('00000000-0000-4000-8000-000000000001');
insert into public.exhibition_admin_profiles values('00000000-0000-4000-8000-000000000001','publisher');
insert into public.trade_events(publication_status) values('draft'),('published');
