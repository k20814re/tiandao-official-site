-- Additive only. Run after backing up and checking current schema.
begin;
alter table public.trade_events
  add column if not exists exhibition_category text;
alter table public.trade_events
  add column if not exists source_checked_at timestamptz;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.trade_events'::regclass
      and conname = 'trade_events_exhibition_category_check'
  ) then
    alter table public.trade_events
      add constraint trade_events_exhibition_category_check
      check (exhibition_category is null or exhibition_category in (
        'b2b_trade_show','b2c_consumer_fair','arts_exhibition','other_event'
      ));
  end if;
end $$;
create index if not exists trade_events_exhibition_category_idx
  on public.trade_events (exhibition_category,starts_at)
  where deleted_at is null;
commit;
-- Existing records remain NULL (unclassified); no backfill or publication changes.
