/** Server-only adapter for the hardened, one-time authorization RPC.
 * The authorizationId MUST come from a trusted backend authorization store.
 * Never accept it from a browser or an email header. No publishing here.
 */
export type DecisionRpcInput={
 reviewId:string;messageId:string;adminId:string;
 challengeSha256:string;evidenceSha256:string;
 decision:"approve"|"reject";authorizationId:string;
};
export type RpcTransport=(name:string,args:Record<string,string>)=>Promise<{data:unknown;error:unknown}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX=/^[a-f0-9]{64}$/;
const MSG=/^[A-Za-z0-9_-]{1,256}$/;
export async function recordWithOneTimeAuthorization(input:DecisionRpcInput,rpc:RpcTransport):
 Promise<{ok:true}|{ok:false;reason:string}>{
 if(!input||!input.reviewId||input.reviewId.length>128||
 !MSG.test(input.messageId)||!UUID.test(input.adminId)||
 !UUID.test(input.authorizationId)||!HEX.test(input.challengeSha256)||
 !HEX.test(input.evidenceSha256)||
 (input.decision!=="approve"&&input.decision!=="reject"))
 return {ok:false,reason:"invalid_input"};
 try{
  const result=await rpc("record_gmail_review_decision",{
   p_review_id:input.reviewId,p_message_id:input.messageId,
   p_admin_id:input.adminId,p_challenge_sha256:input.challengeSha256,
   p_evidence_sha256:input.evidenceSha256,p_decision:input.decision,
   p_authorization_id:input.authorizationId
  });
  if(result.error)return {ok:false,reason:"rpc_rejected"};
  return result.data===true?{ok:true}:{ok:false,reason:"not_authorized_or_replayed"};
 }catch{return {ok:false,reason:"rpc_unavailable"};}
}
