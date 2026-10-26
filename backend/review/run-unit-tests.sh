#!/usr/bin/env bash
# Run locally or in CI. No network, secrets, DB writes, or email delivery.
set -euo pipefail
node --experimental-strip-types backend/review/exhibition-anomaly-rules.test.ts
node --experimental-strip-types backend/review/anomaly-email-template.test.ts
node --experimental-strip-types backend/review/resend-notifier.test.ts
node --experimental-strip-types backend/review/publication-preflight.test.ts
echo "All exhibition review mock/policy test scripts completed."
