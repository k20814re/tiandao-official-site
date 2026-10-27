import assert from "node:assert/strict";
import {buildGmailAuthorizationUrl,parseGmailOAuthCallback,GMAIL_READONLY_SCOPE} from "./gmail-oauth.ts";
const state="A".repeat(48),challenge="B".repeat(43);
const url=new URL(buildGmailAuthorizationUrl({clientId:"12345-abc.apps.googleusercontent.com",redirectUri:"https://example.org/oauth/callback",state,codeChallenge:challenge}));
assert.equal(url.origin,"https://accounts.google.com");
assert.equal(url.searchParams.get("scope"),GMAIL_READONLY_SCOPE);
assert.equal(url.searchParams.get("code_challenge_method"),"S256");
assert.equal(url.searchParams.get("response_type"),"code");
assert.deepEqual(parseGmailOAuthCallback("https://example.org/oauth/callback?state="+state+"&code=abc",state),{ok:true,code:"abc"});
for(const s of ["https://example.org/oauth/callback?state=wrong&code=abc","https://example.org/oauth/callback?state="+state+"&code=a&code=b","https://example.org/oauth/callback?state="+state+"&error=access_denied"]){assert.equal(parseGmailOAuthCallback(s,state).ok,false);}
assert.throws(()=>buildGmailAuthorizationUrl({clientId:"invalid",redirectUri:"https://example.org/cb",state,codeChallenge:challenge}));
assert.throws(()=>buildGmailAuthorizationUrl({clientId:"12345-abc.apps.googleusercontent.com",redirectUri:"http://example.org/cb",state,codeChallenge:challenge}));
console.log("Gmail OAuth helper tests PASS");
