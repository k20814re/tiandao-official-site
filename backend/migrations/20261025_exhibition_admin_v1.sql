-- TianDao Commerce exhibition admin V1 (review before running; preserves existing rows)
begin;
create extension if not exists pgcrypto;
create table if not exists public.exhibition_admin_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('editor','publisher')),
 display_name text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.exhibition_admin_profiles enable row level security;
alter table public.trade_event_sources add column if not exists code text, add column if not exists name text, add column if not exists source_type text default 'manual', add column if not exists base_url text, add column if not exists country_code text default 'TW', add column if not exists is_active boolean not null default true, add column if not exists config jsonb not null default '{}'::jsonb;
create unique index if not exists trade_event_sources_code_uidx on public.trade_event_sources(code) where code is not null;
alter table public.trade_events add column if not exists source_id uuid references public.trade_event_sources(id), add column if not exists external_id text, add column if not exists publication_status text not null default 'draft', add column if not exists country_code text not null default 'TW', add column if not exists timezone text not null default 'Asia/Taipei', add column if not exists currency_code text not null default 'TWD', add column if not exists translations jsonb not null default '{}'::jsonb, add column if not exists dedupe_fingerprint text, add column if not exists dedupe_key text, add column if not exists created_by uuid references auth.users(id), add column if not exists updated_by uuid references auth.users(id), add column if not exists submitted_at timestamptz, add column if not exists published_at timestamptz, add column if not exists deleted_at timestamptz, add column if not exists created_at timestamptz not null default now(), add column if not exists updated_at timestamptz not null default now();
-- Keep the archive action in admin.js consistent with the database status constraint.
-- Replace the previous constraint when this migration is applied in a tested environment.
alter table public.trade_events drop constraint if exists trade_events_publication_status_check;
alter table public.trade_events add constraint trade_events_publication_status_check check (publication_status in ('draft','review','published','archived'));
do $$ begin alter table public.trade_events add constraint trade_events_country_code_check check (country_code ~ '^[A-Z]{2}$'); exception when duplicate_object then null; end $$;
do $$ begin alter table public.trade_events add constraint trade_events_currency_code_check check (currency_code ~ '^[A-Z]{3}$'); exception when duplicate_object then null; end $$;
do $$ begin alter table public.trade_events add constraint trade_events_date_order_check check (ends_at >= starts_at); exception when duplicate_object then null; end $$;
create or replace function public.exhibition_admin_role() returns text language sql stable security definer set search_path=public as $$ select role from public.exhibition_admin_profiles where user_id=auth.uid() $$;
revoke all on function public.exhibition_admin_role() from public; grant execute on function public.exhibition_admin_role() to authenticated;
create or replace function public.prepare_trade_event() returns trigger language plpgsql security definer set search_path=public as $$
begin
 new.country_code=upper(coalesce(nullif(new.country_code,''),'TW')); new.currency_code=upper(coalesce(nullif(new.currency_code,''),'TWD')); new.timezone=coalesce(nullif(new.timezone,''),'Asia/Taipei');
 new.dedupe_key=coalesce(nullif(new.external_id,''),nullif(new.dedupe_fingerprint,''),new.id::text); new.updated_at=now(); new.updated_by=auth.uid();
 if tg_op='INSERT' then new.created_by=coalesce(new.created_by,auth.uid()); end if;
 if new.publication_status='review' and (tg_op='INSERT' or old.publication_status is distinct from 'review') then new.submitted_at=now(); end if;
 if (new.publication_status='published' or (tg_op='UPDATE' and old.publication_status='published')) then
  if public.exhibition_admin_role() is distinct from 'publisher' and auth.role()<>'service_role' then raise exception 'publisher role required'; end if; new.published_at=now();
 end if; return new;
end $$;
drop trigger if exists trade_events_prepare_v1 on public.trade_events;
create trigger trade_events_prepare_v1 before insert or update on public.trade_events for each row execute function public.prepare_trade_event();
create unique index if not exists trade_events_source_dedupe_uidx on public.trade_events(source_id,dedupe_key);
create unique index if not exists trade_events_canonical_key_uidx on public.trade_events(canonical_key);
create index if not exists trade_events_public_feed_idx on public.trade_events(publication_status,starts_at) where deleted_at is null;
alter table public.trade_events enable row level security; alter table public.trade_event_sources enable row level security;
drop policy if exists exhibition_profiles_read_self on public.exhibition_admin_profiles;
create policy exhibition_profiles_read_self on public.exhibition_admin_profiles for select to authenticated using (user_id=auth.uid());
drop policy if exists exhibition_admin_read_events on public.trade_events;
create policy exhibition_admin_read_events on public.trade_events for select to authenticated using (public.exhibition_admin_role() in ('editor','publisher'));
drop policy if exists exhibition_admin_insert_events on public.trade_events;
create policy exhibition_admin_insert_events on public.trade_events for insert to authenticated with check (public.exhibition_admin_role() in ('editor','publisher'));
drop policy if exists exhibition_admin_update_events on public.trade_events;
create policy exhibition_admin_update_events on public.trade_events for update to authenticated using (public.exhibition_admin_role() in ('editor','publisher')) with check (public.exhibition_admin_role() in ('editor','publisher'));
drop policy if exists exhibition_public_read_published on public.trade_events;
create policy exhibition_public_read_published on public.trade_events for select to anon using (publication_status='published' and deleted_at is null);
drop policy if exists exhibition_admin_read_sources on public.trade_event_sources;
create policy exhibition_admin_read_sources on public.trade_event_sources for select to authenticated using (public.exhibition_admin_role() in ('editor','publisher'));
insert into public.trade_event_sources
(code,name,authority_name,homepage_url,feed_url,source_type,license_name,license_url,refresh_minutes,is_authorized,is_active)
values
('taipei-travel-activity','臺北旅遊網－活動展演','臺北市政府觀光傳播局','https://www.travel.taipei/open-api','https://www.travel.taipei/open-api/zh-tw/Events/Activity','api','政府資料開放授權條款－第1版','https://data.gov.tw/license',1440,true,true)
on conflict(code) do update set
 name=excluded.name, authority_name=excluded.authority_name, homepage_url=excluded.homepage_url,
 feed_url=excluded.feed_url, license_name=excluded.license_name, license_url=excluded.license_url,
 refresh_minutes=excluded.refresh_minutes, is_authorized=true, is_active=true;
update public.trade_events set source_id=(select id from public.trade_event_sources where code='moc-exhibitions' limit 1) where source_id is null and canonical_key like 'moc:%';

create table if not exists public.exhibition_source_backlog (
 code text primary key, name text not null, acquisition_kind text not null check (acquisition_kind in ('api','file','public_web_manual')),
 homepage_url text, country_code text not null default 'TW', notes text, is_ready boolean not null default false, created_at timestamptz not null default now()
);
alter table public.exhibition_source_backlog enable row level security;
drop policy if exists exhibition_admin_read_source_backlog on public.exhibition_source_backlog;
create policy exhibition_admin_read_source_backlog on public.exhibition_source_backlog for select to authenticated using (public.exhibition_admin_role() in ('editor','publisher'));
insert into public.exhibition_source_backlog(code,name,acquisition_kind,homepage_url,notes,is_ready) values
 ('boft-tw','經濟部國際貿易署','api','https://www.trade.gov.tw/','先確認資料集與欄位授權',false),
 ('taitra','中華民國對外貿易發展協會（TAITRA）','public_web_manual','https://www.taitra.org.tw/','不得在未確認條款前自動爬取',false),
 ('meet-taiwan','MEET TAIWAN','public_web_manual','https://www.meettaiwan.com/','人工整理前記錄頁面與查核日',false),
 ('venue-public-web','各會展中心','public_web_manual',null,'逐站審核來源與使用條款',false),
 ('organizer-public-web','各主辦單位','public_web_manual',null,'逐筆保留官方網址與查核日',false),
 ('csv-xlsx-import','CSV / XLSX 人工匯入','file',null,'後台匯入一律先為草稿',true)
on conflict(code) do update set name=excluded.name,homepage_url=excluded.homepage_url,notes=excluded.notes;
grant select on public.exhibition_source_backlog to authenticated;grant select on public.exhibition_admin_profiles to authenticated; grant select,insert,update on public.trade_events to authenticated; grant select on public.trade_event_sources to authenticated;
commit;
-- Bootstrap separately:
-- insert into public.exhibition_admin_profiles(user_id,role,display_name) values ('AUTH_USER_UUID','publisher','管理者') on conflict(user_id) do update set role=excluded.role,display_name=excluded.display_name;

