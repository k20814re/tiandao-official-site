-- Tests real PostgreSQL transactions. Auth helpers are test fixtures, not Supabase Auth.
do $$
declare t text; r text;
begin
 foreach t in array array['exhibition_review_batches','exhibition_review_items','exhibition_review_challenges','exhibition_notification_outbox','exhibition_review_audit','exhibition_gmail_reply_intents','exhibition_gmail_review_challenges','exhibition_gmail_review_decisions','exhibition_review_authorizations'] loop
  foreach r in array array['anon','authenticated'] loop
   if has_table_privilege(r,'public.'||t,'TRUNCATE') then raise exception 'backend table permits truncate: % %',r,t;end if;
  end loop;
 end loop;
 if to_regprocedure('public.record_gmail_review_decision(text,text,uuid,text,text,text,boolean)') is not null then raise exception 'legacy MFA boolean RPC still exists';end if;
 if has_function_privilege('authenticated','public.record_gmail_review_decision(text,text,uuid,text,text,text,uuid)','EXECUTE') then raise exception 'client may invoke review RPC';end if;
 if not has_function_privilege('service_role','public.record_gmail_review_decision(text,text,uuid,text,text,text,uuid)','EXECUTE') then raise exception 'backend cannot invoke review RPC';end if;
 begin
  insert into public.trade_events(publication_status) values('published');
  raise exception 'published insert was not blocked';
 exception when insufficient_privilege then null;end;
 begin
  update public.trade_events set publication_status='published' where publication_status='published';
  raise exception 'published update was not blocked';
 exception when insufficient_privilege then null;end;
end $$;
set role anon;
do $$ begin
 begin perform 1 from public.exhibition_gmail_review_challenges;raise exception 'anonymous challenge read allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into public.exhibition_gmail_review_challenges(review_id,challenge_sha256,expected_admin_id,evidence_sha256,expires_at)
select 'review-'||i,repeat('a',64),'00000000-0000-4000-8000-000000000001'::uuid,repeat('b',64),now()+interval '1 hour' from generate_series(1,3)i;
insert into public.exhibition_review_authorizations(authorization_id,review_id,admin_id,mfa_verified_at,authenticated_at,expires_at)
select ('00000000-0000-4000-8000-00000000000'||(i+1))::uuid,'review-'||i,'00000000-0000-4000-8000-000000000001'::uuid,now(),now(),now()+interval '1 hour' from generate_series(1,3)i;
set role service_role;
select set_config('request.jwt.claim.role','service_role',false);
do $$
begin
 if public.record_gmail_review_decision('review-1',repeat('x',257),'00000000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),'approve','00000000-0000-4000-8000-000000000002') then raise exception 'oversized message accepted';end if;
 if public.record_gmail_review_decision('review-1','bad!id','00000000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),'approve','00000000-0000-4000-8000-000000000002') then raise exception 'invalid message accepted';end if;
 if not public.record_gmail_review_decision('review-1',repeat('x',256),'00000000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),'approve','00000000-0000-4000-8000-000000000002') then raise exception 'valid decision failed';end if;
 if public.record_gmail_review_decision('review-1','message-replay','00000000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),'approve','00000000-0000-4000-8000-000000000002') then raise exception 'replay accepted';end if;
 -- Duplicate Gmail ID must roll back authorization AND challenge consumption.
 if public.record_gmail_review_decision('review-2',repeat('x',256),'00000000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),'approve','00000000-0000-4000-8000-000000000003') then raise exception 'duplicate message accepted';end if;
 if not public.record_gmail_review_decision('review-2','message-2','00000000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),'reject','00000000-0000-4000-8000-000000000003') then raise exception 'duplicate rollback lost authorization';end if;
 -- Evidence mismatch must also preserve the authorization for a correct retry.
 if public.record_gmail_review_decision('review-3','message-3','00000000-0000-4000-8000-000000000001',repeat('a',64),repeat('c',64),'approve','00000000-0000-4000-8000-000000000004') then raise exception 'wrong evidence accepted';end if;
 if not public.record_gmail_review_decision('review-3','message-3','00000000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),'approve','00000000-0000-4000-8000-000000000004') then raise exception 'evidence rollback lost authorization';end if;
end $$;
reset role;
insert into public.exhibition_notification_outbox(recipient,kind,idempotency_key,payload) values('test@example.invalid','anomaly','ci-only','{}');
set role service_role;
do $$
declare job public.exhibition_notification_outbox; extra int;
begin
 select * into job from public.claim_exhibition_notification(90);
 if job.id is null or job.attempts<>1 then raise exception 'outbox claim failed';end if;
 select count(*) into extra from public.claim_exhibition_notification(90);
 if extra<>0 then raise exception 'leased job claimed twice';end if;
 if public.finish_exhibition_notification(job.id,job.claimed_at-interval '1 second',true,'fake-provider',null,false) then raise exception 'wrong lease accepted';end if;
 if not public.finish_exhibition_notification(job.id,job.claimed_at,true,'fake-provider',null,false) then raise exception 'outbox completion failed';end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.trade_events where publication_status='published')<>1 then raise exception 'review changed published events';end if;
 if (select count(*) from public.exhibition_gmail_review_decisions)<>3 then raise exception 'unexpected decision count';end if;
 if (select count(*) from public.exhibition_notification_outbox where status='sent')<>1 then raise exception 'outbox not sent';end if;
end $$;
select 'PostgreSQL transaction, replay, rollback, privilege and outbox checks PASS' as result;
