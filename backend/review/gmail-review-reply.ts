/** A project: deterministic Gmail reply intent parser. No Gmail access or writes. */
export type ReviewReply = {valid:true; action:"approve"|"reject"; reviewId:string; challenge:string} | {valid:false; reason:string};
const ID=/^[A-Z0-9][A-Z0-9_-]{5,63}$/;
const TOKEN=/^[A-Z0-9_-]{12,128}$/;
export function parseReviewReply(body:string):ReviewReply {
  if(typeof body!=="string" || body.length>20000) return {valid:false,reason:"invalid_body"};
  // Only inspect the first unquoted message section; ignore previous email threads.
  const first=body.split(/\r?\n(?:On .+wrote:|-----Original Message-----|寄件者[:：]|From:|>)/i)[0].trim();
  const lines=first.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(lines.length!==1) return {valid:false,reason:"expected_single_command"};
  const match=/^(APPROVE|REJECT)\s+([A-Z0-9_-]+)\s+([A-Z0-9_-]+)$/i.exec(lines[0]);
  if(!match) return {valid:false,reason:"invalid_command"};
  const [,action,id,token]=match;
  if(!ID.test(id.toUpperCase()) || !TOKEN.test(token)) return {valid:false,reason:"invalid_identifier"};
  return {valid:true,action:action.toLowerCase() as "approve"|"reject",reviewId:id.toUpperCase(),challenge:token};
}
/** This parser is NOT authorization: backend must verify Gmail identity, MFA, expiry,
 * one-time challenge, evidence hash and role before executing any action. */
