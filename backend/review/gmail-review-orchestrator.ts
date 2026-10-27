/** A project: server-only decision orchestration (NO publication).
 * Trust boundary: dependencies must be bound to authenticated server context.
 * Neither the browser nor Gmail may provide the MFA authorization identifier.
 */
import {checkTrustedAdminSession,type AdminSession} from "./trusted-admin-session.ts";
import {recordWithOneTimeAuthorization,type RpcTransport} from "./gmail-review-rpc.ts";
export type PendingDecision={
 reviewId:string;messageId:string;adminId:string;
 challengeSha256:string;evidenceSha256:string;decision:"approve"|"reject";
 authorizationId:string;
};
export type TrustedReviewDependencies={
 loadSession:()=>Promise<AdminSession|null>;
 loadPendingDecision:(adminId:string,reviewId:string)=>Promise<PendingDecision|null>;
 rpc:RpcTransport;
};
export async function submitTrustedReview(
 reviewId:string,confirmed:boolean,dependencies:TrustedReviewDependencies,now:number
):Promise<{ok:true}|{ok:false;reason:string}>{
 if(!confirmed)return {ok:false,reason:"portal_confirmation_required"};
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(reviewId))return {ok:false,reason:"invalid_review_id"};
 let session:AdminSession|null;
 try{session=await dependencies.loadSession();}catch{return {ok:false,reason:"session_unavailable"};}
 if(!checkTrustedAdminSession(session,now))return {ok:false,reason:"mfa_or_role_required"};
 let decision:PendingDecision|null;
 try{decision=await dependencies.loadPendingDecision(session!.adminId,reviewId);}
 catch{return {ok:false,reason:"decision_unavailable"};}
 if(!decision||decision.adminId!==session!.adminId||decision.reviewId!==reviewId)
 return {ok:false,reason:"decision_not_found"};
 return recordWithOneTimeAuthorization(decision,dependencies.rpc);
}
/** Pending decisions must be fetched from a server-owned store, with current
 * evidence and challenge revalidated. SQL must enforce atomic consumption.
 * This module alone is NOT an HTTP endpoint or a complete auth implementation.
 */
