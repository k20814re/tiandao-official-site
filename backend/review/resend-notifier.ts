/**
 * Server-side Resend notification adapter for the existing outbox.
 * Never import this file into a browser bundle.
 * Credentials must be injected as server-side secrets.
 */
export type OutboxNotice = {
  id: string;
  idempotencyKey: string;
  recipient: string;
  subject: string;
  text: string;
};
export type DeliveryResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; retryable: boolean; reason: string };

const ADMIN_EMAIL = "k20814re@gmail.com";
export async function deliverReviewNotice(
  notice: OutboxNotice,
  config: { apiKey: string; verifiedFromAddress: string },
  fetcher: typeof fetch = fetch,
): Promise<DeliveryResult> {
  if (notice.recipient.toLowerCase() !== ADMIN_EMAIL) return {ok:false,retryable:false,reason:"recipient_not_allowlisted"};
  if (!/^[a-z0-9-]{8,128}$/i.test(notice.idempotencyKey)) return {ok:false,retryable:false,reason:"invalid_idempotency_key"};
  if (!config.apiKey || !config.verifiedFromAddress || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(config.verifiedFromAddress))
    return {ok:false,retryable:false,reason:"missing_verified_sender_or_secret"};
  if (config.verifiedFromAddress.toLowerCase() !== "notifications@tiandaoonline.com")
    return {ok:false,retryable:false,reason:"sender_not_allowlisted"};
  if (!notice.subject.trim() || !notice.text.trim() || notice.text.length > 100000)
    return {ok:false,retryable:false,reason:"invalid_notice"};
  let response: Response;
  try {
    response = await fetcher("https://api.resend.com/emails", {
      method:"POST",
      headers:{
        Authorization:`Bearer ${config.apiKey}`,
        "Content-Type":"application/json",
        "Idempotency-Key":notice.idempotencyKey,
      },
      body:JSON.stringify({
        from:config.verifiedFromAddress,
        to:[ADMIN_EMAIL],
        subject:notice.subject.replace(/[\r\n]/g," "),
        text:notice.text,
      }),
    });
  } catch {
    return {ok:false,retryable:true,reason:"network_error"};
  }
  if (!response.ok) {
    return {ok:false,retryable:response.status===429 || response.status>=500,reason:`provider_http_${response.status}`};
  }
  let payload: unknown;
  try { payload = await response.json(); } catch { return {ok:false,retryable:true,reason:"invalid_provider_response"}; }
  const id = typeof payload==="object" && payload!==null && "id" in payload ? (payload as {id?:unknown}).id : null;
  if (typeof id!=="string" || !id) return {ok:false,retryable:true,reason:"missing_provider_message_id"};
  return {ok:true,providerMessageId:id};
}

/**
 * Integration requirements:
 * - Only invoke after a backend worker atomically claims a pending outbox row.
 * - Persist providerMessageId, sentAt, attempt count and next retry time.
 * - Retry 429/5xx with bounded exponential backoff; never silently drop errors.
 * - Use provider-verified sending domain; no spoofing gmail.com From.
 * - Reply-To may point to administrator Gmail only after inbound design review.
 * - A delivered email is not evidence of administrator approval.
 */
