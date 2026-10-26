/**
 * Supabase Edge Function: controlled, one-off Resend smoke test.
 *
 * Deploy manually after setting RESEND_API_KEY, RESEND_FROM_ADDRESS and
 * NOTIFICATION_TEST_TOKEN as Supabase Edge Function secrets.
 *
 * IMPORTANT: deploy with JWT verification ENABLED; call with a valid
 * Supabase JWT plus x-test-token. No anonymous calls. Never expose tokens
 * in a browser or GitHub. Does not access trade_events or publish records.
 *
 * POST only. Intended for a single manual smoke test, not a scheduled job.
 */
import { deliverReviewNotice } from "../../../backend/review/resend-notifier.ts";

const reply = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

async function matchesSecret(provided: string, expected: string): Promise<boolean> {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const [a,b] = await Promise.all([provided,expected].map(s => crypto.subtle.digest("SHA-256",encoder.encode(s))));
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for(let i=0;i<x.length;i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return reply(405,{error:"method_not_allowed"});
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const from = Deno.env.get("RESEND_FROM_ADDRESS") || "";
  const token = Deno.env.get("NOTIFICATION_TEST_TOKEN") || "";
  if (!apiKey || !from || !token) return reply(503,{error:"server_not_configured"});
  if (!(await matchesSecret(request.headers.get("x-test-token") || "", token)))
    return reply(403,{error:"forbidden"});

  // Fixed payload; never let callers select a recipient or inject content.
  // A stable key intentionally prevents repeated test sends.
  const result = await deliverReviewNotice({
    id:"11111111-1111-4111-8111-111111111111",
    idempotencyKey:"tiandao-review-smoke-v1",
    recipient:"k20814re@gmail.com",
    subject:"[天道商貿] Resend 寄件功能測試（非上架通知）",
    text:"這是《天道商貿》後端寄件測試信。\n\n此信不代表展覽已核准、發布或審核完成。\n測試異常示例：E002 — 展覽日期與官方公告不一致，禁止上架。\n\n若非本人操作，請忽略。",
  },{apiKey,verifiedFromAddress:from});
  if (!result.ok) return reply(result.retryable ? 503 : 422,{ok:false,error:result.reason});
  return reply(200,{ok:true,providerMessageId:result.providerMessageId});
});
