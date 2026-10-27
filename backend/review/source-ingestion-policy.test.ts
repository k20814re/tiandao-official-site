import assert from "node:assert/strict";
import {checkIngestionPolicy,type SourcePolicy} from "./source-ingestion-policy.ts";
const base:SourcePolicy={
 sourceUrl:"https://example.org/events",method:"official_api",rights:"explicitly_permitted",
 termsPermitAutomatedAccess:true,robotsPermitAccess:true,requiresLogin:false,
 containsPersonalData:false,officialSource:true,attributionRequired:true,
 attributionProvided:true,checkedAt:"2026-10-27T00:00:00Z"
};
assert.deepEqual(checkIngestionPolicy(base),{allowed:true,reasons:[]});
for(const patch of [
 {rights:"unknown" as const},{rights:"prohibited" as const},
 {termsPermitAutomatedAccess:false},{robotsPermitAccess:false},
 {requiresLogin:true},{containsPersonalData:true},{attributionProvided:false},
 {checkedAt:null},{sourceUrl:"http://example.org/events"},
 {sourceUrl:"https://user:pass@example.org/events"},{method:"official_api" as const,officialSource:false}
]) {
 const result=checkIngestionPolicy({...base,...patch});
 assert.equal(result.allowed,false,JSON.stringify(patch));
 assert.ok(result.reasons.length>0);
}
console.log("Source ingestion policy tests PASS");
