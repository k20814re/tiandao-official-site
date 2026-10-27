#!/usr/bin/env bash
# Run locally or in CI. No network, secrets, DB writes, or email delivery.
set -euo pipefail
node --experimental-strip-types backend/review/exhibition-anomaly-rules.test.ts
node --experimental-strip-types backend/review/anomaly-email-template.test.ts
node --experimental-strip-types backend/review/resend-notifier.test.ts
node --experimental-strip-types backend/review/gmail-oauth.test.ts
node --experimental-strip-types backend/review/gmail-oauth-state.test.ts
node --experimental-strip-types backend/review/gmail-token-exchange.test.ts
node --experimental-strip-types backend/review/gmail-token-vault.test.ts
node --experimental-strip-types backend/review/gmail-readonly.test.ts
node --experimental-strip-types backend/review/gmail-mime.test.ts
node --experimental-strip-types backend/review/gmail-review-reply.test.ts
node --experimental-strip-types backend/review/gmail-review-gate.test.ts
node --experimental-strip-types backend/review/gmail-review-pipeline.test.ts
node --experimental-strip-types backend/review/gmail-review-promotion.test.ts
node --experimental-strip-types backend/review/trusted-admin-session.test.ts
node --experimental-strip-types backend/review/gmail-inbox-dry-run.test.ts
node --experimental-strip-types backend/review/gmail-review-atomic-sql.test.ts
node --experimental-strip-types backend/review/gmail-review-mfa-hardening-sql.test.ts
node --experimental-strip-types backend/review/gmail-review-rollback-sql.test.ts
node --experimental-strip-types backend/review/gmail-review-recorder.test.ts
node --experimental-strip-types backend/review/gmail-review-rpc.test.ts
node --experimental-strip-types backend/review/gmail-review-orchestrator.test.ts
node --experimental-strip-types backend/review/gmail-review-concurrency.test.ts
node --experimental-strip-types backend/review/source-ingestion-policy.test.ts
node --experimental-strip-types backend/review/publication-preflight.test.ts
node --experimental-strip-types backend/review/outbox-worker.test.ts
node --experimental-strip-types backend/review/manual-exhibition-gate.test.ts
node --experimental-strip-types backend/review/audit-plan-b-candidates.test.ts
node --experimental-strip-types backend/review/build-plan-b-local-preview.test.ts
node --experimental-strip-types backend/review/plan-b-ten-candidate.integration.test.ts
node --experimental-strip-types backend/review/review-preview-syntax.test.ts
node --experimental-strip-types backend/review/publication-freeze-sql.test.ts
node --experimental-strip-types backend/review/admin-identity-sql.test.ts
node --experimental-strip-types backend/review/admin-login-static.test.ts
node --experimental-strip-types backend/review/affiliate-static.test.ts
echo "All exhibition review mock/policy test scripts completed."
