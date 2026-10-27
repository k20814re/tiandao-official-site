-- SECURITY HARDENING DRAFT ONLY. NEVER RUN ON PRODUCTION WITHOUT APPROVAL.
-- Replaces unsafe caller-supplied p_mfa_verified with trusted, database-held
-- one-time authorization minted by a separate MFA-verified server workflow.
-- This is NOT a complete MFA verifier. It must never be exposed to the browser.
begin;
create table if not exists public.exhibition_review_authorizations (
 authorization_id uuid primary key,
 review_id text not null references public.exhibition_gmail_review_challenges(review_id),
 admin_id uuid not null,
 mfa_verified_at timestamptz not null,
 authenticated_at timestamptz not null,
 expires_at timestamptz not null,
 consumed_at timestamptz,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.exhibition_review_authorizations enable row level security;
revoke all on public.exhibition_review_authorizations from public,anon,authenticated;
-- Drop legacy signature: callers MUST NOT be able to pass a Boolean to claim MFA.
drop function if exists public.record_gmail_review_decision(text,text,uuid,text,text,text,boolean);
create or replace function public.record_gmail_review_decision(
 p_review_id text,p_message_id text,p_admin_id uuid,
 p_challenge_sha256 text,p_evidence_sha256 text,p_decision text,
 p_authorization_id uuid
) returns boolean language plpgsql security definer
set search_path=pg_catalog,public,pg_temp
as $$
declare v_authorization_id uuid;v_review_id text;
begin
 if p_review_id is null or length(p_review_id)>128
 or p_message_id is null or p_message_id !~ '^[A-Za-z0-9_-]{1,256}$'
 or p_admin_id is null or p_authorization_id is null
 or p_decision is null or p_decision not in ('approve','reject')
 or p_challenge_sha256 is null or p_challenge_sha256 !~ '^[a-f0-9]{64}$'
 or p_evidence_sha256 is null or p_evidence_sha256 !~ '^[a-f0-9]{64}$'
 then return false;end if;
 -- Consume one-time DB-held authorization. No caller-supplied MFA flag.
 update public.exhibition_review_authorizations
 set consumed_at=clock_timestamp()
 where authorization_id=p_authorization_id and review_id=p_review_id
 and admin_id=p_admin_id and consumed_at is null
 and expires_at>clock_timestamp()
 and mfa_verified_at<=clock_timestamp()
 and mfa_verified_at>clock_timestamp()-interval '5 minutes'
 and authenticated_at<=clock_timestamp()
 and authenticated_at>clock_timestamp()-interval '30 minutes'
 returning authorization_id into v_authorization_id;
 if v_authorization_id is null then return false;end if;
 update public.exhibition_gmail_review_challenges
 set consumed_at=clock_timestamp()
 where review_id=p_review_id and expected_admin_id=p_admin_id
 and challenge_sha256=p_challenge_sha256
 and evidence_sha256=p_evidence_sha256
 and consumed_at is null and expires_at>clock_timestamp()
 returning review_id into v_review_id;
 if v_review_id is null then\n  raise exception using errcode='P0001', message='review_challenge_not_consumable';\n end if;
 insert into public.exhibition_gmail_review_decisions
 (gmail_message_id,review_id,admin_id,decision,evidence_sha256)
 values(p_message_id,p_review_id,p_admin_id,p_decision,p_evidence_sha256);
 return true;
exception\n when unique_violation or raise_exception then\n  -- Exception block rolls back BOTH prior UPDATEs as one subtransaction.\n  return false;
end;
$$;
revoke all on function public.record_gmail_review_decision(text,text,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.record_gmail_review_decision(text,text,uuid,text,text,text,uuid) to service_role;
-- CRITICAL: authorization rows must ONLY be inserted by trusted server code
-- after independently verifying recent MFA, identity, role, explicit consent,
-- and current evidence. service_role credentials must never reach a browser.
-- This function records decisions only; it does not publish trade_events.
commit;
