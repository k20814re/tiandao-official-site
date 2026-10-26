import { processOneNotification } from "./outbox-worker.ts";

const assert=(v:boolean,msg:string)=>{if(!v)throw new Error(msg)};
const config={
 supabaseUrl:"https://staging-example.supabase.co",
 serviceRoleKey:"unit-test-only",
 resendApiKey:"unit-test-only",
 verifiedFromAddress:"notifications@tiandaoonline.com",
};
const row={
 id:"11111111-1111-4111-8111-111111111111",
 claimed_at:"2026-10-27T10:00:00Z",
 idempotency_key:"review-notice-11111111",
 recipient:"k20814re@gmail.com",
 payload:{subject:"[天道商貿] 測試異常",text:"E002 日期不一致，禁止發布"},
};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json"}});
let calls:string[]=[];
const successful:typeof fetch=async(input,init)=>{
 const url=String(input); calls.push(url);
 if(url.endsWith("/claim_exhibition_notification")) return json([row]);
 if(url==="https://api.resend.com/emails"){
  const body=JSON.parse(String(init?.body));
  assert(body.to[0]==="k20814re@gmail.com","recipient must be allowlisted");
  assert(body.from==="notifications@tiandaoonline.com","sender must be allowlisted");
  return json({id:"provider-message-1"});
 }
 if(url.endsWith("/finish_exhibition_notification")){
  const body=JSON.parse(String(init?.body));
  assert(body.p_success===true,"must acknowledge success");
  assert(body.p_provider_message_id==="provider-message-1","must persist provider ID");
  return json(true);
 }
 throw Error("unexpected endpoint");
};
const ok=await processOneNotification(config,successful);
assert(ok.status==="sent" && calls.length===3,"expected claim, send, finish");

calls=[];
const empty=await processOneNotification(config,async()=>{calls.push("claim");return json([]);});
assert(empty.status==="empty" && calls.length===1,"empty queue must not send");

calls=[];
const forbidden=await processOneNotification(config,async(input)=>{
 const url=String(input);calls.push(url);
 if(url.endsWith("/claim_exhibition_notification")) return json([{...row,recipient:"attacker@example.org"}]);
 if(url.endsWith("/finish_exhibition_notification")){
  return json(true);
 }
 throw Error("unexpected outbound request");
});
assert(forbidden.status==="failed" && calls.length===2,"bad recipient must be rejected without Resend call");

const claimFailure=await processOneNotification(config,async()=>json({error:"forbidden"},403));
assert(claimFailure.status==="error","claim 403 must fail closed");

const invalid=await processOneNotification({...config,serviceRoleKey:""},successful);
assert(invalid.status==="error","missing key must fail closed");
let malformedCalls=0;
const malformed=await processOneNotification(config,async()=>{
 malformedCalls++;
 return json([{...row,id:null}]);
});
assert(malformed.status==="error" && malformedCalls===1,
 "malformed claim identity must not trigger email or acknowledgement");
console.log("6 outbox worker scenarios passed");
