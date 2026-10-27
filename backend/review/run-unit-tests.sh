#!/usr/bin/env bash
# Run locally or in CI. No network, secrets, DB writes, or email delivery.
set -euo pipefail
node --experimental-strip-types backend/review/exhibition-anomaly-rules.test.ts
node --experimental-strip-types backend/review/anomaly-email-template.test.ts
node --experimental-strip-types backend/review/resend-notifier.test.ts
node --experimental-strip-types backend/review/gmail-review-reply.test.ts
node --experimental-strip-types backend/review/gmail-review-gate.test.ts
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
echo "All exhibition review mock/policy test scripts completed."
