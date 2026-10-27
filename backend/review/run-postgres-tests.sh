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
