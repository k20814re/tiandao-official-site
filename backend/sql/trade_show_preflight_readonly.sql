-- Read-only deployment preflight for TianDao exhibition admin.
-- Run in Supabase SQL Editor. Does not mutate any data.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='trade_events'
and column_name in ('id','canonical_key','source_id','dedupe_key','dedupe_fingerprint',
 'exhibition_category','source_checked_at','publication_status','deleted_at','starts_at','ends_at')
order by column_name;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid='public.trade_events'::regclass
and contype in ('c','u') order by conname;

select indexname, indexdef from pg_indexes
where schemaname='public' and tablename='trade_events'
and (indexdef ilike '%canonical_key%' or indexdef ilike '%source_id%' or indexdef ilike '%exhibition_category%')
order by indexname;

select publication_status, count(*) as rows
from public.trade_events group by publication_status order by publication_status;

select coalesce(exhibition_category,'(unclassified)') as category,count(*) as rows
from public.trade_events
group by coalesce(exhibition_category,'(unclassified)')
order by rows desc;
