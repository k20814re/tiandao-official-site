-- CI ONLY: extends minimal review fixtures to mirror columns used by automation.
drop trigger if exists trade_events_publication_freeze on public.trade_events;
create table public.trade_event_sources(id uuid primary key default gen_random_uuid(),code text unique not null,name text,feed_url text,license_url text,is_active boolean default true,is_authorized boolean default true);
alter table public.trade_events
 add column canonical_key text unique,add column source_id uuid references public.trade_event_sources(id),add column external_id text,
 add column title_zh text,add column summary text,add column event_type text,add column country_code text,
 add column city text,add column venue_name text,add column address text,add column starts_at timestamptz,add column ends_at timestamptz,
 add column daily_hours jsonb default '[]',add column organizer_name text,add column official_url text,add column ticket_info text,
 add column status text,add column verification_status text,add column timezone text,add column currency_code text,
 add column exhibition_category text,add column source_checked_at timestamptz,add column last_verified_at timestamptz,
 add column last_seen_at timestamptz,add column dedupe_fingerprint text,add column updated_at timestamptz default now(),
 add column deleted_at timestamptz,add column missing_checks integer default 0;
insert into public.trade_event_sources(code,name,license_url) values('moc-exhibitions','CI fixture','https://data.gov.tw/license'),('taipei-travel-activity','CI Taipei','https://data.gov.tw/license');
