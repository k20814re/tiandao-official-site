import assert from "node:assert/strict";
import {extractPlainReviewBody} from "./gmail-mime.ts";
const command="APPROVE REV_20261027_A A1B2C3D4E5F6G7H8";
const part=(value:string)=>({mimeType:"text/plain",body:{data:Buffer.from(value).toString("base64url")}});
assert.deepEqual(extractPlainReviewBody(part(command)),{ok:true,body:command});
assert.deepEqual(extractPlainReviewBody({mimeType:"multipart/alternative",parts:[part(command),{mimeType:"text/html",body:{data:"PGI+"}}]}),{ok:true,body:command});
for(const p of [
 {mimeType:"text/html",body:{data:"a"}},
 {mimeType:"multipart/mixed",parts:[part(command),part(command)]},
 {mimeType:"multipart/mixed",parts:[part(command),{mimeType:"application/pdf",filename:"invoice.pdf"}]},
 {mimeType:"text/plain",filename:"attachment.txt",body:{data:"YQ"}},
 {mimeType:"text/plain",body:{attachmentId:"remote"}},
 {mimeType:"message/rfc822",parts:[part(command)]},
 {mimeType:"text/plain",body:{data:"%%%"}},
 null
])assert.equal(extractPlainReviewBody(p).ok,false,JSON.stringify(p));
console.log("Gmail MIME text-only parser tests PASS");
