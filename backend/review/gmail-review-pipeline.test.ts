import assert from "node:assert/strict";
import {evaluateGmailReview} from "./gmail-review-pipeline.ts";
const command="APPROVE REVIEW_20261027_1 ABCDEFGHIJKLMNO";
const input={
 payload:{mimeType:"text/plain",body:{data:Buffer.from(command).toString("base64url")}},
 gmailMessageId:"message-1",authenticatedGoogleSubject:"verified-subject",
 expectedGoogleSubject:"verified-subject",adminRole:"publisher" as const,
 expectedReviewId:"REVIEW_20261027_1",expectedChallenge:"ABCDEFGHIJKLMNO",
 challengeExpiresAt:"2026-10-27T05:00:00Z",now:"2026-10-27T04:00:00Z",
 challengeConsumed:false,messageAlreadyProcessed:false,
 evidenceDigest:"sha256:original",currentEvidenceDigest:"sha256:original"
};
assert.deepEqual(evaluateGmailReview(input),{status:"candidate",action:"approve",reviewId:"REVIEW_20261027_1",messageId:"message-1"});
const cases=[
 {...input,authenticatedGoogleSubject:null},
 {...input,adminRole:"none" as const},
 {...input,challengeConsumed:true},
 {...input,messageAlreadyProcessed:true},
 {...input,currentEvidenceDigest:"sha256:changed"},
 {...input,now:"2026-10-27T06:00:00Z"},
 {...input,payload:{mimeType:"text/html",body:{data:"a"}}}
];
for(const test of cases)assert.equal(evaluateGmailReview(test).status,"rejected");
console.log("Gmail review pipeline read-only tests PASS");
