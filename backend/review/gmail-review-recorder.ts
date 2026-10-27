/** A project: server-only review decision recorder.
 * A Gmail reply alone never authorizes execution. An authenticated operator
 * must complete fresh MFA in the admin portal and approve the exact candidate.
 * This module records decisions only; it cannot publish exhibition data.
 */
import {createHash} from "node:crypto";
import type {ReviewEvaluation} from "./gmail-review-pipeline.ts";
export type VerifiedOperator={
 adminId:string;googleSubject:string;role:"publisher"|"editor";
 mfaVerifiedAt:number;authenticatedAt:number;
};
export type ReviewRecordContext={
 candidate:ReviewEvaluation;operator:VerifiedOperator|null;
 expectedGoogleSubject:string;expectedAdminId:string;
 challenge:string;currentEvidenceSha256:string;
 reviewedEvidenceSha256:string;now:number;
};
export type AtomicReviewStore={
 record(input:{reviewId:string;messageId:string;adminId:string;
  challengeSha256:string;evidenceSha256:string;decision:"approve"|"reject"}):Promise<boolean>;
};
export type RecordResult={ok:true;recorded:true}|{ok:false;reason:string};
const HEX=/^[a-f0-9]{64}$/;
export async function recordVerifiedGmailDecision(
 context:ReviewRecordContext,store:AtomicReviewStore
):Promise<RecordResult>{
 const {candidate,operator,now}=context;
 if(candidate.status!=="candidate")return {ok:false,reason:"not_a_candidate"};
 if(!operator||operator.adminId!==context.expectedAdminId||
    operator.googleSubject!==context.expectedGoogleSubject||
    !["publisher","editor"].includes(operator.role))
  return {ok:false,reason:"operator_not_verified"};
 if(!Number.isFinite(now)||!Number.isFinite(operator.mfaVerifiedAt)||
    !Number.isFinite(operator.authenticatedAt)||
    operator.mfaVerifiedAt>now||operator.authenticatedAt>now||
    now-operator.mfaVerifiedAt>5*60*1000||
    now-operator.authenticatedAt>30*60*1000)
  return {ok:false,reason:"recent_mfa_required"};
 if(!HEX.test(context.currentEvidenceSha256)||
    context.currentEvidenceSha256!==context.reviewedEvidenceSha256)
  return {ok:false,reason:"evidence_changed"};
 if(!/^[A-Z0-9_-]{12,128}$/.test(context.challenge))
  return {ok:false,reason:"invalid_challenge"};
 const challengeSha256=createHash("sha256").update(context.challenge).digest("hex");
 try{
  const recorded=await store.record({
   reviewId:candidate.reviewId,messageId:candidate.messageId,
   adminId:operator.adminId,challengeSha256,
   evidenceSha256:context.currentEvidenceSha256,decision:candidate.action
  });
  return recorded?{ok:true,recorded:true}:{ok:false,reason:"already_used_or_invalid"};
 }catch{return {ok:false,reason:"record_unavailable"};}
}
/** The caller MUST derive operator from server-verified identity/MFA (not JSON,
 * Gmail headers, or caller assertions) and must bind approval to a fresh
 * portal action. AtomicReviewStore must be a trusted backend RPC. SQL draft
 * currently accepts caller-supplied MFA boolean: do not deploy until fixed.
 */
