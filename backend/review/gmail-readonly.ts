/** Gmail read-only API adapter. Never downloads attachments or modifies messages.
 * Caller must provide a valid, server-held OAuth access token and an approved
 * review-specific Gmail query. No token, mail body or PII is logged.
 */
export type GmailHttp=(url:string,init:{method:"GET";headers:Record<string,string>;redirect:"error"})=>Promise<{ok:boolean;status:number;json:()=>Promise<unknown>}>;
export type GmailMessageSummary={id:string;threadId:string};
const ID=/^[A-Za-z0-9_-]{1,256}$/;
const TOKEN=/^[^\s]{8,8192}$/;
export async function listReviewMessageIds(accessToken:string,query:string,http:GmailHttp):
 Promise<{ok:true;messages:GmailMessageSummary[]}|{ok:false;reason:string}>{
 if(!TOKEN.test(accessToken))return {ok:false,reason:"invalid_access_token"};
 // Do not allow arbitrary mailbox search from a public request.
 if(!/^label:[A-Za-z0-9_-]{1,64}(?: is:unread)?$/.test(query))
  return {ok:false,reason:"invalid_review_query"};
 const url=new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
 url.searchParams.set("q",query);url.searchParams.set("maxResults","25");
 try{
  const response=await http(url.toString(),{method:"GET",headers:{authorization:"Bearer "+accessToken},redirect:"error"});
  if(!response.ok)return {ok:false,reason:"gmail_request_rejected"};
  const raw=await response.json();
  if(!raw||typeof raw!=="object")return {ok:false,reason:"invalid_gmail_response"};
  const data=raw as Record<string,unknown>;
  if(data.messages===undefined)return {ok:true,messages:[]};
  if(!Array.isArray(data.messages)||data.messages.length>25)return {ok:false,reason:"invalid_gmail_response"};
  const messages:GmailMessageSummary[]=[];
  for(const entry of data.messages){
   if(!entry||typeof entry!=="object")return {ok:false,reason:"invalid_gmail_response"};
   const m=entry as Record<string,unknown>;
   if(typeof m.id!=="string"||!ID.test(m.id)||typeof m.threadId!=="string"||!ID.test(m.threadId))
    return {ok:false,reason:"invalid_gmail_response"};
   messages.push({id:m.id,threadId:m.threadId});
  }
  return {ok:true,messages};
 }catch{return {ok:false,reason:"gmail_unavailable"};}
}
export async function getReviewMessage(accessToken:string,messageId:string,http:GmailHttp):
 Promise<{ok:true;id:string;payload:unknown}|{ok:false;reason:string}>{
 if(!TOKEN.test(accessToken)||!ID.test(messageId))return {ok:false,reason:"invalid_request"};
 const url="https://gmail.googleapis.com/gmail/v1/users/me/messages/"+encodeURIComponent(messageId)+"?format=full";
 try{
  const response=await http(url,{method:"GET",headers:{authorization:"Bearer "+accessToken},redirect:"error"});
  if(!response.ok)return {ok:false,reason:"gmail_request_rejected"};
  const raw=await response.json();
  if(!raw||typeof raw!=="object")return {ok:false,reason:"invalid_gmail_response"};
  const m=raw as Record<string,unknown>;
  if(m.id!==messageId||!m.payload||typeof m.payload!=="object")return {ok:false,reason:"invalid_gmail_response"};
  return {ok:true,id:messageId,payload:m.payload};
 }catch{return {ok:false,reason:"gmail_unavailable"};}
}
/** Production must enforce authorized mailbox identity, restricted scope compliance,
 * sender verification, MIME parsing, reply challenge, deduplication and audit.
 * This adapter alone MUST NOT approve or publish anything.
 */
