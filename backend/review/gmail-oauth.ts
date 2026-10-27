/** Gmail OAuth authorization-code flow helpers. Backend only; no secrets in browser.
 * Do not use before registering the exact redirect URI and storing state server-side.
 */
export const GMAIL_READONLY_SCOPE="https://www.googleapis.com/auth/gmail.readonly";
export type OAuthStartConfig={clientId:string;redirectUri:string;state:string;codeChallenge:string};
const HTTPS=(value:string)=>{try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&!u.hash;}catch{return false;}};
export function buildGmailAuthorizationUrl(config:OAuthStartConfig):string {
 if(!/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(config.clientId))
   throw new Error("invalid_client_id");
 if(!HTTPS(config.redirectUri)) throw new Error("invalid_redirect_uri");
 if(!/^[A-Za-z0-9_-]{32,256}$/.test(config.state)) throw new Error("invalid_state");
 if(!/^[A-Za-z0-9_-]{43,128}$/.test(config.codeChallenge)) throw new Error("invalid_pkce_challenge");
 const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");
 for(const [k,v] of Object.entries({
  client_id:config.clientId,redirect_uri:config.redirectUri,response_type:"code",
  scope:GMAIL_READONLY_SCOPE,state:config.state,code_challenge:config.codeChallenge,
  code_challenge_method:"S256",access_type:"offline",prompt:"consent"
 })) url.searchParams.set(k,v);
 return url.toString();
}
export function parseGmailOAuthCallback(urlText:string,expectedState:string):
 {ok:true;code:string}|{ok:false;reason:string}{
 let url:URL;
 try{url=new URL(urlText);}catch{return {ok:false,reason:"invalid_callback_url"};}
 if(url.searchParams.has("error")) return {ok:false,reason:"provider_denied"};
 if(url.searchParams.getAll("state").length!==1 ||
    url.searchParams.get("state")!==expectedState ||
    !/^[A-Za-z0-9_-]{32,256}$/.test(expectedState)) return {ok:false,reason:"state_mismatch"};
 if(url.searchParams.getAll("code").length!==1) return {ok:false,reason:"invalid_code"};
 const code=url.searchParams.get("code");
 if(!code || code.length>4096) return {ok:false,reason:"invalid_code"};
 return {ok:true,code};
}
/** Server must also enforce exact redirect origin/path, state expiry and atomic
 * one-time consumption; exchange code only server-side with PKCE verifier and secret.
 * gmail.readonly is a restricted scope and may require Google verification.
 */
