-- DRAFT ONLY: do not run on production.
-- Apply only to isolated staging after review of base outbox migration.
-- Service-role-only leasing to avoid duplicate workers.
begin;

alter table public.exhibition_notification_outbox
  add column if not exists claimed_at timestamptz,
  add column if not exists lease_until timestamptz,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists provider_message_id text;

create index if not exists exhibition_outbox_claim_idx
  on public.exhibition_notification_outbox (status,next_attempt_at,lease_until,created_at);

create or replace function public.claim_exhibition_notification(p_lease_seconds integer default 90)
returns setof public.exhibition_notification_outbox
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode='42501';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 300 then
    raise exception 'invalid_lease';
  end if;
  -- A worker can crash after its final permitted send attempt.
  -- Do not leave the exhausted row permanently in 'sending'.
  update public.exhibition_notification_outbox o
  set status='failed', lease_until=null,
      last_error='retry_limit_exhausted_after_lease_expiry'
  where o.status='sending' and o.lease_until<now() and o.attempts>=5;

  return query
  with picked as (
    select o.id
    from public.exhibition_notification_outbox o
    where (
      (o.status='pending' and o.next_attempt_at<=now())
      or (o.status='sending' and o.lease_until<now())
    )
    and o.attempts<5
    order by o.created_at,o.id
    for update skip locked
    limit 1
  )
  update public.exhibition_notification_outbox o
  set status='sending', attempts=o.attempts+1,
      claimed_at=now(), lease_until=now()+make_interval(secs=>p_lease_seconds)
  from picked where o.id=picked.id
  returning o.*;
end;
$$;

create or replace function public.finish_exhibition_notification(
  p_id uuid,
  p_claimed_at timestamptz,
  p_success boolean,
  p_provider_message_id text default null,
  p_error text default null,
  p_retryable boolean default false
)
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_attempts integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode='42501';
  end if;
  select attempts into v_attempts
  from public.exhibition_notification_outbox
  where id=p_id and status='sending' and claimed_at=p_claimed_at
  for update;
  if not found then return false; end if;
  if p_success and (p_provider_message_id is null or length(p_provider_message_id)=0) then
    raise exception 'missing_provider_message_id';
  end if;
  update public.exhibition_notification_outbox
  set status=case when p_success then 'sent'
                  when p_retryable and v_attempts<5 then 'pending'
                  else 'failed' end,
      sent_at=case when p_success then now() else null end,
      provider_message_id=case when p_success then p_provider_message_id else null end,
      last_error=case when p_success then null else left(coalesce(p_error,'unknown_error'),300) end,
      next_attempt_at=case when not p_success and p_retryable and v_attempts<5
                      then now()+make_interval(secs=>least(3600,30*power(2,v_attempts-1)::integer))
                      else next_attempt_at end,
      lease_until=null
  where id=p_id;
  return true;
end;
$$;

revoke all on function public.claim_exhibition_notification(integer) from public,anon,authenticated;
revoke all on function public.finish_exhibition_notification(uuid,timestamptz,boolean,text,text,boolean) from public,anon,authenticated;
grant execute on function public.claim_exhibition_notification(integer) to service_role;
grant execute on function public.finish_exhibition_notification(uuid,timestamptz,boolean,text,text,boolean) to service_role;
commit;
