import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const source=readFileSync('supabase/functions/sync-taipei-events/index.ts','utf8').replace(/^import .*createClient.*;\s*/,'');
async function run(authorized:boolean){
 let handler:any;let inserts:any[]=[];let fetches=0;
 const existing=new Map([['taipei-travel:1','published'],['taipei-travel:2','archived']]);
 const db={from(table:string){assert.equal(table,'trade_events');return {upsert(rows:any[],options:any){
  assert.equal(options.ignoreDuplicates,true,'existing published and archived rows must never be updated');
  assert.equal(options.onConflict,'canonical_key');
  inserts=rows;return {async select(){return {data:rows.filter(x=>!existing.has(x.canonical_key)).map(x=>({id:x.canonical_key})),error:null}}};
 }}}};
 const user={auth:{async getUser(){return {data:{user:null}}}}};
 const sandbox={Request,Response,URL,console,setTimeout,createClient:(_u:any,key:string)=>key==='service'?{
  from(table:string){if(table==='trade_event_sources')return {select(){return {eq(){return {async single(){return {data:{id:'source'},error:null}}}}}}};return db.from(table)}
 }:user,Deno:{env:{get:(key:string)=>({SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',TAIPEI_SYNC_SECRET:'ci-only'}[key])},serve:(h:any)=>{handler=h}},fetch:async()=>{fetches++;return {ok:true,json:async()=>({total:3,data:[1,2,3].map(id=>({id,title:'CI fixture',begin:'2026-11-01T00:00:00+08:00',end:'2026-11-02T00:00:00+08:00',url:'https://www.travel.taipei/event/'+id}))})}}};
 vm.runInNewContext(stripTypeScriptTypes(source),sandbox);
 const response=await handler(new Request('https://example.invalid',{method:'POST',headers:authorized?{'x-sync-secret':'ci-only'}:{}}));
 if(!authorized){assert.equal(response.status,403);assert.equal(fetches,0);assert.equal(inserts.length,0);return;}
 assert.equal(response.status,200);const result=await response.json();assert.equal(result.created_or_updated,1);assert.equal(result.mode,'insert_new_drafts_only');
 assert.equal(inserts.length,3);for(const row of inserts){assert.equal(row.publication_status,'draft');assert.equal(row.event_type,'other');}
}
await run(false);await run(true);
console.log('Taipei sync authorization, insert-only drafts and response counts PASS (mock HTTP/database)');
