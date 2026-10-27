import assert from "node:assert/strict";
import {gateGmailReview, type GmailReviewGateInput} from "./gmail-review-gate.ts";
const base:GmailReviewGateInput={
 body:"APPROVE REV_20261027_A A1B2C3D4E5F6G7H8",gmailMessageId:"gmail-001",
 authenticatedGoogleSubject:"google-sub-001",expectedGoogleSubject:"google-sub-001",
 adminRole:"publisher",expectedReviewId:"REV_20261027_A",expectedChallenge:"A1B2C3D4E5F6G7H8",
 challengeExpiresAt:"2026-10-28T00:00:00Z",now:"2026-10-27T12:00:00Z",
 challengeConsumed:false,messageAlreadyProcessed:false,evidenceDigest:"sha256:abc",currentEvidenceDigest:"sha256:abc"
};
assert.deepEqual(gateGmailReview(base),{ok:true,action:"approve",reviewId:"REV_20261027_A",messageId:"gmail-001"});
for(const patch of [
 {authenticatedGoogleSubject:null},{authenticatedGoogleSubject:"wrong"},
 {adminRole:"none" as const},{challengeConsumed:true},{messageAlreadyProcessed:true},
 {challengeExpiresAt:"2026-10-27T11:00:00Z"},{evidenceDigest:"changed"},
 {expectedReviewId:"OTHER_1234"},{expectedChallenge:"DIFFERENTTOKEN1234"},
 {body:"APPROVE REV_20261027_A short"},{gmailMessageId:""}
]) assert.equal(gateGmailReview({...base,...patch}).ok,false,JSON.stringify(patch));
console.log("Gmail review authorization gate tests PASS");
