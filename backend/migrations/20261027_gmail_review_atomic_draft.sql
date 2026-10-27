-- DRAFT ONLY. DO NOT APPLY TO PRODUCTION WITHOUT EXPLICIT APPROVAL.
-- Atomic, backend-only review decision recording. NEVER publishes trade_events.
-- Requires trusted server to authenticate administrator + fresh MFA, validate
-- Gmail sender independently, and compute challenge SHA-256 before invoking.
begin;
create table if not exists public.exhibition_gmail_review_challenges (
 review_id text primary key,
 challenge_sha256 text not null check (challenge_sha256 ~ '^[a-f0-9]{64}$'),
 expected_admin_id uuid not null,
 evidence_sha256 text not null check (evidence_sha256 ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.exhibition_gmail_review_decisions (
 gmail_message_id text primary key,
 review_id text not null unique references public.exhibition_gmail_review_challenges(review_id),
 admin_id uuid not null,
 decision text not null check (decision in ('approve','reject')),
 evidence_sha256 text not null,
 decided_at timestamptz not null default now()
);
alter table public.exhibition_gmail_review_challenges enable row level security;
alter table public.exhibition_gmail_review_decisions enable row level security;
revoke all on public.exhibition_gmail_review_challenges from public, anon, authenticated;
revoke all on public.exhibition_gmail_review_decisions from public, anon, authenticated;
-- Function intentionally records an audit decision only. Never changes publication.
create or replace function public.record_gmail_review_decision(
 p_review_id text,p_message_id text,p_admin_id uuid,
 p_challenge_sha256 text,p_evidence_sha256 text,p_decision text,
 p_mfa_verified boolean
) returns boolean
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_review_id text;
begin
 if p_review_id is null or length(p_review_id)>128
    or p_message_id is null or length(p_message_id) not between 1 and 256 or p_message_id !~ '^[A-Za-z0-9_-]+$'
    or p_admin_id is null or p_decision not in ('approve','reject')
    or p_mfa_verified is distinct from true
    or p_challenge_sha256 !~ '^[a-f0-9]{64}$'
    or p_evidence_sha256 !~ '^[a-f0-9]{64}$'
 then return false; end if;
 -- UPDATE is the single atomic consume point. Concurrent/replayed requests
 -- cannot consume the same challenge twice.
 update public.exhibition_gmail_review_challenges
 set consumed_at=clock_timestamp()
 where review_id=p_review_id and expected_admin_id=p_admin_id
   and challenge_sha256=p_challenge_sha256
   and evidence_sha256=p_evidence_sha256
   and consumed_at is null and expires_at>clock_timestamp()
 returning review_id into v_review_id;
 if v_review_id is null then return false; end if;
 -- Unique Gmail ID and review ID prevent replay across requests.
 -- Any uniqueness violation rolls back the consume in the same transaction.
 insert into public.exhibition_gmail_review_decisions
 (gmail_message_id,review_id,admin_id,decision,evidence_sha256)
 values (p_message_id,p_review_id,p_admin_id,p_decision,p_evidence_sha256);
 return true;
exception when unique_violation then
 -- PL/pgSQL exception subtransaction rolls back the UPDATE too.
 return false;
end;
$$;
revoke all on function public.record_gmail_review_decision(text,text,uuid,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.record_gmail_review_decision(text,text,uuid,text,text,text,boolean) to service_role;
-- NOTE: service_role can supply p_admin_id and p_mfa_verified. The caller MUST
-- derive both from trusted server auth, never from request JSON/email headers.
-- Production must audit role/MFA binding and enforce evidence recheck before
-- any separate publishing transaction. Review migration on staging first.
commit;
