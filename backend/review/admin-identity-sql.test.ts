import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("backend/migrations/20261027_exhibition_admin_identity_hardening_draft.sql","utf8");
assert.match(sql,/where p\.user_id\s*=\s*\(select auth\.uid\(\)\)/i);
assert.match(sql,/revoke insert, update, delete on public\.exhibition_admin_profiles from anon, authenticated/i);
assert.match(sql,/grant select on public\.exhibition_admin_profiles to authenticated/i);
assert.match(sql,/using \(user_id\s*=\s*\(select auth\.uid\(\)\)\)/i);
assert.doesNotMatch(sql,/grant\s+(insert|update|delete)\s+on public\.exhibition_admin_profiles\s+to\s+authenticated/i);
console.log("Admin identity SQL static guard PASS (no database connection)");
