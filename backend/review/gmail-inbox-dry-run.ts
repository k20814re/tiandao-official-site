/** A project: bounded Gmail inbox dry-run orchestration.
 * Never approves, records, publishes, sends mail or changes Gmail labels.
 * The supplied identity MUST be obtained from a separate verified admin
 * session, never inferred from the Gmail message's From header.
 */
import {listReviewMessageIds,getReviewMessage,type GmailHttp} from "./gmail-readonly.ts";
import {evaluateGmailReview,type ReviewEvaluationInput} from "./gmail-review-pipeline.ts";
export type ReviewContext=Omit<ReviewEvaluationInput,"payload"|"gmailMessageId">;
export type ReviewContextResolver=(messageId:string)=>Promise<ReviewContext|null>;
export type InboxDryRunResult={
 ok:boolean;processed:number;candidates:{messageId:string;reviewId:string;action:"approve"|"reject"}[];
 rejected:{messageId:string;reasons:string[]}[];reason?:string
};
export async function dryRunGmailReviewInbox(
 accessToken:string,label:string,http:GmailHttp,resolveContext:ReviewContextResolver
):Promise<InboxDryRunResult>{
 const empty=():InboxDryRunResult=>({ok:false,processed:0,candidates:[],rejected:[]});
 if(!/^[A-Za-z0-9_-]{1,64}$/.test(label))return {...empty(),reason:"invalid_label"};
 const listed=await listReviewMessageIds(accessToken,"label:"+label,http);
 if(!listed.ok)return {...empty(),reason:listed.reason};
 const result:InboxDryRunResult={ok:true,processed:0,candidates:[],rejected:[]};
 const seen=new Set<string>();
 for(const message of listed.messages){
  if(seen.has(message.id)){
   result.rejected.push({messageId:message.id,reasons:["duplicate_in_batch"]});
   continue;
  }
  seen.add(message.id);
  const fetched=await getReviewMessage(accessToken,message.id,http);
  result.processed++;
  if(!fetched.ok){
   result.rejected.push({messageId:message.id,reasons:[fetched.reason]});
   continue;
  }
  let context:ReviewContext|null=null;
  try{context=await resolveContext(message.id);}catch{
   result.rejected.push({messageId:message.id,reasons:["trusted_context_unavailable"]});
   continue;
  }
  if(!context){
   result.rejected.push({messageId:message.id,reasons:["trusted_context_missing"]});
   continue;
  }
  const evaluation=evaluateGmailReview({...context,gmailMessageId:message.id,payload:fetched.payload});
  if(evaluation.status==="candidate")
   result.candidates.push({messageId:message.id,reviewId:evaluation.reviewId,action:evaluation.action});
  else result.rejected.push({messageId:message.id,reasons:evaluation.reasons});
 }
 return result;
}
/** Dry-run results are NOT authorization to publish. A production worker needs
 * independently authenticated sender, MFA, atomic DB replay prevention,
 * evidence revalidation, and a separate publication approval transaction.
 */
