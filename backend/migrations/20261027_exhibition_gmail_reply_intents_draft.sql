-- DRAFT ONLY. Do not run against production.
-- Gmail reply is an intent signal, never a publication authorization.
begin;
create table if not exists public.exhibition_gmail_reply_intents (
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null references public.exhibition_review_batches(id) on delete cascade,
 reviewer_id uuid not null references auth.users(id),
 gmail_message_id text not null unique,
 gmail_thread_id text not null,
 reply_code_hash text not null,
 reply_code_expires_at timestamptz not null,
 evidence_digest text not null,
 verification_status text not null default 'pending'
  check (verification_status in ('pending','verified','rejected','expired')),
 rejection_reason text,
 verified_at timestamptz,
 consumed_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index if not exists exhibition_gmail_one_verified_reply_per_batch
 on public.exhibition_gmail_reply_intents(batch_id) where verification_status='verified' and consumed_at is null;
alter table public.exhibition_gmail_reply_intents enable row level security;
-- Backend-only: do not grant access to anon or authenticated clients.
-- Confirming a reply must not update trade_events/publication_status.
commit;
