import assert from "node:assert/strict";
import {recordWithOneTimeAuthorization} from "./gmail-review-rpc.ts";
const valid={
 reviewId:"REVIEW_1",messageId:"msg_1",
 adminId:"550e8400-e29b-41d4-a716-446655440000",
 authorizationId:"550e8400-e29b-41d4-a716-446655440001",
 challengeSha256:"a".repeat(64),evidenceSha256:"b".repeat(64),
 decision:"approve" as const
};
let calls=0;
const rpc=async (_name:string,args:Record<string,string>)=>{
 calls++;assert.equal(args.p_authorization_id,valid.authorizationId);
 assert.equal("p_mfa_verified" in args,false);
 return {data:true,error:null};
};
assert.deepEqual(await recordWithOneTimeAuthorization(valid,rpc),{ok:true});
assert.equal(calls,1);
assert.equal((await recordWithOneTimeAuthorization({...valid,authorizationId:"invalid"},rpc)).ok,false);
assert.equal((await recordWithOneTimeAuthorization({...valid,evidenceSha256:"wrong"},rpc)).ok,false);
assert.equal(calls,1);
assert.deepEqual(await recordWithOneTimeAuthorization(valid,async()=>({data:false,error:null})),{ok:false,reason:"not_authorized_or_replayed"});
assert.deepEqual(await recordWithOneTimeAuthorization(valid,async()=>({data:null,error:"denied"})),{ok:false,reason:"rpc_rejected"});
console.log("One-time review RPC adapter tests PASS");
