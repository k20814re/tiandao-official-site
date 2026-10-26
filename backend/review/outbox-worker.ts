/**
 * Backend-only outbox worker. Invoke from a trusted scheduled worker.
 * Never import into frontend or expose SUPABASE_SERVICE_ROLE_KEY.
 * Depends on both DRAFT migrations:
 * 20261027_exhibition_email_approval_draft.sql
 * 20261027_exhibition_outbox_worker_draft.sql
 */
import { deliverReviewNotice } from "./resend-notifier.ts";

type OutboxRow = {
 id: string; idempotency_key: string; recipient: string;
 payload: {subject?:unknown; text?:unknown}; claimed_at: string;
};
type WorkerConfig = {
 supabaseUrl: string; serviceRoleKey: string;
 resendApiKey: string; verifiedFromAddress: string;
};
type Result = {status:"empty"|"sent"|"retry"|"failed"|"error"; detail?:string};
export async function processOneNotification(config: WorkerConfig, fetcher: typeof fetch = fetch): Promise<Result> {
 const {supabaseUrl,serviceRoleKey,resendApiKey,verifiedFromAddress}=config;
 if (!/^https:\/\/[^/]+\.supabase\.co\/?$/.test(supabaseUrl) || !serviceRoleKey || !resendApiKey || !verifiedFromAddress)
   return {status:"error",detail:"invalid_worker_config"};
 const headers = {apikey:serviceRoleKey,Authorization:`Bearer ${serviceRoleKey}`,"Content-Type":"application/json"};
 const rpc = async (name:string,body:Record<string,unknown>) =>
   fetcher(`${supabaseUrl.replace(/\/$/,"")}/rest/v1/rpc/${name}`,{method:"POST",headers,body:JSON.stringify(body)});
 let claimed:Response;
 try { claimed=await rpc("claim_exhibition_notification",{p_lease_seconds:90}); }
 catch { return {status:"error",detail:"claim_network_failure"}; }
 if (!claimed.ok) return {status:"error",detail:`claim_http_${claimed.status}`};
 let rows:unknown;
 try { rows=await claimed.json(); } catch {return {status:"error",detail:"claim_bad_response"};}
 if (!Array.isArray(rows)) return {status:"error",detail:"claim_not_array"};
 if (!rows.length) return {status:"empty"};
 const row=rows[0] as OutboxRow;
 const payload=row?.payload;
 const valid=typeof row?.id==="string" && typeof row?.claimed_at==="string" &&
   typeof row?.idempotency_key==="string" && typeof row?.recipient==="string" &&
   payload && typeof payload.subject==="string" && typeof payload.text==="string";
 let delivery:{ok:true;providerMessageId:string}|{ok:false;retryable:boolean;reason:string};
 if (!valid) delivery={ok:false,retryable:false,reason:"invalid_outbox_payload"};
 else delivery=await deliverReviewNotice({
   id:row.id,idempotencyKey:row.idempotency_key,recipient:row.recipient,
   subject:payload.subject as string,text:payload.text as string,
 },{apiKey:resendApiKey,verifiedFromAddress},fetcher);
 try {
   const done=await rpc("finish_exhibition_notification",{
     p_id:row.id,p_claimed_at:row.claimed_at,p_success:delivery.ok,
     p_provider_message_id:delivery.ok?delivery.providerMessageId:null,
     p_error:delivery.ok?null:delivery.reason,
     p_retryable:delivery.ok?false:delivery.retryable,
   });
   if (!done.ok) return {status:"error",detail:`finish_http_${done.status}`};
   const acknowledged=await done.json();
   if (acknowledged!==true) return {status:"error",detail:"lease_lost_or_not_acknowledged"};
 } catch {return {status:"error",detail:"finish_network_failure"};}
 return delivery.ok?{status:"sent"}:{status:delivery.retryable?"retry":"failed",detail:delivery.reason};
}
