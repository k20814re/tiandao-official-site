import assert from "node:assert/strict";
import {dryRunGmailReviewInbox} from "./gmail-inbox-dry-run.ts";
import type {GmailHttp} from "./gmail-readonly.ts";
const command="APPROVE REVIEW_20261027_1 ABCDEFGHIJKLMNO";
const context={
 authenticatedGoogleSubject:"subject-verified",expectedGoogleSubject:"subject-verified",
 adminRole:"publisher" as const,expectedReviewId:"REVIEW_20261027_1",
 expectedChallenge:"ABCDEFGHIJKLMNO",challengeExpiresAt:"2026-10-27T05:00:00Z",
 now:"2026-10-27T04:00:00Z",challengeConsumed:false,messageAlreadyProcessed:false,
 evidenceDigest:"digest",currentEvidenceDigest:"digest"
};
let calls=0;
const http:GmailHttp=async(url)=>{
 calls++;
 if(url.includes("/messages/"))return {ok:true,status:200,json:async()=>({id:"m1",payload:{mimeType:"text/plain",body:{data:Buffer.from(command).toString("base64url")}}})};
 return {ok:true,status:200,json:async()=>({messages:[{id:"m1",threadId:"t1"}]})};
};
const good=await dryRunGmailReviewInbox("access-token-123","TIANDAO_REVIEW",http,async()=>context);
assert.deepEqual(good.candidates,[{messageId:"m1",reviewId:"REVIEW_20261027_1",action:"approve"}]);
assert.equal(good.processed,1);
const missing=await dryRunGmailReviewInbox("access-token-123","TIANDAO_REVIEW",http,async()=>null);
assert.deepEqual(missing.rejected,[{messageId:"m1",reasons:["trusted_context_missing"]}]);
const bad=await dryRunGmailReviewInbox("access-token-123","TIANDAO_REVIEW",http,async()=>({...context,authenticatedGoogleSubject:null}));
assert.equal(bad.candidates.length,0);
assert.equal(bad.rejected[0].reasons.includes("identity_not_verified"),true);
const before=calls;
assert.equal((await dryRunGmailReviewInbox("access-token-123","in:anywhere",http,async()=>context)).ok,false);
assert.equal(calls,before);
console.log("Gmail inbox dry-run orchestration tests PASS");
