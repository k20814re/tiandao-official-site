import assert from "node:assert/strict";
import {recordVerifiedGmailDecision,type ReviewRecordContext} from "./gmail-review-recorder.ts";
const now=1_800_000_000_000,hash="a".repeat(64);
const base:ReviewRecordContext={
 candidate:{status:"candidate",action:"approve",reviewId:"REVIEW_20261027_1",messageId:"msg123"},
 operator:{adminId:"admin1",googleSubject:"google-subject",role:"publisher",mfaVerifiedAt:now-1000,authenticatedAt:now-2000},
 expectedGoogleSubject:"google-subject",expectedAdminId:"admin1",
 challenge:"ABCDEFGHIJKLMNO",currentEvidenceSha256:hash,reviewedEvidenceSha256:hash,now
};
let writes=0,received:unknown;
const store={async record(value:unknown){writes++;received=value;return true;}};
assert.deepEqual(await recordVerifiedGmailDecision(base,store),{ok:true,recorded:true});
assert.equal(writes,1);
assert.equal((received as {evidenceSha256:string}).evidenceSha256,hash);
assert.equal((received as {challengeSha256:string}).challengeSha256.length,64);
for(const value of [
 {...base,operator:null},
 {...base,operator:{...base.operator!,googleSubject:"wrong"}},
 {...base,operator:{...base.operator!,mfaVerifiedAt:now-301000}},
 {...base,currentEvidenceSha256:"b".repeat(64)},
 {...base,candidate:{status:"rejected" as const,reasons:["invalid_reply"]}},
 {...base,challenge:"short"}
])assert.equal((await recordVerifiedGmailDecision(value,store)).ok,false);
assert.equal(writes,1);
assert.deepEqual(await recordVerifiedGmailDecision(base,{record:async()=>false}),{ok:false,reason:"already_used_or_invalid"});
console.log("Gmail verified decision recorder tests PASS");
