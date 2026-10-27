-- READ-ONLY: inspect canonical_key uniqueness before deploying atomic imports.
-- Do not execute a unique-index migration until duplicate keys are resolved.
select canonical_key, count(*) as duplicates
from public.trade_events
where canonical_key is not null
group by canonical_key
having count(*) > 1
order by duplicates desc
limit 50;

select i.relname as index_name, ix.indisunique as is_unique,
       pg_get_indexdef(i.oid) as definition
from pg_class t
join pg_namespace n on n.oid=t.relnamespace
join pg_index ix on ix.indrelid=t.oid
join pg_class i on i.oid=ix.indexrelid
where n.nspname='public' and t.relname='trade_events'
and pg_get_indexdef(i.oid) ilike '%canonical_key%';

select count(*) as total_rows,
       count(*) filter (where canonical_key is null) as null_canonical_keys
from public.trade_events;

-- Required before enabling atomic import:
-- a UNIQUE index/constraint on canonical_key, and no duplicate non-null keys.
-- Existing records must not be deleted or rewritten as part of this check.
