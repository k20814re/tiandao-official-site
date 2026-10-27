/** A project: deterministic concurrency contract tests for the backend store.
 * This is NOT a PostgreSQL integration test; production must run transaction
 * isolation and RLS tests on staging before enabling any real Gmail approvals.
 */
import assert from "node:assert/strict";
import {recordVerifiedGmailDecision,type ReviewRecordContext,type AtomicReviewStore} from "./gmail-review-recorder.ts";
const now=1_800_000_000_000;
const context:ReviewRecordContext={
 candidate:{status:"candidate",action:"approve",reviewId:"REVIEW_20261027_1",messageId:"gmail_msg_001"},
 operator:{adminId:"admin1",googleSubject:"google-subject",role:"publisher",mfaVerifiedAt:now-1000,authenticatedAt:now-1000},
 expectedGoogleSubject:"google-subject",expectedAdminId:"admin1",
 challenge:"ABCDEFGHIJKLMNO",currentEvidenceSha256:"a".repeat(64),reviewedEvidenceSha256:"a".repeat(64),now
};
const usedReviews=new Set<string>(),usedMessages=new Set<string>();
const store:AtomicReviewStore={
 async record(input){
  // This synchronous check+consume models a single atomic DB transaction.
  if(usedReviews.has(input.reviewId)||usedMessages.has(input.messageId))return false;
  usedReviews.add(input.reviewId);usedMessages.add(input.messageId);return true;
 }
};
const parallel=await Promise.all(Array.from({length:20},()=>recordVerifiedGmailDecision(context,store)));
assert.equal(parallel.filter(r=>r.ok).length,1,"only one decision can be recorded");
assert.equal(usedReviews.size,1);assert.equal(usedMessages.size,1);
const replay=await recordVerifiedGmailDecision({...context,candidate:{status:"candidate",action:"reject",reviewId:"REVIEW_20261027_1",messageId:"gmail_msg_002"}},store);
assert.equal(replay.ok,false,"same review cannot be recorded with a different Gmail message");
const replayMessage=await recordVerifiedGmailDecision({...context,candidate:{status:"candidate",action:"approve",reviewId:"REVIEW_20261027_2",messageId:"gmail_msg_001"}},store);
assert.equal(replayMessage.ok,false,"same Gmail message cannot be reused for a new review");
console.log("Gmail review atomic-store concurrency contract tests PASS (mock only)");
