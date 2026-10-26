-- DRAFT ONLY — STAGING REVIEW REQUIRED. Never apply to production without authorization.
-- Temporary publication freeze until a separate, authenticated MFA + evidence
-- approval transaction is implemented and tested.
--
-- SECURITY REVIEW:
-- 20261025_exhibition_admin_v1.sql allows publisher-role clients to write
-- publication_status='published' directly. RLS grants UPDATE to those clients.
-- A Gmail reply or checked box is NOT an authorization to publish.
-- PostgreSQL RLS policies are additive; this BEFORE trigger blocks direct
-- publication regardless of any permissive pre-existing RLS policy.
begin;
create or replace function public.block_unreviewed_exhibition_publication()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if tg_op='INSERT' and new.publication_status='published' then
    raise exception 'publication_locked_pending_mfa_and_evidence_review'
      using errcode='42501';
  end if;
  if tg_op='UPDATE' and new.publication_status='published'
    and old.publication_status is distinct from 'published' then
    raise exception 'publication_locked_pending_mfa_and_evidence_review'
      using errcode='42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trade_events_publication_freeze on public.trade_events;
create trigger trade_events_publication_freeze
  before insert or update on public.trade_events
  for each row execute function public.block_unreviewed_exhibition_publication();

-- Freeze is deliberately NOT a complete final publication authorization.
-- Do not remove it until a transactionally verified, backend-only publish
-- procedure has been implemented and passed staging security tests.
commit;
