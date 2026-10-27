-- Disposable local test database only; verify independent publication/removal and holds.
update exhibition_automation.settings set apply_changes=true,archive_changes=false;
insert into exhibition_automation.review_holds(canonical_key,reason) values('moc:ci-hold','hold');
set role service_role;
do $$
declare rid uuid; r jsonb; p jsonb; e jsonb; begin
 rid:=(public.exhibition_automation_start('ci-only-token')->>'run_id')::uuid;
 perform public.exhibition_automation_feed(rid,'moc-exhibitions',10,true);
 p:='{"canonical_key":"moc:ci-hold","external_id":"ci-hold","title_zh":"Held exhibition","starts_at":"2026-11-01T00:00:00+08:00","ends_at":"2026-11-03T23:59:59+08:00","city":"臺北市","venue_name":"Held venue"}'::jsonb;
 e:='{"policy_version":"2026-10-27.v1","detail_http":200,"list_url":"https://cloud.culture.tw/list","detail_url":"https://cloud.culture.tw/detail","gates":{"licensed":true,"identity":true,"title":true,"dates":true,"place":true,"detail":true}}'::jsonb;
 r:=public.exhibition_automation_submit(rid,'moc-exhibitions',p,e,repeat('1',64));
 if r->>'action'<>'manual_review' or exists(select 1 from public.trade_events where canonical_key='moc:ci-hold') then raise exception 'held item was published';end if;
 r:=public.exhibition_automation_submit(rid,'moc-exhibitions',p||'{"canonical_key":"moc:ci-pass","external_id":"ci-pass","venue_name":"Other venue"}',e,repeat('2',64));
 if r->>'action'<>'published' then raise exception 'unheld item blocked: %',r;end if;
 r:=public.exhibition_automation_submit(rid,'moc-exhibitions',p||'{"canonical_key":"moc:ci-bad","external_id":"ci-bad"}',jsonb_set(e,'{gates,place}','false'),repeat('3',64));
 if r->>'action'<>'manual_review' then raise exception 'low-confidence item published';end if;
 update exhibition_automation.state set absent_checks=2,missing_since=now()-interval '25 hours',last_missing_at=now()-interval '7 hours' where canonical_key='moc:ci-pass';
 r:=public.exhibition_automation_missing(rid,'moc:ci-pass',true,'https://cloud.culture.tw/detail',200);
 if r->>'action'<>'would_archive' or (select publication_status from public.trade_events where canonical_key='moc:ci-pass')<>'published' then raise exception 'disabled archive still removed item: %',r;end if;
 perform public.exhibition_automation_finish(rid,'{}',true);
end $$;
reset role;
select 'Holds, separate publication and archive, and low-score isolation PASS' as result;
