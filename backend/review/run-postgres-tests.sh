#!/usr/bin/env bash
# ONLY a fresh, disposable local database. Never accepts a remote project host.
set -euo pipefail
case "${PGHOST:-}" in localhost|127.0.0.1) ;; *) echo 'Refusing non-local PostgreSQL host' >&2; exit 1;; esac
[[ "${PGDATABASE:-}" == exhibition_review_test ]] || { echo 'Refusing non-test database' >&2; exit 1; }
psql -X -v ON_ERROR_STOP=1 -f backend/review/sql/local-review-fixture.sql
for migration in \
  20261027_exhibition_email_approval_draft.sql \
  20261027_exhibition_gmail_reply_intents_draft.sql \
  20261027_gmail_review_atomic_draft.sql \
  20261027_gmail_review_mfa_hardening_draft.sql \
  20261027_exhibition_outbox_worker_draft.sql \
  20261027_exhibition_admin_identity_hardening_draft.sql \
  20261027_exhibition_publication_freeze_draft.sql; do
  psql -X -v ON_ERROR_STOP=1 -f "backend/migrations/$migration"
done
psql -X -v ON_ERROR_STOP=1 -f backend/review/sql/review-transactions.test.sql
psql -X -v ON_ERROR_STOP=1 -f backend/review/sql/review-concurrency-fixture.sql
# Separate PostgreSQL sessions compete for the same one-time authorization.
psql -X -v ON_ERROR_STOP=1 -f backend/review/sql/review-concurrent-call.sql &
first_worker=$!
psql -X -v ON_ERROR_STOP=1 -f backend/review/sql/review-concurrent-call.sql &
second_worker=$!
wait "$first_worker"
wait "$second_worker"
psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if (select count(*) from public.exhibition_gmail_review_decisions where review_id='concurrent-review')<>1 then raise exception 'concurrent review did not produce exactly one decision';end if;
 if (select count(*) from public.exhibition_review_authorizations where review_id='concurrent-review' and consumed_at is not null)<>1 then raise exception 'concurrent authorization consumed incorrectly';end if;
end $$;
select 'PostgreSQL two-session one-time authorization checks PASS' as result;
SQL
psql -X -v ON_ERROR_STOP=1 -f backend/review/sql/automation-fixture.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261027071034_exhibition_automation_v1.sql
psql -X -v ON_ERROR_STOP=1 -f backend/review/sql/automation-transactions.test.sql
