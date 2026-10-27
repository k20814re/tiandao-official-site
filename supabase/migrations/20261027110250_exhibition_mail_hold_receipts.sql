-- Record trusted Gmail decisions once; releases require a later verified analysis.
-- Existing holds remain unconditional holds. No event facts or settings change here.
create table exhibition_automation.reply_receipts (
 reply_message_id text primary key check(reply_message_id ~ '^[0-9a-f]{1,64}$'),
 original_message_id text not null check(original_message_id ~ '^[0-9a-f]{1,64}$'),
 thread_id text not null check(thread_id ~ '^[0-9a-f]{1,64}$'),
 batch_tag text not null check(batch_tag ~ '^td-review-[0-9a-f]{32}$'),
 account_email text not null check(account_email='k20814re@gmail.com'),
 intent text not null check(intent in ('hold','hold_then_verify')),
 reply_at timestamptz not null,
 recorded_at timestamptz not null default clock_timestamp(),
 canonical_keys text[] not null,
 applied_items integer not null default 0,
 outcome text not null default 'applied' check(outcome in ('applied','partial','stale'))
);
alter table exhibition_automation.reply_receipts enable row level security;
revoke all on exhibition_automation.reply_receipts from public,anon,authenticated,service_role;
alter table exhibition_automation.review_holds
 add column intent text not null default 'hold' check(intent in ('hold','hold_then_verify')),
 add column intent_received_at timestamptz,
 add column armed_at timestamptz,
 add column reply_message_id text references exhibition_automation.reply_receipts(reply_message_id),
 add column release_run_id uuid references exhibition_automation.runs(id);
create index automation_mail_message_idx on exhibition_automation.mail_queue(gmail_message_id) where status='sent';

-- This private, invoker-only function is called by the trusted Gmail task through
-- execute_sql AFTER checking profile, SENT, plain text, thread and message headers.
-- It never publishes or changes exhibition facts.
create function exhibition_automation.record_reply(
 p_original_message_id text,p_reply_message_id text,p_thread_id text,
 p_batch_tag text,p_reply_at timestamptz,p_command text,p_account_email text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,exhibition_automation
as $fn$
declare
 action text; n integer; keys text[]; computed text; earliest timestamptz;
 existing exhibition_automation.reply_receipts; locked_keys text[]; locked_tag text; locked_count integer;
 h exhibition_automation.review_holds; k text; applied integer:=0; armed timestamptz;
begin
 if p_account_email is distinct from 'k20814re@gmail.com'
 or p_original_message_id is null or p_original_message_id !~ '^[0-9a-f]{1,64}$'
 or p_reply_message_id is null or p_reply_message_id !~ '^[0-9a-f]{1,64}$'
 or p_thread_id is null or p_thread_id !~ '^[0-9a-f]{1,64}$'
 or p_original_message_id=p_reply_message_id
 or p_batch_tag is null or p_batch_tag !~ '^td-review-[0-9a-f]{32}$'
 then raise exception 'invalid_reply_identity';end if;
 action:=case p_command when '整批保留' then 'hold'
 when '整批保留，查核通過後發布' then 'hold_then_verify'
 when '整批保留,查核通過後發布' then 'hold_then_verify' end;
 if action is null then raise exception 'unsupported_reply_command';end if;
 perform pg_advisory_xact_lock(hashtextextended('exhibition-reply:'||p_reply_message_id,0));
 select * into existing from exhibition_automation.reply_receipts where reply_message_id=p_reply_message_id;
 if found then
  if existing.original_message_id is distinct from p_original_message_id
   or existing.thread_id is distinct from p_thread_id or existing.batch_tag is distinct from p_batch_tag
   or existing.intent is distinct from action or existing.reply_at is distinct from p_reply_at
  then raise exception 'reply_identity_conflict';end if;
  return jsonb_build_object('status','already_recorded','items',cardinality(existing.canonical_keys),'applied',existing.applied_items);
 end if;
 if p_reply_at is null or p_reply_at>clock_timestamp()+interval '5 minutes'
 or p_reply_at<clock_timestamp()-interval '7 days' then raise exception 'reply_time_invalid';end if;
 select count(*),'td-review-'||md5(string_agg(id::text,',' order by id)),
 array_agg(distinct canonical_key order by canonical_key),max(created_at)
 into n,computed,keys,earliest from exhibition_automation.mail_queue
 where status='sent' and gmail_message_id=p_original_message_id;
 if n<1 or n>50 or computed is distinct from p_batch_tag
 or exists(select 1 from unnest(keys) x where x is null or btrim(x)='' or length(x)>180)
 or p_reply_at<earliest then raise exception 'review_batch_mismatch';end if;
 -- Same per-key lock order as submit/missing; prevents a release racing a hold.
 foreach k in array keys loop
  perform pg_advisory_xact_lock(hashtextextended('exhibition-review:'||k,0));
 end loop;
 -- Lock queue rows only after per-key locks, matching submit's queue-write order.
 perform id from exhibition_automation.mail_queue
 where status='sent' and gmail_message_id=p_original_message_id order by id for share;
 select count(*),'td-review-'||md5(string_agg(id::text,',' order by id)),
 array_agg(distinct canonical_key order by canonical_key)
 into locked_count,locked_tag,locked_keys from exhibition_automation.mail_queue
 where status='sent' and gmail_message_id=p_original_message_id;
 if locked_count is distinct from n or locked_tag is distinct from computed or locked_keys is distinct from keys
 then raise exception 'review_batch_changed';end if;
 armed:=clock_timestamp();
 insert into exhibition_automation.reply_receipts
 (reply_message_id,original_message_id,thread_id,batch_tag,account_email,intent,reply_at,recorded_at,canonical_keys)
 values(p_reply_message_id,p_original_message_id,p_thread_id,p_batch_tag,p_account_email,action,p_reply_at,armed,keys);
 foreach k in array keys loop
  select * into h from exhibition_automation.review_holds where canonical_key=k for update;
  if h.canonical_key is not null and p_reply_at<=coalesce(h.intent_received_at,h.created_at) then continue;end if;
  insert into exhibition_automation.review_holds
   (canonical_key,reason,intent,intent_received_at,armed_at,reply_message_id,released_at,release_run_id)
  values(k,'Gmail original='||p_original_message_id||'; reply='||p_reply_message_id||'; intent='||action,
   action,p_reply_at,armed,p_reply_message_id,null,null)
  on conflict(canonical_key) do update set reason=excluded.reason,intent=excluded.intent,
   intent_received_at=excluded.intent_received_at,armed_at=excluded.armed_at,
   reply_message_id=excluded.reply_message_id,released_at=null,release_run_id=null;
  if action='hold_then_verify' then
   update exhibition_automation.state set last_checked_at=null where canonical_key=k;
  end if;
  applied:=applied+1;
 end loop;
 update exhibition_automation.reply_receipts set applied_items=applied,
 outcome=case when applied=0 then 'stale' when applied<cardinality(keys) then 'partial' else 'applied' end
 where reply_message_id=p_reply_message_id;
 return jsonb_build_object('status',case when applied=0 then 'stale' when applied<cardinality(keys) then 'partial' else 'applied' end,
 'items',cardinality(keys),'applied',applied,'intent',action,'direct_publications',0);
end $fn$;
revoke all on function exhibition_automation.record_reply(text,text,text,text,timestamptz,text,text) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.exhibition_automation_submit(p_run uuid, p_code text, p_payload jsonb, p_evidence jsonb, p_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'exhibition_automation'
AS $function$
declare cfg exhibition_automation.settings;src public.trade_event_sources;oldrow public.trade_events;newrow public.trade_events;
 k text:=p_payload->>'canonical_key';sc integer:=0;hard boolean;act text;g jsonb:=p_evidence->'gates';keyname text;weight integer;oldjson jsonb;fp text;h exhibition_automation.review_holds;fresh boolean:=false;run_started timestamptz;
begin
 select * into cfg from exhibition_automation.settings where id;
 if not exists(select 1 from exhibition_automation.runs where id=p_run and status='running' and lease_until>now() and source_ok->>p_code='true') then raise exception 'unverified_feed';end if;
 select * into src from public.trade_event_sources where code=p_code;
 if src.id is null or not src.is_active or not src.is_authorized or src.license_url is null then raise exception 'source_not_authorized';end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or k is null or length(k)>180 or p_evidence->>'policy_version' is distinct from '2026-10-27.v1' then raise exception 'invalid_evidence';end if;
 if not ((p_code='moc-exhibitions' and k like 'moc:%') or (p_code='taipei-travel-activity' and k like 'taipei-travel:%')) then raise exception 'source_identity_mismatch';end if;
 perform pg_advisory_xact_lock(hashtextextended('exhibition-review:'||k,0));
 insert into exhibition_automation.state(canonical_key,source_code) values(k,p_code) on conflict do nothing;
 perform 1 from exhibition_automation.state where canonical_key=k for update;
 if exists(select 1 from exhibition_automation.evidence where run_id=p_run and canonical_key=k and kind='present') then return jsonb_build_object('action','already_checked');end if;
 select * into h from exhibition_automation.review_holds where canonical_key=k for update;
 select started_at into run_started from exhibition_automation.runs where id=p_run;
 if h.canonical_key is not null and h.released_at is null and h.intent='hold_then_verify' then
  fresh:=coalesce(h.armed_at is not null and h.reply_message_id is not null
   and run_started>=h.armed_at
   and (p_evidence->>'checked_at')::timestamptz>=run_started
   and (p_evidence->>'checked_at')::timestamptz between clock_timestamp()-interval '15 minutes' and clock_timestamp()+interval '1 minute'
   and exists(select 1 from exhibition_automation.reply_receipts r where r.reply_message_id=h.reply_message_id and r.intent='hold_then_verify'),false);
 end if;
 select * into oldrow from public.trade_events where canonical_key=k for update;
 oldjson:=case when oldrow.id is null then null else to_jsonb(oldrow) end;
 select coalesce(sum(w),0)::integer into sc from (values('licensed',15),('identity',10),('title',15),('dates',15),('place',15),('detail',10),('organizer',10),('hours',5),('official_link',5)) t(flag,w) where g->>flag='true';
 hard:=coalesce((g->>'licensed')::boolean,false) and coalesce((g->>'identity')::boolean,false) and coalesce((g->>'title')::boolean,false) and coalesce((g->>'dates')::boolean,false) and coalesce((g->>'place')::boolean,false) and coalesce((g->>'detail')::boolean,false);
 if p_evidence->>'detail_http' is distinct from '200' or p_evidence->>'list_url' is null or p_evidence->>'detail_url' is null then hard:=false;end if;
 if nullif(btrim(p_payload->>'title_zh'),'') is null or length(btrim(p_payload->>'title_zh'))<2
 or nullif(btrim(p_payload->>'venue_name'),'') is null or nullif(btrim(p_payload->>'city'),'') is null
 or nullif(p_payload->>'starts_at','') is null or nullif(p_payload->>'ends_at','') is null then hard:=false;end if;
 if (p_payload->>'starts_at')::timestamptz>(p_payload->>'ends_at')::timestamptz or (p_payload->>'ends_at')::timestamptz-(p_payload->>'starts_at')::timestamptz>interval '731 days' then hard:=false;end if;
 if oldrow.publication_status='archived' or oldrow.deleted_at is not null then hard:=false;end if;
 if not cfg.enabled then hard:=false;end if;
 if h.canonical_key is not null and h.released_at is null and not fresh then hard:=false;end if;
 if oldrow.id is not null and oldrow.updated_at is distinct from (p_payload->>'expected_updated_at')::timestamptz then hard:=false;end if;
 fp:=md5(lower(regexp_replace((p_payload->>'title_zh')||'|'||left(p_payload->>'starts_at',10)||'|'||(p_payload->>'venue_name'),'\s','','g')));
 if exists(select 1 from public.trade_events where dedupe_fingerprint=fp and canonical_key<>k and deleted_at is null) then hard:=false;end if;
 if not hard then sc:=least(sc,79);end if;
 act:=case when hard and sc>=greatest(80,cfg.threshold) then case when cfg.apply_changes then 'published' else 'would_publish' end else 'manual_review' end;
 if act='published' then
  insert into public.trade_events(canonical_key,source_id,external_id,title_zh,summary,event_type,country_code,city,venue_name,address,starts_at,ends_at,daily_hours,organizer_name,official_url,ticket_info,status,verification_status,publication_status,timezone,currency_code,exhibition_category,source_checked_at,last_verified_at,last_seen_at,dedupe_fingerprint)
  values(k,src.id,p_payload->>'external_id',p_payload->>'title_zh',p_payload->>'summary','exhibition','TW',p_payload->>'city',p_payload->>'venue_name',p_payload->>'address',(p_payload->>'starts_at')::timestamptz,(p_payload->>'ends_at')::timestamptz,coalesce(p_payload->'daily_hours','[]'::jsonb),p_payload->>'organizer_name',p_payload->>'official_url',p_payload->>'ticket_info','scheduled','official_confirmed','published','Asia/Taipei','TWD',p_payload->>'exhibition_category',now(),now(),now(),fp)
  on conflict(canonical_key) do update set title_zh=excluded.title_zh,summary=excluded.summary,city=excluded.city,venue_name=excluded.venue_name,address=excluded.address,starts_at=excluded.starts_at,ends_at=excluded.ends_at,daily_hours=excluded.daily_hours,organizer_name=excluded.organizer_name,official_url=excluded.official_url,ticket_info=excluded.ticket_info,verification_status=excluded.verification_status,publication_status=excluded.publication_status,source_checked_at=excluded.source_checked_at,last_verified_at=excluded.last_verified_at,last_seen_at=excluded.last_seen_at,exhibition_category=coalesce(public.trade_events.exhibition_category,excluded.exhibition_category),dedupe_fingerprint=excluded.dedupe_fingerprint
  returning * into newrow;
  if h.canonical_key is not null and h.released_at is null and fresh then
   update exhibition_automation.review_holds set released_at=clock_timestamp(),release_run_id=p_run where canonical_key=k;
  end if;
 end if;
 if act='manual_review' then perform exhibition_automation.queue('review:'||k||':'||p_hash,k,coalesce(p_payload->>'title_zh',k),sc,'未達80分或必要證據不一致；現有公開資料保持原樣',p_evidence||jsonb_build_object('candidate',p_payload,'before',oldjson));end if;
 insert into exhibition_automation.evidence(run_id,canonical_key,kind,score,decision,details,before_event,after_event) values(p_run,k,'present',sc,act,p_evidence||jsonb_build_object('review_intent',h.intent,'review_reply_message_id',h.reply_message_id,'hold_released',act='published' and fresh),oldjson,case when newrow.id is null then null else to_jsonb(newrow) end);
 update exhibition_automation.state set event_id=coalesce(newrow.id,oldrow.id),input_hash=p_hash,last_checked_at=case when h.canonical_key is not null and h.released_at is null and h.intent='hold_then_verify' and not fresh then null else now() end,missing_since=null,last_missing_at=null,absent_checks=0,latest_score=sc,latest_action=act where canonical_key=k;
 return jsonb_build_object('action',act,'score',sc,'canonical_key',k);
end $function$
;
CREATE OR REPLACE FUNCTION public.exhibition_automation_missing(p_run uuid, p_key text, p_detail_absent boolean, p_detail_url text, p_http integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'exhibition_automation'
AS $function$
declare s exhibition_automation.state;cfg exhibition_automation.settings;e public.trade_events;act text:='manual_review';sc int:=0;n int;first_missing timestamptz;confirmed boolean;begin
 select * into cfg from exhibition_automation.settings where id;
 perform pg_advisory_xact_lock(hashtextextended('exhibition-review:'||p_key,0));
 select * into s from exhibition_automation.state where canonical_key=p_key for update;
 if s.canonical_key is null then raise exception 'unknown_event';end if;
 if not exists(select 1 from exhibition_automation.runs where id=p_run and status='running' and lease_until>now() and source_ok->>s.source_code='true') then raise exception 'unverified_feed';end if;
 if exists(select 1 from exhibition_automation.evidence where run_id=p_run and canonical_key=p_key and kind='missing') then return jsonb_build_object('action','already_checked');end if;
 select * into e from public.trade_events where id=s.event_id for update;
 if e.id is null or e.publication_status='archived' or e.ends_at<now() then return jsonb_build_object('action','not_active');end if;
 confirmed:=p_detail_absent and (p_http in(200,404,410));
 n:=s.absent_checks;first_missing:=s.missing_since;
 if confirmed and (s.last_missing_at is null or s.last_missing_at<=now()-interval '6 hours') then
  if s.last_missing_at<now()-interval '48 hours' then n:=0;first_missing:=null;end if;
  n:=n+1;first_missing:=coalesce(first_missing,now());
  update exhibition_automation.state set absent_checks=n,missing_since=first_missing,last_missing_at=now() where canonical_key=p_key;
 end if;
 if not p_detail_absent and p_http=200 then
  n:=0;first_missing:=null;
  update exhibition_automation.state set absent_checks=0,missing_since=null,last_missing_at=null where canonical_key=p_key;
 end if;
 sc:=case when confirmed and n>=3 and first_missing<=now()-interval '24 hours' then 90 else least(79,n*25) end;
 if sc>=greatest(90,cfg.threshold) and cfg.enabled and not exists(
 select 1 from exhibition_automation.review_holds where canonical_key=p_key and released_at is null) then
  act:=case when cfg.archive_changes then 'archived' else 'would_archive' end;
  if cfg.archive_changes then update public.trade_events set publication_status='archived',status='source_removed',missing_checks=n where id=e.id;end if;
 end if;
 perform exhibition_automation.queue('missing:'||p_key||':'||coalesce(first_missing::date::text,current_date::text),p_key,e.title_zh,sc,'來源清單未見：需完整清單及單筆官方API跨次確認；未確認前保留資料',jsonb_build_object('detail_url',p_detail_url,'detail_http',p_http,'confirmed_absent',confirmed,'confirmations',n,'first_missing_at',first_missing,'action',act));
 insert into exhibition_automation.evidence(run_id,canonical_key,kind,score,decision,details,before_event,after_event) values(p_run,p_key,'missing',sc,act,jsonb_build_object('detail_url',p_detail_url,'detail_http',p_http,'confirmed_absent',confirmed,'confirmations',n,'first_missing_at',first_missing),to_jsonb(e),case when act='archived' then (select to_jsonb(t) from public.trade_events t where id=e.id) else null end);
 update exhibition_automation.state set last_checked_at=now(),latest_score=sc,latest_action=act where canonical_key=p_key;
 return jsonb_build_object('action',act,'score',sc,'confirmations',n);
end $function$
;

