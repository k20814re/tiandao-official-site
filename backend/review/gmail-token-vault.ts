/** Backend-only AES-256-GCM envelope for OAuth refresh tokens.
 * Key must be 32 random bytes stored in a managed server-side secret store.
 * Never send ciphertext, plaintext or key to browser; rotate keys deliberately.
 */
import {createCipheriv,createDecipheriv,randomBytes} from "node:crypto";
export type TokenEnvelope={version:1;keyId:string;iv:string;tag:string;ciphertext:string};
const keyCheck=(key:Buffer)=>{if(!Buffer.isBuffer(key)||key.length!==32)throw new Error("invalid_encryption_key");};
const contextCheck=(adminId:string)=>{if(!adminId||adminId.length>256)throw new Error("invalid_admin_id");};
export function encryptRefreshToken(token:string,adminId:string,keyId:string,key:Buffer):TokenEnvelope{
 keyCheck(key);contextCheck(adminId);
 if(!token || token.length>16384 || !/^[A-Za-z0-9._-]{1,128}$/.test(keyId))throw new Error("invalid_token_metadata");
 const iv=randomBytes(12);
 const cipher=createCipheriv("aes-256-gcm",key,iv);
 cipher.setAAD(Buffer.from("tiandao:gmail-refresh:v1:"+adminId,"utf8"));
 const encrypted=Buffer.concat([cipher.update(token,"utf8"),cipher.final()]);
 return {version:1,keyId,iv:iv.toString("base64url"),tag:cipher.getAuthTag().toString("base64url"),ciphertext:encrypted.toString("base64url")};
}
export function decryptRefreshToken(envelope:TokenEnvelope,adminId:string,key:Buffer):string{
 keyCheck(key);contextCheck(adminId);
 if(!envelope || envelope.version!==1 || !/^[A-Za-z0-9._-]{1,128}$/.test(envelope.keyId))throw new Error("invalid_envelope");
 const iv=Buffer.from(envelope.iv,"base64url"),tag=Buffer.from(envelope.tag,"base64url"),data=Buffer.from(envelope.ciphertext,"base64url");
 if(iv.length!==12||tag.length!==16||data.length===0||data.length>16384)throw new Error("invalid_envelope");
 const decipher=createDecipheriv("aes-256-gcm",key,iv);
 decipher.setAAD(Buffer.from("tiandao:gmail-refresh:v1:"+adminId,"utf8"));
 decipher.setAuthTag(tag);
 return Buffer.concat([decipher.update(data),decipher.final()]).toString("utf8");
}
/** No database persistence is performed here. In production bind adminId to the
 * authenticated server session, restrict decrypt access, and audit without tokens.
 */
