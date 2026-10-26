import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {checkManualCandidate} from "./manual-exhibition-gate.ts";
const manifest=JSON.parse(readFileSync("backend/review/plan-b-first-batch-candidates.json","utf8"));
assert.equal(manifest.events.length,10);
for(const [index,event] of manifest.events.entries()){
 const problems=checkManualCandidate(event);
 for(const code of ["E011:source_check_missing","E005:source_license_not_cleared","E010:official_facts_not_verified"])
  assert(problems.includes(code),"row "+(index+1)+" missing "+code);
}
console.log("10 candidates blocked; 0 publication authorizations");
