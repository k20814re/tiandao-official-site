/** A project: Gmail review evaluation pipeline, intentionally READ-ONLY.
 * Authenticated Google subject must be verified by a separate trusted admin
 * authentication flow; Gmail From headers and mailbox OAuth are NOT sender identity.
 * No state consumption, approval, publishing or audit write happens here.
 */
import {extractPlainReviewBody} from "./gmail-mime.ts";
import {gateGmailReview,type GmailReviewGateInput} from "./gmail-review-gate.ts";
export type ReviewEvaluationInput=Omit<GmailReviewGateInput,"body"> & {payload:unknown};
export type ReviewEvaluation=
 | {status:"candidate";action:"approve"|"reject";reviewId:string;messageId:string}
 | {status:"rejected";reasons:string[]};
export function evaluateGmailReview(input:ReviewEvaluationInput):ReviewEvaluation{
 const plain=extractPlainReviewBody(input.payload);
 if(!plain.ok)return {status:"rejected",reasons:["mime_"+plain.reason]};
 const result=gateGmailReview({...input,body:plain.body});
 if(!result.ok)return {status:"rejected",reasons:result.reasons};
 return {status:"candidate",action:result.action,reviewId:result.reviewId,messageId:result.messageId};
}
/** IMPORTANT: candidate is NOT authorization to execute. Production must
 * independently bind authenticated sender to a recent MFA-backed session,
 * atomically consume review challenge and message ID, and recheck evidence
 * inside the same transaction before any publication.
 */
