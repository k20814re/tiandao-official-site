-- Disposable PostgreSQL only. Synthetic mail IDs never represent actual Gmail messages.
begin;
create function pg_temp.fresh_run() returns uuid language plpgsql as $$
declare r uuid;begin
 insert into exhibition_automation.runs(started_at,lease_until,source_ok)
 values(clock_timestamp(),clock_timestamp()+interval '3 minutes','{"moc-exhibitions":true}') returning id into r;
 return r;
end $$;
create function pg_temp.fail_atomic_publish() returns trigger language plpgsql as $$
begin if new.title_zh='Atomic failure' then raise exception 'test write failure' using errcode='23514';end if;return new;end $$;
create trigger ci_fail_atomic_publish before insert or update on public.trade_events for each row execute function pg_temp.fail_atomic_publish();
do $$
declare
 tag text;tag2 text;tag3 text;result jsonb;rid uuid;oldrun uuid;before_count int;
 t timestamptz:=clock_timestamp()-interval '10 minutes';
 p jsonb:='{"canonical_key":"moc:receipt-pass","external_id":"receipt-pass","title_zh":"Receipt pass","starts_at":"2026-11-01T00:00:00+08:00","ends_at":"2026-11-03T23:59:59+08:00","city":"臺北市","venue_name":"Receipt venue"}';
 e jsonb:='{"policy_version":"2026-10-27.v1","detail_http":200,"list_url":"https://cloud.culture.tw/list","detail_url":"https://cloud.culture.tw/detail","gates":{"licensed":true,"identity":true,"title":true,"dates":true,"place":true,"detail":true}}';
begin
 if has_function_privilege('anon','exhibition_automation.record_reply(text,text,text,text,timestamptz,text,text)','EXECUTE')
 or has_function_privilege('authenticated','exhibition_automation.record_reply(text,text,text,text,timestamptz,text,text)','EXECUTE')
 or has_function_privilege('service_role','exhibition_automation.record_reply(text,text,text,text,timestamptz,text,text)','EXECUTE')
 then raise exception 'reply recorder exposed';end if;
 insert into exhibition_automation.mail_queue(dedupe_key,canonical_key,title,score,reason,evidence,status,gmail_message_id,created_at,sent_at)
 values('receipt-pass','moc:receipt-pass','pass',40,'test','{}','sent','aa01',t-interval '1 minute',t-interval '1 minute'),
 ('receipt-fail','moc:receipt-fail','fail',40,'test','{}','sent','aa01',t-interval '1 minute',t-interval '1 minute');
 select 'td-review-'||md5(string_agg(id::text,',' order by id)) into tag from exhibition_automation.mail_queue where gmail_message_id='aa01';
 begin
  perform exhibition_automation.record_reply('aa01','bb00','aa01','td-review-'||repeat('0',32),t,'整批保留','k20814re@gmail.com');
  raise exception 'bad batch accepted';
 exception when others then if sqlerrm<>'review_batch_mismatch' then raise;end if;end;
 if exists(select 1 from exhibition_automation.reply_receipts where reply_message_id='bb00') then raise exception 'bad batch wrote receipt';end if;
 begin
  perform exhibition_automation.record_reply('aa01','bb00','aa01',tag,t,'先保留','k20814re@gmail.com');
  raise exception 'vague command accepted';
 exception when others then if sqlerrm<>'unsupported_reply_command' then raise;end if;end;
 begin
  perform exhibition_automation.record_reply('aa01','bb00','aa01',tag,t,'整批保留','other@example.com');
  raise exception 'wrong account accepted';
 exception when others then if sqlerrm<>'invalid_reply_identity' then raise;end if;end;
 oldrun:=pg_temp.fresh_run();
 result:=exhibition_automation.record_reply('aa01','bb01','aa01',tag,t,'整批保留，查核通過後發布','k20814re@gmail.com');
 if result->>'applied'<>'2' or result->>'direct_publications'<>'0' then raise exception 'batch not atomic: %',result;end if;
 if exists(select 1 from public.trade_events where canonical_key in('moc:receipt-pass','moc:receipt-fail')) then raise exception 'reply directly published';end if;
 -- An analysis that began before the intent may not release even with fresh HTTP data.
 result:=public.exhibition_automation_submit(oldrun,'moc-exhibitions',p,e||jsonb_build_object('checked_at',clock_timestamp()),repeat('a',64));
 if result->>'action'<>'manual_review' or (select last_checked_at is not null from exhibition_automation.state where canonical_key='moc:receipt-pass') then raise exception 'pre-intent run released or lost retry';end if;
 -- A later run can release only its passing item; the other batch item stays held.
 rid:=pg_temp.fresh_run();
 result:=public.exhibition_automation_submit(rid,'moc-exhibitions',p,e||jsonb_build_object('checked_at',clock_timestamp()),repeat('a',64));
 if result->>'action'<>'published' or result->>'score'<>'80' then raise exception '80-point fresh release failed: %',result;end if;
 if not exists(select 1 from exhibition_automation.review_holds where canonical_key='moc:receipt-pass' and released_at is not null and release_run_id=rid)
 then raise exception 'release audit missing';end if;
 result:=public.exhibition_automation_submit(rid,'moc-exhibitions',
 p||'{"canonical_key":"moc:receipt-fail","external_id":"receipt-fail","title_zh":"Receipt fail","venue_name":"Failure venue"}',
 jsonb_set(e,'{gates,title}','false')||'{"gates":{"licensed":true,"identity":true,"title":false,"dates":true,"place":true,"detail":true,"organizer":true,"hours":true,"official_link":true}}'||jsonb_build_object('checked_at',clock_timestamp()),repeat('b',64));
 if result->>'action'<>'manual_review' or (result->>'score')::int>=80 then raise exception 'mandatory-field failure released';end if;
 if not exists(select 1 from exhibition_automation.review_holds where canonical_key='moc:receipt-fail' and released_at is null)
 or not exists(select 1 from exhibition_automation.mail_queue where canonical_key='moc:receipt-fail' and status='pending')
 then raise exception 'failed item not held/notified';end if;
 -- Replays cannot re-hold an already released item.
 result:=exhibition_automation.record_reply('aa01','bb01','aa01',tag,t,'整批保留，查核通過後發布','k20814re@gmail.com');
 if result->>'status'<>'already_recorded' or exists(select 1 from exhibition_automation.review_holds where canonical_key='moc:receipt-pass' and released_at is null)
 then raise exception 'replay changed released item';end if;
 -- A later unconditional hold overrides earlier intent; delayed old replies cannot undo it.
 result:=exhibition_automation.record_reply('aa01','bb02','aa01',tag,t+interval '2 minutes','整批保留','k20814re@gmail.com');
 if result->>'applied'<>'2' then raise exception 'new hold not applied';end if;
 result:=exhibition_automation.record_reply('aa01','bb03','aa01',tag,t+interval '1 minute','整批保留，查核通過後發布','k20814re@gmail.com');
 if result->>'status'<>'stale' or exists(select 1 from exhibition_automation.review_holds where canonical_key in('moc:receipt-pass','moc:receipt-fail') and intent<>'hold')
 then raise exception 'stale reply overrode hold';end if;
 rid:=pg_temp.fresh_run();
 result:=public.exhibition_automation_submit(rid,'moc-exhibitions',p||jsonb_build_object('expected_updated_at',(select updated_at from public.trade_events where canonical_key='moc:receipt-pass')),
 e||jsonb_build_object('checked_at',clock_timestamp()),repeat('c',64));
 if result->>'action'<>'manual_review' then raise exception 'unconditional hold released';end if;
 -- Holds also protect against archiving even when the archive setting is enabled.
 update exhibition_automation.settings set archive_changes=true;
 update exhibition_automation.state set absent_checks=2,missing_since=now()-interval '25 hours',last_missing_at=now()-interval '7 hours' where canonical_key='moc:receipt-pass';
 result:=public.exhibition_automation_missing(rid,'moc:receipt-pass',true,'https://cloud.culture.tw/detail',200);
 if result->>'action'='archived' or (select publication_status from public.trade_events where canonical_key='moc:receipt-pass')<>'published' then raise exception 'held item archived';end if;
 update exhibition_automation.settings set archive_changes=false;
 -- All claims and holds roll back when a publication write fails.
 insert into exhibition_automation.mail_queue(dedupe_key,canonical_key,title,score,reason,evidence,status,gmail_message_id,created_at,sent_at)
 values('receipt-atomic','moc:receipt-atomic','atomic',40,'test','{}','sent','aa02',t-interval '1 minute',t-interval '1 minute');
 select 'td-review-'||md5(string_agg(id::text,',' order by id)) into tag2 from exhibition_automation.mail_queue where gmail_message_id='aa02';
 perform exhibition_automation.record_reply('aa02','bb04','aa02',tag2,t,'整批保留，查核通過後發布','k20814re@gmail.com');
 rid:=pg_temp.fresh_run();
 begin
  perform public.exhibition_automation_submit(rid,'moc-exhibitions',p||'{"canonical_key":"moc:receipt-atomic","external_id":"receipt-atomic","title_zh":"Atomic failure","venue_name":"Atomic venue"}',
  e||jsonb_build_object('checked_at',clock_timestamp()),repeat('d',64));
  raise exception 'publication failure did not propagate';
 exception when check_violation then null;end;
 if exists(select 1 from exhibition_automation.review_holds where canonical_key='moc:receipt-atomic' and released_at is not null)
 or exists(select 1 from public.trade_events where canonical_key='moc:receipt-atomic')
 or exists(select 1 from exhibition_automation.evidence where run_id=rid and canonical_key='moc:receipt-atomic') then raise exception 'failed publication partially committed';end if;
 -- Stale evidence, missing date and HTTP failure cannot unlock; dry run cannot unlock.
 result:=public.exhibition_automation_submit(pg_temp.fresh_run(),'moc-exhibitions',
 p||'{"canonical_key":"moc:receipt-atomic","external_id":"receipt-atomic","title_zh":"Recovered atomic","venue_name":"Atomic venue"}',
 e||jsonb_build_object('checked_at',now()-interval '1 day'),repeat('e',64));
 if result->>'action'<>'manual_review' then raise exception 'stale evidence released';end if;
 result:=public.exhibition_automation_submit(pg_temp.fresh_run(),'moc-exhibitions',
 p||'{"canonical_key":"moc:receipt-atomic","external_id":"receipt-atomic","title_zh":"Recovered atomic","venue_name":"Atomic venue","starts_at":null}',
 e||jsonb_build_object('checked_at',clock_timestamp()),repeat('e',64));
 if result->>'action'<>'manual_review' then raise exception 'null date released';end if;
 result:=public.exhibition_automation_submit(pg_temp.fresh_run(),'moc-exhibitions',
 p||'{"canonical_key":"moc:receipt-atomic","external_id":"receipt-atomic","title_zh":"Recovered atomic","venue_name":"Atomic venue"}',
 e||jsonb_build_object('checked_at',clock_timestamp(),'detail_http',503),repeat('e',64));
 if result->>'action'<>'manual_review' then raise exception 'HTTP failure released';end if;
 update exhibition_automation.settings set apply_changes=false;
 result:=public.exhibition_automation_submit(pg_temp.fresh_run(),'moc-exhibitions',
 p||'{"canonical_key":"moc:receipt-atomic","external_id":"receipt-atomic","title_zh":"Recovered atomic","venue_name":"Atomic venue"}',
 e||jsonb_build_object('checked_at',clock_timestamp()),repeat('f',64));
 if result->>'action'<>'would_publish' or exists(select 1 from exhibition_automation.review_holds where canonical_key='moc:receipt-atomic' and released_at is not null)
 then raise exception 'dry run released hold';end if;
end $$;
rollback;
select 'Reply batch integrity, 80-point release, holds, replay, stale decisions, atomic rollback, dry run and removal guards PASS' as result;
