import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("backend/migrations/20261027_gmail_review_atomic_draft.sql","utf8");
for(const required of [
 "DRAFT ONLY","enable row level security","revoke all on public.exhibition_gmail_review_challenges",
 "revoke all on public.exhibition_gmail_review_decisions","security definer",
 "consumed_at is null","expires_at>clock_timestamp()","returning review_id",
 "gmail_message_id text primary key","review_id text not null unique",
 "grant execute on function public.record_gmail_review_decision",
 "to service_role","p_mfa_verified is distinct from true"
])assert.ok(sql.includes(required),required);
assert.ok(!/update\s+public\.trade_events/i.test(sql));
assert.ok(!/insert\s+into\s+public\.trade_events/i.test(sql));
console.log("Atomic Gmail review SQL draft static checks PASS");
