import { preflightPublication, type PublishContext } from "./publication-preflight.ts";
const assert=(v:boolean,msg:string)=>{if(!v)throw new Error(msg)};
const item={
 id:"item-1",selected:true,decision:"approved" as const,severity:"info" as const,
 factVerified:true,licenseApproved:true,
 officialEventUrl:"https://example.org/events/test-exhibition",
 checkedAt:"2026-10-27T12:00:00+08:00",evidenceDigest:"digest-a",
 currentEvidenceDigest:"digest-a",cancelledOrPostponed:false,
};
const base:PublishContext={
 authenticatedAdmin:true,role:"publisher",freshMfaVerified:true,
 gmailIntentVerified:true,gmailIntentConsumed:false,
 challengeExpired:false,challengeUsed:false,batchExpired:false,
 batchEvidenceDigest:"batch-digest",currentBatchEvidenceDigest:"batch-digest",
 selectedIds:["item-1"],items:[item],
};
assert(preflightPublication(base).eligible,"valid preflight should be eligible");
const cases:[string,PublishContext][]=[
 ["missing MFA",{...base,freshMfaVerified:false}],
 ["missing Gmail intent",{...base,gmailIntentVerified:false}],
 ["replayed Gmail intent",{...base,gmailIntentConsumed:true}],
 ["editor not publisher",{...base,role:"editor"}],
 ["expired challenge",{...base,challengeExpired:true}],
 ["changed batch evidence",{...base,currentBatchEvidenceDigest:"tampered"}],
 ["selection mismatch",{...base,selectedIds:["different"]}],
 ["duplicate selection",{...base,selectedIds:["item-1","item-1"]}],
 ["blocker",{...base,items:[{...item,severity:"blocker"}]}],
 ["license missing",{...base,items:[{...item,licenseApproved:false}]}],
 ["facts missing",{...base,items:[{...item,factVerified:false}]}],
 ["official page missing",{...base,items:[{...item,officialEventUrl:null}]}],
 ["changed evidence",{...base,items:[{...item,currentEvidenceDigest:"tampered"}]}],
 ["cancelled",{...base,items:[{...item,cancelledOrPostponed:true}]}],
 ["not approved",{...base,items:[{...item,decision:"recheck"}]}],
];
for(const [name,context] of cases){
 const result=preflightPublication(context);
 assert(!result.eligible,`must reject: ${name}`);
 if(!result.eligible) assert(result.reasons.length>0,`must explain: ${name}`);
}
console.log(`${cases.length+1} publication preflight scenarios passed`);
