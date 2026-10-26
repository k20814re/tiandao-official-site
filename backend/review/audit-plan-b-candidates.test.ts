/** Offline regression test for the Plan B audit: no network, DB, or secrets. */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const folder = mkdtempSync(join(tmpdir(), "plan-b-audit-"));
try {
  const file = join(folder, "candidates.json");
  const candidate = (title: string, url: string) => ({
    title_zh: title, starts_at: "2026-11-13", ends_at: "2026-11-16",
    city: "臺北", venue_name: "南港展覽館", official_url: url,
    evidence_fields: ["title_zh", "starts_at"],
    source_license_cleared: false, facts_verified: false
  });
  writeFileSync(file, JSON.stringify({events:[
    candidate("Wine Show", "https://www.tainex.com.tw/event?hall=2"),
    candidate("Pet Show", "https://www.chanchao.com.tw/"),
    candidate("ITF", "https://www.taiwanitf.org.tw/Information3")
  ]}));
  const p = spawnSync(process.execPath, ["--experimental-strip-types", "backend/review/audit-plan-b-candidates.ts", file], {encoding:"utf8"});
  assert.equal(p.status, 0, p.stderr);
  const lines = p.stdout.trim().split("\n").map((line: string) => JSON.parse(line));
  assert.equal(lines.length, 4);
  assert.equal(lines[3].total, 3);
  assert.equal(lines[3].blocked, 3);
  assert.equal(lines[3].publicationAuthorized, 0);
  assert(lines[0].blockers.includes("E001:generic_event_calendar_not_specific"));
  assert(lines[1].blockers.includes("E001:official_event_specific_url_required"));
  assert(lines[2].blockers.includes("E011:source_check_missing"));
  for (const row of lines.slice(0, 3)) {
    assert(row.blockers.includes("E005:source_license_not_cleared"));
    assert(row.blockers.includes("E010:official_facts_not_verified"));
    assert.equal(row.preliminaryGatePass, false);
  }
  console.log("Plan B audit regression: PASS (3 blocked fixtures)");
} finally { rmSync(folder, {recursive:true,force:true}); }
