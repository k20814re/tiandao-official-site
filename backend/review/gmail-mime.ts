/** Conservative Gmail text/plain MIME extractor for review commands.
 * Refuses HTML-only, attachments, nested messages and ambiguous multiple text parts.
 * Never trust From headers for authorization: verify Google identity separately.
 */
export type PlainReviewBody={ok:true;body:string}|{ok:false;reason:string};
type Part={mimeType?:unknown;filename?:unknown;body?:unknown;parts?:unknown};
const MAX_BYTES=16384;
function decodeBase64Url(value:string):string|null{
 if(!/^[A-Za-z0-9_-]+={0,2}$/.test(value)||value.length>MAX_BYTES*2)return null;
 try{
  const buffer=Buffer.from(value,"base64url");
  if(buffer.length>MAX_BYTES)return null;
  const text=new TextDecoder("utf-8",{fatal:true}).decode(buffer);
  if(text.includes("\0"))return null;
  return text;
 }catch{return null;}
}
export function extractPlainReviewBody(payload:unknown):PlainReviewBody{
 if(!payload||typeof payload!=="object")return {ok:false,reason:"invalid_mime"};
 const collected:string[]=[];
 let blocked=false,visited=0;
 const visit=(part:Part,depth:number)=>{
  if(depth>4||++visited>20){blocked=true;return;}
  if(typeof part.filename==="string"&&part.filename.trim()){blocked=true;return;}
  if(part.mimeType==="message/rfc822"){blocked=true;return;}
  if(part.mimeType==="text/plain"){
   const body=part.body;
   if(!body||typeof body!=="object"){blocked=true;return;}
   const data=(body as Record<string,unknown>).data;
   if(typeof data!=="string"){blocked=true;return;}
   const decoded=decodeBase64Url(data);
   if(decoded===null){blocked=true;return;}
   collected.push(decoded);
   return;
  }
  if(part.mimeType==="multipart/alternative"||part.mimeType==="multipart/mixed"){
   if(!Array.isArray(part.parts)||part.parts.length>20){blocked=true;return;}
   for(const child of part.parts){
    if(!child||typeof child!=="object"){blocked=true;continue;}
    const p=child as Part;
    if(p.mimeType==="text/html")continue; // never interpret HTML as commands
    visit(p,depth+1);
   }
   return;
  }
  if(part.mimeType==="text/html")return;
  blocked=true;
 };
 visit(payload as Part,0);
 if(blocked)return {ok:false,reason:"unsupported_mime"};
 if(collected.length!==1)return {ok:false,reason:"ambiguous_or_missing_plaintext"};
 const body=collected[0].trim();
 if(!body||body.length>MAX_BYTES)return {ok:false,reason:"invalid_plaintext"};
 return {ok:true,body};
}
/** This extracts text only; parsing commands and verifying the authenticated
 * sender, one-time challenge, role and evidence must happen in later gates.
 */
