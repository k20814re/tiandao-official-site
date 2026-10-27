import { deliverReviewNotice } from "./resend-notifier.ts";
const assert = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
const notice = {
 id:"11111111-1111-4111-8111-111111111111",
 idempotencyKey:"review-notice-11111111",
 recipient:"k20814re@gmail.com",
 subject:"[天道商貿] 異常通知",
 text:"E002：展覽日期與官方公告不一致，禁止上架。",
};
const config = {apiKey:"test-key",verifiedFromAddress:"notifications@tiandaoonline.com"};
let calls=0;
const fakeOk: typeof fetch = async (_input, init) => {
 calls++;
 assert((init?.headers as Record<string,string>)["Idempotency-Key"]===notice.idempotencyKey,"idempotency header missing");
 const payload=JSON.parse(String(init?.body));
 assert(payload.to[0]===notice.recipient,"wrong recipient");
 return new Response(JSON.stringify({id:"provider-message-1"}),{status:200});
};
const ok=await deliverReviewNotice(notice,config,fakeOk);
assert(ok.ok===true && calls===1,"expected successful send");
const wrong=await deliverReviewNotice({...notice,recipient:"other@example.org"},config,fakeOk);
assert(!wrong.ok && calls===1,"must reject non-admin recipient before sending");
const retry=await deliverReviewNotice(notice,config,async()=>new Response("rate limited",{status:429}));
assert(!retry.ok && retry.retryable,"429 should be retryable");
const permanent=await deliverReviewNotice(notice,config,async()=>new Response("invalid",{status:400}));
assert(!permanent.ok && !permanent.retryable,"400 should be permanent");
const network=await deliverReviewNotice(notice,config,async()=>{throw new Error("offline");});
assert(!network.ok && network.retryable,"network failure should be retryable");
const spoofed=await deliverReviewNotice(notice,{...config,verifiedFromAddress:"alerts@example.org"},fakeOk);
assert(!spoofed.ok && calls===1,"must reject unapproved sender before sending");
console.log("6 notifier scenarios passed");
