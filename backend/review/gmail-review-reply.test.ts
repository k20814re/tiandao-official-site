import assert from "node:assert/strict";
import {parseReviewReply} from "./gmail-review-reply.ts";
const cmd="APPROVE REV_20261027_A A1B2C3D4E5F6G7H8";
assert.deepEqual(parseReviewReply(cmd),{valid:true,action:"approve",reviewId:"REV_20261027_A",challenge:"A1B2C3D4E5F6G7H8"});
assert.equal(parseReviewReply("REJECT REV_20261027_A A1B2C3D4E5F6G7H8").valid,true);
for(const value of ["", "APPROVE", cmd+"\nREJECT REV_20261027_A A1B2C3D4E5F6G7H8", "Please "+cmd, "APPROVE REV_20261027_A short", "> "+cmd, "APPROVE REV_20261027_A A1B2C3D4E5F6G7H8\nthanks"]) assert.equal(parseReviewReply(value).valid,false,value);
assert.equal(parseReviewReply(cmd+"\nOn Tue, someone wrote:\nREJECT REV_20261027_A A1B2C3D4E5F6G7H8").valid,true);
console.log("Gmail review reply parser tests PASS");
