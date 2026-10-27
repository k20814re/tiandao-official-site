/** Backend-only Gmail OAuth code exchange. No persistence, logging or network on import.
 * Never expose clientSecret, authorization code, or tokens to the browser or GitHub.
 */
export type TokenExchangeInput={
 clientId:string;clientSecret:string;redirectUri:string;code:string;codeVerifier:string;
};
export type TokenResult={ok:true;accessToken:string;refreshToken:string|null;expiresIn:number;scope:string}|{ok:false;reason:string};
export type HttpFetch=(url:string,init:{method:string;headers:Record<string,string>;body:string;redirect:"error"})=>Promise<{ok:boolean;status:number;json:()=>Promise<unknown>}>;
const verifierPattern=/^[A-Za-z0-9._~-]{43,128}$/;
export async function exchangeGmailCode(input:TokenExchangeInput,http:HttpFetch):Promise<TokenResult>{
 if(!input.clientId || !input.clientSecret || !input.code || !verifierPattern.test(input.codeVerifier))
  return {ok:false,reason:"invalid_exchange_input"};
 let redirect:URL;
 try{redirect=new URL(input.redirectUri);}catch{return {ok:false,reason:"invalid_redirect_uri"};}
 if(redirect.protocol!=="https:" || redirect.username || redirect.password || redirect.hash)
  return {ok:false,reason:"invalid_redirect_uri"};
 const body=new URLSearchParams({
  grant_type:"authorization_code",client_id:input.clientId,client_secret:input.clientSecret,
  code:input.code,redirect_uri:input.redirectUri,code_verifier:input.codeVerifier
 });
 try{
  const response=await http("https://oauth2.googleapis.com/token",{
   method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:body.toString(),redirect:"error"
  });
  if(!response.ok) return {ok:false,reason:"provider_rejected"};
  const raw=await response.json();
  if(!raw || typeof raw!=="object") return {ok:false,reason:"invalid_provider_response"};
  const data=raw as Record<string,unknown>;
  if(typeof data.access_token!=="string" || !data.access_token ||
     typeof data.expires_in!=="number" || !Number.isFinite(data.expires_in) || data.expires_in<=0 ||
     typeof data.scope!=="string" || !data.scope.split(" ").includes("https://www.googleapis.com/auth/gmail.readonly"))
   return {ok:false,reason:"invalid_provider_response"};
  if(data.refresh_token!==undefined && (typeof data.refresh_token!=="string" || !data.refresh_token))
   return {ok:false,reason:"invalid_provider_response"};
  return {ok:true,accessToken:data.access_token,refreshToken:typeof data.refresh_token==="string"?data.refresh_token:null,
   expiresIn:data.expires_in,scope:data.scope};
 }catch{return {ok:false,reason:"provider_unavailable"};}
}
/** Production caller must verify/consume OAuth state atomically BEFORE exchange,
 * encrypt refresh tokens at rest, restrict operator access, and never log token data.
 * This helper intentionally does not create an endpoint or persist credentials.
 */
