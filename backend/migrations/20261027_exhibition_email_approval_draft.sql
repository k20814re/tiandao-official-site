-- DESIGN ONLY: review in staging; do not apply to production without authorization.
-- Requires exhibition_admin_profiles and trade_events from exhibition_admin_v1.
begin;
create extension if not exists pgcrypto;
create table if not exists public.exhibition_review_batches (
 id uuid primary key default gen_random_uuid(),
 status text not null default 'pending' check(status in ('pending','selected','awaiting_confirmation','published','rejected','expired')),
 created_at timestamptz not null default now(),
 reviewer_id uuid references auth.users(id),
 evidence_digest text not null,
 expires_at timestamptz not null default (now()+interval '24 hours'),
 confirmed_at timestamptz
);
create table if not exists public.exhibition_review_items (
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null references public.exhibition_review_batches(id) on delete cascade,
 event_id uuid references public.trade_events(id),
 candidate_payload jsonb not null,
 evidence jsonb not null default '{}'::jsonb,
 anomaly_codes text[] not null default '{}',
 severity text not null check(severity in ('blocker','review','info')),
 fact_verified boolean not null default false,
 license_approved boolean not null default false,
 decision text not null default 'pending' check(decision in ('pending','approved','rejected','recheck')),
 decision_reason text,
 evidence_digest text not null,
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 unique(batch_id,event_id)
);
create table if not exists public.exhibition_review_challenges (
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null references public.exhibition_review_batches(id) on delete cascade,
 reviewer_id uuid not null references auth.users(id),
 token_hash text not null unique,
 evidence_digest text not null,
 expires_at timestamptz not null,
 used_at timestamptz,
 attempts int not null default 0 check(attempts between 0 and 10)
);
create table if not exists public.exhibition_notification_outbox (
 id uuid primary key default gen_random_uuid(),
 batch_id uuid references public.exhibition_review_batches(id),
 recipient text not null,
 kind text not null check(kind in ('anomaly','confirm','receipt')),
 idempotency_key text not null unique,
 payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
 attempts int not null default 0,
 last_error text,
 created_at timestamptz not null default now(),
 sent_at timestamptz
);
create table if not exists public.exhibition_review_audit (
 id bigint generated always as identity primary key,
 batch_id uuid references public.exhibition_review_batches(id),
 item_id uuid references public.exhibition_review_items(id),
 actor_id uuid references auth.users(id),
 action text not null,
 details jsonb not null default '{}'::jsonb,
 occurred_at timestamptz not null default now()
);
alter table public.exhibition_review_batches enable row level security;
alter table public.exhibition_review_items enable row level security;
alter table public.exhibition_review_challenges enable row level security;
alter table public.exhibition_notification_outbox enable row level security;
alter table public.exhibition_review_audit enable row level security;
-- No anon/authenticated policies or grants: all writes/reads are backend-only.
-- SECURITY: do not add direct client UPDATE/INSERT grants.
-- Backend must authenticate publisher role and verify digest, expiry, token replay,
-- all legal/fact gates, and event version before publishing transactionally.
commit;
