import {parseReviewReply} from "./gmail-review-reply.ts";

/**
 * A project: side-effect-free authorization gate for an incoming Gmail review.
 * Inputs MUST come from trusted backend records, not email headers alone.
 * A valid result is only a review decision candidate, never permission to publish.
 */
export type GmailReviewGateInput = {
  body: string;
  gmailMessageId: string;
  authenticatedGoogleSubject: string | null;
  expectedGoogleSubject: string;
  adminRole: "publisher" | "editor" | "none";
  expectedReviewId: string;
  expectedChallenge: string;
  challengeExpiresAt: string;
  now: string;
  challengeConsumed: boolean;
  messageAlreadyProcessed: boolean;
  evidenceDigest: string;
  currentEvidenceDigest: string;
};
export type GmailReviewGateResult =
  | {ok:true; action:"approve"|"reject"; reviewId:string; messageId:string}
  | {ok:false; reasons:string[]};
export function gateGmailReview(input:GmailReviewGateInput):GmailReviewGateResult {
  const reasons:string[]=[];
  const parsed=parseReviewReply(input.body);
  if(!parsed.valid) reasons.push("invalid_reply");
  if(!input.gmailMessageId.trim() || input.messageAlreadyProcessed) reasons.push("message_not_unique");
  if(!input.authenticatedGoogleSubject || input.authenticatedGoogleSubject!==input.expectedGoogleSubject)
    reasons.push("identity_not_verified");
  if(input.adminRole!=="publisher" && input.adminRole!=="editor") reasons.push("role_not_authorized");
  if(input.challengeConsumed) reasons.push("challenge_consumed");
  const expires=Date.parse(input.challengeExpiresAt), now=Date.parse(input.now);
  if(!Number.isFinite(expires)||!Number.isFinite(now)||now>=expires) reasons.push("challenge_expired");
  if(!input.evidenceDigest || input.evidenceDigest!==input.currentEvidenceDigest)
    reasons.push("evidence_changed");
  if(parsed.valid){
    if(parsed.reviewId!==input.expectedReviewId) reasons.push("review_id_mismatch");
    // Fixed-length expected token check; the actual implementation should compare
    // stored token hashes in a trusted backend and consume atomically.
    if(parsed.challenge!==input.expectedChallenge) reasons.push("challenge_mismatch");
  }
  if(reasons.length) return {ok:false,reasons};
  if(!parsed.valid) return {ok:false,reasons:["invalid_reply"]};
  return {ok:true,action:parsed.action,reviewId:parsed.reviewId,messageId:input.gmailMessageId};
}
