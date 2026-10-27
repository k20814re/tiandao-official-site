/** Offline regression for the draft publication freeze migration. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("backend/migrations/20261027_exhibition_publication_freeze_draft.sql","utf8");
assert.match(sql,/tg_op='INSERT'\s+and new\.publication_status='published'/i);
assert.match(sql,/tg_op='UPDATE'\s+and new\.publication_status='published'/i);
assert.doesNotMatch(sql,/old\.publication_status\s+is distinct from\s+'published'/i);
assert.match(sql,/before insert or update on public\.trade_events/i);
assert.match(sql,/raise exception 'publication_locked_pending_mfa_and_evidence_review'/i);
console.log("Draft publication freeze static regression PASS (no DB connection)");
