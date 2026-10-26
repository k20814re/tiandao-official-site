import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const dir = mkdtempSync(join(tmpdir(), "planb-preview-"));
try {
  const input = join(dir, "input.json");
  const output = join(dir, "output.json");
  const candidate = (name: string, url: string) => ({
    title_zh: name, starts_at: "2026-11-13", ends_at: "2026-11-16",
    city: "臺北", venue_name: "南港展覽館", official_url: url,
    source_license_cleared: false, facts_verified: false
  });
  writeFileSync(input, JSON.stringify({ events: [
    candidate("ITF", "https://www.taiwanitf.org.tw/QA"),
    candidate("Wine", "https://www.tainex.com.tw/event?hall=2"),
    candidate("Pet", "https://www.chanchao.com.tw/")
  ] }));
  const run = () => spawnSync(process.execPath, [
    "--experimental-strip-types",
    "backend/review/build-plan-b-local-preview.ts", input, output
  ], { encoding: "utf8" });
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  const result = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(result.total, 3);
  assert.equal(result.publishable, 0);
  assert.equal(result.records.length, 3);
  for (const record of result.records) {
    assert.equal(record.publication_status, "draft");
    assert.equal(record.review_only, true);
    assert(record.review_blockers.length > 0);
  }
  assert(result.records[1].review_blockers.includes("E001:generic_event_calendar"));
  assert(result.records[2].review_blockers.includes("E001:official_event_specific_url_required"));
  assert.notEqual(run().status, 0, "existing output must not be overwritten");
  console.log("Plan B offline preview smoke test PASS");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
