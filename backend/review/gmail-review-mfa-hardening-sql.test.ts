import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("backend/migrations/20261027_gmail_review_mfa_hardening_draft.sql","utf8");
for(const s of ["DRAFT ONLY","exhibition_review_authorizations","consumed_at is null","authorization_id=p_authorization_id","mfa_verified_at>clock_timestamp()-interval '5 minutes'","drop function if exists public.record_gmail_review_decision(text,text,uuid,text,text,text,boolean)","to service_role","enable row level security"])assert.ok(sql.includes(s),s);
assert.ok(!/p_mfa_verified\s+boolean/i.test(sql));
assert.ok(!/update\s+public\.trade_events/i.test(sql));
console.log("MFA hardening draft static tests PASS");
