import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {moc,taipei,evaluate,POLICY_VERSION} from '../../supabase/functions/exhibition-automation/policy.ts';
const source=readFileSync('supabase/functions/exhibition-automation/index.ts','utf8').replace(/^import .*?;\s*/,'');
const row={UID:'fixture1',title:'CI展覽',startDate:'2026/11/01',endDate:'2026/11/02',masterUnit:['CI unit'],showInfo:[{location:'臺北市中正區一號',locationName:'CI館',time:'2026/11/01 09:00:00',endTime:'2026/11/02 17:00:00'}]};
async function run(kind:'valid'|'conflict'|'feed_failure'|'no_token'){
 let handler:any;const submitted:any[]=[];const calls:string[]=[];
 const fakeFetch=async(url:any,init:any={})=>{url=String(url);calls.push(url);
  if(url.includes('/rest/v1/rpc/')){assert.equal(init.headers.apikey,'ci-private');const name=url.split('/').at(-1);const body=JSON.parse(init.body??'{}');
   const json=(v:any)=>Response.json(v);
   if(name==='exhibition_automation_start')return json({run_id:'ci-run',apply_changes:false,threshold:80,max_items:20});
   if(name==='exhibition_automation_scope')return json({sources:[{code:'moc-exhibitions',is_active:true,is_authorized:true,license_url:'https://data.gov.tw/license'}],state:[]});
   if(name==='exhibition_automation_feed')return json(body.p_complete&&body.p_count>0);
   if(name==='exhibition_automation_submit'){submitted.push(body);return json({action:body.p_evidence.hard_ok?'would_publish':'manual_review',score:body.p_evidence.score});}
   if(name==='exhibition_automation_finish')return new Response(null,{status:204});throw Error('unexpected RPC '+name);
  }
  assert.equal(new URL(url).hostname,'cloud.culture.tw');
  if(url.includes('doFindTypeJ'))return kind==='feed_failure'?new Response('upstream unavailable',{status:503}):Response.json([row]);
  if(url.includes('doFindActivityById'))return Response.json([{...row,title:kind==='conflict'?'不同展覽':row.title}]);
  throw Error('unexpected external URL');
 };
 const context={moc,taipei,evaluate,POLICY_VERSION,Request,Response,URL,TextEncoder,AbortSignal,crypto:webcrypto,console,fetch:fakeFetch,Deno:{env:{get:(k:string)=>k==='SUPABASE_URL'?'https://ci.example.invalid':'ci-private'},serve:(h:any)=>handler=h}};
 vm.runInNewContext(stripTypeScriptTypes(source),context);
 const response=await handler(new Request('https://ci.example.invalid/functions/v1/exhibition-automation',{method:'POST',headers:kind==='no_token'?{}:{'x-automation-token':'ci-token'}}));
 if(kind==='no_token'){assert.equal(response.status,401);assert.equal(calls.length,0);return;}
 assert.equal(response.status,200);
 if(kind==='feed_failure'){assert.equal(submitted.length,0);return;}
 assert.equal(submitted.length,1);assert.equal(submitted[0].p_evidence.positions,2);assert.equal(submitted[0].p_evidence.independent_authorities,1);
 assert.equal(submitted[0].p_evidence.hard_ok,kind==='valid');if(kind==='conflict')assert.ok(submitted[0].p_evidence.score<80);
}
for(const k of ['valid','conflict','feed_failure','no_token'] as const)await run(k);
console.log('Automation Edge handler auth, official-source fetch, conflicts and source failure tests PASS (mock HTTP/RPC)');
