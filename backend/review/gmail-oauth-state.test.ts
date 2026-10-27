import assert from "node:assert/strict";
import {issueOAuthState,consumeOAuthState,type PendingOAuth,type OAuthStateStore} from "./gmail-oauth-state.ts";
const rows=new Map<string,PendingOAuth>();
const store:OAuthStateStore={
 async save(record){rows.set(record.stateHash,record);},
 async consume(hash){const row=rows.get(hash)??null;rows.delete(hash);return row;}
};
const admin="admin-001",redirect="https://example.org/oauth/callback",now=1000000;
const a=await issueOAuthState(store,admin,redirect,now);
assert.match(a.state,/^[A-Za-z0-9_-]{43}$/);
assert.match(a.challenge,/^[A-Za-z0-9_-]{43}$/);
assert.equal(rows.size,1);
const consumed=await consumeOAuthState(store,a.state,admin,redirect,now+1000);
assert.equal(consumed.ok,true);
assert.equal((await consumeOAuthState(store,a.state,admin,redirect,now+2000)).ok,false);
const b=await issueOAuthState(store,admin,redirect,now);
assert.equal((await consumeOAuthState(store,b.state,"other",redirect,now+1000)).ok,false);
assert.equal((await consumeOAuthState(store,b.state,admin,redirect,now+2000)).ok,false);
const c=await issueOAuthState(store,admin,redirect,now);
assert.equal((await consumeOAuthState(store,c.state,admin,redirect,now+300001)).ok,false);
assert.equal(rows.size,0);
console.log("Gmail OAuth one-time state tests PASS");
