/** Plan B: audit the candidate JSON without publishing or changing Supabase. */
import { readFileSync } from "node:fs";
import { checkManualCandidate, type ManualCandidate } from "./manual-exhibition-gate.ts";

type Candidate = ManualCandidate & { reviewer_notes?: string; evidence_fields?: string[] };
const input = process.argv[2] || "backend/review/plan-b-first-batch-candidates.json";
const parsed:unknown = JSON.parse(readFileSync(input, "utf8"));
if (!parsed || typeof parsed !== "object" || !("events" in parsed) ||
    !Array.isArray((parsed as {events:unknown}).events)) {
  throw new Error("invalid_candidate_manifest");
}
const rows = (parsed as {events:Candidate[]}).events;
const keys = new Set<string>();
let blocked = 0;
for (const [index, row] of rows.entries()) {
  if (!row || typeof row !== "object") throw new Error(`invalid_candidate_${index}`);
  const key = [row.title_zh?.trim(),row.starts_at].join("|");
  const problems = checkManualCandidate(row);
  if (keys.has(key)) problems.push("E007:duplicate_candidate");
  if (!Array.isArray(row.evidence_fields) || row.evidence_fields.length === 0) problems.push("E014:evidence_fields_missing");
  try {
    const u = new URL(row.official_url);
    if (u.search && /^(?:\/event|\/exhibition)\/?$/i.test(u.pathname)) problems.push("E001:generic_event_calendar_not_specific");
  } catch { /* invalid URLs are already caught by the manual gate */ }
  keys.add(key);
  if (problems.length) blocked++;
  console.log(JSON.stringify({row:index+1,title:row.title_zh,preliminaryGatePass:problems.length===0,blockers:problems}));
}
console.log(JSON.stringify({total:rows.length,blocked,preliminaryPass:rows.length-blocked,publicationAuthorized:0}));
