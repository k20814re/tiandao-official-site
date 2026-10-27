-- Additive automation schema. No credentials and no scheduled jobs in this migration.
create schema if not exists exhibition_automation;
revoke all on schema exhibition_automation from public,anon,authenticated;
grant usage on schema exhibition_automation to service_role;
create table exhibition_automation.settings(
 id boolean primary key default true check(id),enabled boolean not null default false,
 apply_changes boolean not null default false,threshold integer not null default 80 check(threshold between 80 and 100),
 job_token_hash text, max_items integer not null default 20 check(max_items between 1 and 40)
);
insert into exhibition_automation.settings(id) values(true);
create table exhibition_automation.runs(
 id uuid primary key default gen_random_uuid(),started_at timestamptz not null default now(),
 finished_at timestamptz,status text not null default 'running',results jsonb not null default '{}',
 source_ok jsonb not null default '{}',lease_until timestamptz not null default(now()+interval '3 minutes')
);
create table exhibition_automation.source_health(code text primary key,last_count integer,last_success_at timestamptz);
create table exhibition_automation.state(
 canonical_key text primary key,source_code text not null,event_id uuid references public.trade_events(id),
 input_hash text,last_checked_at timestamptz,missing_since timestamptz,last_missing_at timestamptz,
 absent_checks integer not null default 0,latest_score integer,latest_action text
);
create table exhibition_automation.evidence(
 id bigint generated always as identity primary key,run_id uuid not null references exhibition_automation.runs(id),
 canonical_key text not null,kind text not null,checked_at timestamptz not null default clock_timestamp(),
 score integer not null check(score between 0 and 100),decision text not null,details jsonb not null,
 before_event jsonb,after_event jsonb,unique(run_id,canonical_key,kind)
);
create table exhibition_automation.mail_queue(
 id uuid primary key default gen_random_uuid(),dedupe_key text not null unique,
 canonical_key text,title text not null,score integer not null check(score between 0 and 100),
 reason text not null,evidence jsonb not null,status text not null default 'pending' check(status in('pending','sent','resolved')),
 created_at timestamptz not null default now(),sent_at timestamptz,gmail_message_id text
);
create index automation_pending_mail_idx on exhibition_automation.mail_queue(created_at) where status='pending';
create index automation_state_source_idx on exhibition_automation.state(source_code,last_checked_at);
create index automation_evidence_key_idx on exhibition_automation.evidence(canonical_key,checked_at);
alter table exhibition_automation.settings enable row level security;
alter table exhibition_automation.runs enable row level security;
alter table exhibition_automation.source_health enable row level security;
alter table exhibition_automation.state enable row level security;
alter table exhibition_automation.evidence enable row level security;
alter table exhibition_automation.mail_queue enable row level security;
revoke all on all tables in schema exhibition_automation from public,anon,authenticated;
revoke all on all sequences in schema exhibition_automation from public,anon,authenticated;
grant all on all tables in schema exhibition_automation to service_role;
grant usage,select on all sequences in schema exhibition_automation to service_role;

create function exhibition_automation.queue(p_key text,p_canonical text,p_title text,p_score integer,p_reason text,p_evidence jsonb)
returns uuid language plpgsql security invoker set search_path=pg_catalog,exhibition_automation as $$
declare result uuid;begin
 insert into exhibition_automation.mail_queue(dedupe_key,canonical_key,title,score,reason,evidence)
 values(p_key,p_canonical,left(p_title,300),p_score,left(p_reason,1000),p_evidence)
 on conflict(dedupe_key) do update set evidence=excluded.evidence
 returning id into result;return result;
end $$;

create function public.exhibition_automation_start(p_token text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,exhibition_automation as $$
declare cfg exhibition_automation.settings;rid uuid;begin
 perform pg_advisory_xact_lock(20461027);
 select * into cfg from exhibition_automation.settings where id;
 if p_token is null or length(p_token)>256 or not cfg.enabled or cfg.job_token_hash is null or cfg.job_token_hash<>encode(sha256(convert_to(p_token,'UTF8')),'hex') then raise exception 'automation_unauthorized' using errcode='42501';end if;
 if exists(select 1 from exhibition_automation.runs where status='running' and lease_until>now()) then return jsonb_build_object('busy',true);end if;
 update exhibition_automation.runs set status='timed_out',finished_at=now() where status='running' and lease_until<=now();
 insert into exhibition_automation.runs default values returning id into rid;
 return jsonb_build_object('run_id',rid,'apply_changes',cfg.apply_changes,'threshold',cfg.threshold,'max_items',cfg.max_items);
end $$;
create function public.exhibition_automation_scope()
returns jsonb language sql security definer set search_path=pg_catalog,public,exhibition_automation as $$
 select jsonb_build_object('sources',(select jsonb_agg(to_jsonb(s)) from public.trade_event_sources s where code in('moc-exhibitions','taipei-travel-activity')),
 'state',coalesce((select jsonb_agg(jsonb_build_object('canonical_key',s.canonical_key,'source_code',s.source_code,'input_hash',s.input_hash,'last_checked_at',s.last_checked_at,'ends_at',e.ends_at,'updated_at',e.updated_at,'publication_status',e.publication_status)) from exhibition_automation.state s left join public.trade_events e on e.id=s.event_id),'[]'::jsonb))
$$;
create function public.exhibition_automation_feed(p_run uuid,p_code text,p_count integer,p_complete boolean,p_seen_keys text[] default '{}')
returns boolean language plpgsql security definer set search_path=pg_catalog,public,exhibition_automation as $$
declare previous integer;ok boolean;begin
 if not exists(select 1 from exhibition_automation.runs where id=p_run and status='running' and lease_until>now()) then raise exception 'inactive_run';end if;
 select last_count into previous from exhibition_automation.source_health where code=p_code;
 ok:=p_complete and p_count>0 and (previous is null or p_count>=previous*0.5);
 update exhibition_automation.runs set source_ok=source_ok||jsonb_build_object(p_code,ok) where id=p_run;
 if ok then
 update exhibition_automation.state set absent_checks=0,missing_since=null,last_missing_at=null where source_code=p_code and canonical_key=any(p_seen_keys);
 insert into exhibition_automation.source_health values(p_code,p_count,now()) on conflict(code) do update set last_count=excluded.last_count,last_success_at=excluded.last_success_at;
 else perform exhibition_automation.queue('source:'||p_code||':'||current_date,null,'來源查核失敗：'||p_code,0,'來源失敗、空清單、分頁未完成或筆數驟減；禁止判定資料移除',jsonb_build_object('source',p_code,'count',p_count,'previous_count',previous,'complete',p_complete));end if;
 return ok;
end $$;
create function public.exhibition_automation_submit(p_run uuid,p_code text,p_payload jsonb,p_evidence jsonb,p_hash text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,exhibition_automation as $$
declare cfg exhibition_automation.settings;src public.trade_event_sources;oldrow public.trade_events;newrow public.trade_events;
 k text:=p_payload->>'canonical_key';sc integer:=0;hard boolean;act text;g jsonb:=p_evidence->'gates';keyname text;weight integer;oldjson jsonb;fp text;
begin
 select * into cfg from exhibition_automation.settings where id;
 if not exists(select 1 from exhibition_automation.runs where id=p_run and status='running' and lease_until>now() and source_ok->>p_code='true') then raise exception 'unverified_feed';end if;
 select * into src from public.trade_event_sources where code=p_code;
 if src.id is null or not src.is_active or not src.is_authorized or src.license_url is null then raise exception 'source_not_authorized';end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or k is null or length(k)>180 or p_evidence->>'policy_version' is distinct from '2026-10-27.v1' then raise exception 'invalid_evidence';end if;
 if not ((p_code='moc-exhibitions' and k like 'moc:%') or (p_code='taipei-travel-activity' and k like 'taipei-travel:%')) then raise exception 'source_identity_mismatch';end if;
 insert into exhibition_automation.state(canonical_key,source_code) values(k,p_code) on conflict do nothing;
 perform 1 from exhibition_automation.state where canonical_key=k for update;
 if exists(select 1 from exhibition_automation.evidence where run_id=p_run and canonical_key=k and kind='present') then return jsonb_build_object('action','already_checked');end if;
 select * into oldrow from public.trade_events where canonical_key=k for update;
 oldjson:=case when oldrow.id is null then null else to_jsonb(oldrow) end;
 select coalesce(sum(w),0)::integer into sc from (values('licensed',15),('identity',10),('title',15),('dates',15),('place',15),('detail',10),('organizer',10),('hours',5),('official_link',5)) t(flag,w) where g->>flag='true';
 hard:=coalesce((g->>'licensed')::boolean,false) and coalesce((g->>'identity')::boolean,false) and coalesce((g->>'title')::boolean,false) and coalesce((g->>'dates')::boolean,false) and coalesce((g->>'place')::boolean,false) and coalesce((g->>'detail')::boolean,false);
 if p_evidence->>'detail_http' is distinct from '200' or p_evidence->>'list_url' is null or p_evidence->>'detail_url' is null then hard:=false;end if;
 if p_payload->>'title_zh' is null or length(p_payload->>'title_zh')<2 or p_payload->>'venue_name' is null or p_payload->>'city' is null then hard:=false;end if;
 if (p_payload->>'starts_at')::timestamptz>(p_payload->>'ends_at')::timestamptz or (p_payload->>'ends_at')::timestamptz-(p_payload->>'starts_at')::timestamptz>interval '731 days' then hard:=false;end if;
 if oldrow.publication_status='archived' or oldrow.deleted_at is not null then hard:=false;end if;
 if oldrow.id is not null and oldrow.updated_at is distinct from (p_payload->>'expected_updated_at')::timestamptz then hard:=false;end if;
 fp:=md5(lower(regexp_replace((p_payload->>'title_zh')||'|'||left(p_payload->>'starts_at',10)||'|'||(p_payload->>'venue_name'),'\s','','g')));
 if exists(select 1 from public.trade_events where dedupe_fingerprint=fp and canonical_key<>k and deleted_at is null) then hard:=false;end if;
 if not hard then sc:=least(sc,79);end if;
 act:=case when hard and sc>=cfg.threshold then case when cfg.apply_changes then 'published' else 'would_publish' end else 'manual_review' end;
 if act='published' then
  insert into public.trade_events(canonical_key,source_id,external_id,title_zh,summary,event_type,country_code,city,venue_name,address,starts_at,ends_at,daily_hours,organizer_name,official_url,ticket_info,status,verification_status,publication_status,timezone,currency_code,exhibition_category,source_checked_at,last_verified_at,last_seen_at,dedupe_fingerprint)
  values(k,src.id,p_payload->>'external_id',p_payload->>'title_zh',p_payload->>'summary','exhibition','TW',p_payload->>'city',p_payload->>'venue_name',p_payload->>'address',(p_payload->>'starts_at')::timestamptz,(p_payload->>'ends_at')::timestamptz,coalesce(p_payload->'daily_hours','[]'::jsonb),p_payload->>'organizer_name',p_payload->>'official_url',p_payload->>'ticket_info','scheduled','official_confirmed','published','Asia/Taipei','TWD',p_payload->>'exhibition_category',now(),now(),now(),fp)
  on conflict(canonical_key) do update set title_zh=excluded.title_zh,summary=excluded.summary,city=excluded.city,venue_name=excluded.venue_name,address=excluded.address,starts_at=excluded.starts_at,ends_at=excluded.ends_at,daily_hours=excluded.daily_hours,organizer_name=excluded.organizer_name,official_url=excluded.official_url,ticket_info=excluded.ticket_info,verification_status=excluded.verification_status,publication_status=excluded.publication_status,source_checked_at=excluded.source_checked_at,last_verified_at=excluded.last_verified_at,last_seen_at=excluded.last_seen_at,exhibition_category=coalesce(public.trade_events.exhibition_category,excluded.exhibition_category),dedupe_fingerprint=excluded.dedupe_fingerprint
  returning * into newrow;
 end if;
 if act='manual_review' then perform exhibition_automation.queue('review:'||k||':'||p_hash,k,coalesce(p_payload->>'title_zh',k),sc,'未達80分或必要證據不一致；現有公開資料保持原樣',p_evidence||jsonb_build_object('candidate',p_payload,'before',oldjson));end if;
 insert into exhibition_automation.evidence(run_id,canonical_key,kind,score,decision,details,before_event,after_event) values(p_run,k,'present',sc,act,p_evidence,oldjson,case when newrow.id is null then null else to_jsonb(newrow) end);
 update exhibition_automation.state set event_id=coalesce(newrow.id,oldrow.id),input_hash=p_hash,last_checked_at=now(),missing_since=null,last_missing_at=null,absent_checks=0,latest_score=sc,latest_action=act where canonical_key=k;
 return jsonb_build_object('action',act,'score',sc,'canonical_key',k);
end $$;
create function public.exhibition_automation_missing(p_run uuid,p_key text,p_detail_absent boolean,p_detail_url text,p_http integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,exhibition_automation as $$
declare s exhibition_automation.state;cfg exhibition_automation.settings;e public.trade_events;act text:='manual_review';sc int:=0;n int;first_missing timestamptz;confirmed boolean;begin
 select * into cfg from exhibition_automation.settings where id;
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
 if sc>=cfg.threshold then
  act:=case when cfg.apply_changes then 'archived' else 'would_archive' end;
  if cfg.apply_changes then update public.trade_events set publication_status='archived',status='source_removed',missing_checks=n where id=e.id;end if;
 end if;
 perform exhibition_automation.queue('missing:'||p_key||':'||coalesce(first_missing::date::text,current_date::text),p_key,e.title_zh,sc,'來源清單未見：需完整清單及單筆官方API跨次確認；未確認前保留資料',jsonb_build_object('detail_url',p_detail_url,'detail_http',p_http,'confirmed_absent',confirmed,'confirmations',n,'first_missing_at',first_missing,'action',act));
 insert into exhibition_automation.evidence(run_id,canonical_key,kind,score,decision,details,before_event,after_event) values(p_run,p_key,'missing',sc,act,jsonb_build_object('detail_url',p_detail_url,'detail_http',p_http,'confirmed_absent',confirmed,'confirmations',n,'first_missing_at',first_missing),to_jsonb(e),case when act='archived' then (select to_jsonb(t) from public.trade_events t where id=e.id) else null end);
 update exhibition_automation.state set last_checked_at=now(),latest_score=sc,latest_action=act where canonical_key=p_key;
 return jsonb_build_object('action',act,'score',sc,'confirmations',n);
end $$;
create function public.exhibition_automation_finish(p_run uuid,p_results jsonb,p_success boolean)
returns void language sql security definer set search_path=pg_catalog,exhibition_automation as $$
 update exhibition_automation.runs set status=case when p_success then 'succeeded' else 'failed' end,finished_at=now(),results=p_results,lease_until=now() where id=p_run and status='running'
$$;

-- Existing source-backed records are tracked without changing their publication state.
insert into exhibition_automation.state(canonical_key,source_code,event_id)
select e.canonical_key,s.code,e.id from public.trade_events e join public.trade_event_sources s on s.id=e.source_id where (s.code='moc-exhibitions' and e.canonical_key like 'moc:%') or (s.code='taipei-travel-activity' and e.canonical_key like 'taipei-travel:%');
revoke all on all functions in schema exhibition_automation from public,anon,authenticated;
grant execute on all functions in schema exhibition_automation to service_role;
revoke all on function public.exhibition_automation_start(text),public.exhibition_automation_scope(),public.exhibition_automation_feed(uuid,text,integer,boolean,text[]),public.exhibition_automation_submit(uuid,text,jsonb,jsonb,text),public.exhibition_automation_missing(uuid,text,boolean,text,integer),public.exhibition_automation_finish(uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.exhibition_automation_start(text),public.exhibition_automation_scope(),public.exhibition_automation_feed(uuid,text,integer,boolean,text[]),public.exhibition_automation_submit(uuid,text,jsonb,jsonb,text),public.exhibition_automation_missing(uuid,text,boolean,text,integer),public.exhibition_automation_finish(uuid,jsonb,boolean) to service_role;
