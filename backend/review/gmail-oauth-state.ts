/** Server-side OAuth state issuance and single-use verification.
 * The caller supplies a durable atomic store (e.g. SQL DELETE ... RETURNING);
 * never use process memory for production multi-instance deployments.
 */
import {randomBytes,createHash,timingSafeEqual} from "node:crypto";
export type PendingOAuth={stateHash:string;verifier:string;expiresAt:number;redirectUri:string;adminId:string};
export interface OAuthStateStore {
 save(record:PendingOAuth):Promise<void>;
 consume(stateHash:string):Promise<PendingOAuth|null>; // atomic, deletes even if expired
}
const encode=(buffer:Buffer)=>buffer.toString("base64url");
export async function issueOAuthState(store:OAuthStateStore,adminId:string,redirectUri:string,now=Date.now()){
 if(!adminId || !Number.isFinite(now)) throw new Error("invalid_oauth_context");
 const url=new URL(redirectUri);
 if(url.protocol!=="https:" || url.username || url.password || url.hash) throw new Error("invalid_redirect_uri");
 const state=encode(randomBytes(32));
 const verifier=encode(randomBytes(32));
 const challenge=encode(createHash("sha256").update(verifier).digest());
 const stateHash=createHash("sha256").update(state).digest("hex");
 await store.save({stateHash,verifier,expiresAt:now+5*60*1000,redirectUri,adminId});
 return {state,challenge};
}
export async function consumeOAuthState(store:OAuthStateStore,state:string,adminId:string,redirectUri:string,now=Date.now()){
 if(!/^[A-Za-z0-9_-]{32,256}$/.test(state) || !adminId || !Number.isFinite(now))
  return {ok:false as const,reason:"invalid_state"};
 const stateHash=createHash("sha256").update(state).digest("hex");
 const record=await store.consume(stateHash);
 if(!record) return {ok:false as const,reason:"state_not_found_or_used"};
 const actual=Buffer.from(record.stateHash,"hex"),expected=Buffer.from(stateHash,"hex");
 if(actual.length!==expected.length || !timingSafeEqual(actual,expected) ||
    record.expiresAt<=now || record.adminId!==adminId || record.redirectUri!==redirectUri)
  return {ok:false as const,reason:"state_invalid_or_expired"};
 return {ok:true as const,verifier:record.verifier};
}
/** Storage implementation must enforce uniqueness and atomic consumption.
 * Restrict state records to the server and purge expired entries regularly.
 */
