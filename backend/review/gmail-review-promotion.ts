/** A project: fail-closed boundary for promoting Gmail review candidates.
 * This is an independent gate, not a replacement for a trusted backend session
 * or a transactionally checked database authorization.
 */
import type {ReviewEvaluation} from "./gmail-review-pipeline.ts";
export type PromotionContext={
 candidate:ReviewEvaluation;
 operatorSource:"verified_server_session"|"email_header"|"request_body"|"unknown";
 authenticatedGoogleSubject:string|null;
 expectedGoogleSubject:string;
 adminId:string|null;
 expectedAdminId:string;
 role:"publisher"|"editor"|"none";
 mfaAssurance:"aal2"|"aal1"|"unknown";
 mfaVerifiedAt:number|null;
 authenticatedAt:number|null;
 now:number;
 evidenceSha256:string;
 expectedEvidenceSha256:string;
 explicitPortalConfirmation:boolean;
};
export type PromotionDecision={allowed:true}|{allowed:false;reasons:string[]};
const HASH=/^[a-f0-9]{64}$/;
export function preflightReviewPromotion(c:PromotionContext):PromotionDecision{
 const reasons:string[]=[];
 if(c.candidate.status!=="candidate")reasons.push("not_candidate");
 if(c.operatorSource!=="verified_server_session")reasons.push("untrusted_operator_source");
 if(!c.authenticatedGoogleSubject||c.authenticatedGoogleSubject!==c.expectedGoogleSubject||
    !c.adminId||c.adminId!==c.expectedAdminId)reasons.push("identity_mismatch");
 if(c.role!=="publisher"&&c.role!=="editor")reasons.push("role_not_allowed");
 if(c.mfaAssurance!=="aal2"||c.mfaVerifiedAt===null||!Number.isFinite(c.mfaVerifiedAt)||
    !Number.isFinite(c.now)||c.mfaVerifiedAt>c.now||c.now-c.mfaVerifiedAt>300000)
  reasons.push("fresh_mfa_required");
 if(c.authenticatedAt===null||!Number.isFinite(c.authenticatedAt)||
    !Number.isFinite(c.now)||c.authenticatedAt>c.now||c.now-c.authenticatedAt>1800000)
  reasons.push("recent_auth_required");
 if(!HASH.test(c.evidenceSha256)||c.evidenceSha256!==c.expectedEvidenceSha256)
  reasons.push("evidence_mismatch");
 if(c.explicitPortalConfirmation!==true)reasons.push("portal_confirmation_required");
 return reasons.length?{allowed:false,reasons}:{allowed:true};
}
/** This gate does not execute or record any decision. The caller MUST recheck
 * role, MFA, challenge, evidence and uniqueness in the database transaction.
 * Never treat a Gmail From header or OAuth mailbox token as sender identity.
 */
