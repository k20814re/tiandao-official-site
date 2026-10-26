-- STAGING ONLY. Transaction rolls back all inserted test rows.
-- Prerequisites: email approval + outbox worker draft migrations applied
-- to a SEPARATE staging project. Run as privileged SQL editor only.
-- No Resend call or email delivery is performed.
begin;
select set_config('request.jwt.claim.role','service_role',true);

do $$
declare
  v_id uuid := gen_random_uuid();
  v_row public.exhibition_notification_outbox%rowtype;
  v_ok boolean;
  v_st text;
  v_err text;
begin
  insert into public.exhibition_notification_outbox
    (id,recipient,kind,idempotency_key,payload)
  values
    (v_id,'k20814re@gmail.com','anomaly',
     'staging-claim-'||replace(v_id::text,'-',''),
     '{"subject":"STAGING TEST","text":"No email will be sent"}'::jsonb);

  select * into v_row from public.claim_exhibition_notification(90);
  if not found or v_row.id<>v_id or v_row.status<>'sending' or v_row.attempts<>1 then
    raise exception 'claim_should_lease_one_row';
  end if;

  select public.finish_exhibition_notification(
    v_id,v_row.claimed_at,true,'mock-provider-id',null,false
  ) into v_ok;
  if not v_ok then raise exception 'finish_should_succeed'; end if;

  select status into v_st from public.exhibition_notification_outbox where id=v_id;
  if v_st<>'sent' then raise exception 'expected_sent_got_%',v_st; end if;

  -- Idempotent stale acknowledgement must be rejected.
  select public.finish_exhibition_notification(
    v_id,v_row.claimed_at,true,'mock-provider-id',null,false
  ) into v_ok;
  if v_ok then raise exception 'replayed_ack_should_fail'; end if;

  -- Simulate a worker crash after fifth attempt and expired lease.
  update public.exhibition_notification_outbox
    set status='sending',attempts=5,
        lease_until=now()-interval '1 minute'
    where id=v_id;
  perform public.claim_exhibition_notification(90);
  select status,last_error into v_st,v_err
    from public.exhibition_notification_outbox where id=v_id;
  if v_st<>'failed' or v_err<>'retry_limit_exhausted_after_lease_expiry' then
    raise exception 'expired_fifth_attempt_should_fail';
  end if;
  raise notice 'staging outbox SQL assertions passed (transaction will rollback)';
end $$;
rollback;
