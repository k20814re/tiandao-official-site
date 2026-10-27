import assert from "node:assert/strict";
import {preflightReviewPromotion,type PromotionContext} from "./gmail-review-promotion.ts";
const now=1800000000000;
const base:PromotionContext={
 candidate:{status:"candidate",action:"approve",reviewId:"REVIEW_20261027_1",messageId:"msg1"},
 operatorSource:"verified_server_session",authenticatedGoogleSubject:"subject",expectedGoogleSubject:"subject",
 adminId:"admin1",expectedAdminId:"admin1",role:"publisher",
 mfaAssurance:"aal2",mfaVerifiedAt:now-1000,authenticatedAt:now-2000,now,
 evidenceSha256:"a".repeat(64),expectedEvidenceSha256:"a".repeat(64),
 explicitPortalConfirmation:true
};
assert.deepEqual(preflightReviewPromotion(base),{allowed:true});
for(const candidate of [
 {...base,operatorSource:"email_header" as const},
 {...base,operatorSource:"request_body" as const},
 {...base,mfaAssurance:"aal1" as const},
 {...base,mfaVerifiedAt:now-300001},
 {...base,authenticatedAt:now-1800001},
 {...base,explicitPortalConfirmation:false},
 {...base,evidenceSha256:"b".repeat(64)},
 {...base,authenticatedGoogleSubject:"spoofed"},
 {...base,candidate:{status:"rejected" as const,reasons:["invalid_reply"]}}
])assert.equal(preflightReviewPromotion(candidate).allowed,false);
console.log("Gmail review promotion boundary tests PASS");
