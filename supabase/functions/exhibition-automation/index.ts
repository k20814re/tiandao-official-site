import {moc,taipei,evaluate,POLICY_VERSION} from './policy.ts';
const MOC='https://cloud.culture.tw/frontsite/trans/SearchShowAction.do?method=doFindTypeJ&category=6';
const TAIPEI='https://www.travel.taipei/open-api/zh-tw/Events/Activity';
const HEADERS={'accept':'application/json','user-agent':'TianDaoCommerce/2.0 (+https://tiandaoonline.com)'};
async function get(url:string){
 const u=new URL(url);if(u.protocol!=='https:'||!['cloud.culture.tw','www.travel.taipei'].includes(u.hostname)||u.port||u.username||u.password)throw Error('unapproved_source_url');
 try{const r=await fetch(u,{headers:HEADERS,redirect:'error',signal:AbortSignal.timeout(12000)});if(!r.ok)return {status:r.status,data:null};const text=await r.text();if(text.length>6_000_000)return {status:0,data:null};try{return {status:r.status,data:JSON.parse(text)}}catch{return {status:r.status,data:null}}}catch{return {status:0,data:null}};
}
async function rpc(name:string,body:unknown){const r=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,Authorization:'Bearer '+Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('rpc_'+name+'_'+r.status);return r.status===204?null:r.json();}
async function hash(value:unknown){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function feed(code:string){
 if(code==='moc-exhibitions'){const r=await get(MOC);return {url:MOC,rows:Array.isArray(r.data)?r.data:[],complete:r.status===200&&Array.isArray(r.data),status:r.status};}
 const rows:any[]=[];let total=Infinity;let complete=false;let status=0;
 for(let page=1;page<=15;page++){const r=await get(TAIPEI+'?page='+page);status=r.status;if(r.status!==200||!r.data||!Array.isArray(r.data.data)||!Number.isInteger(r.data.total)||r.data.total<0)break;total=r.data.total;if(!r.data.data.length){complete=rows.length===total;break;}rows.push(...r.data.data);if(rows.length>=total){complete=rows.length===total;break;}}
 return {url:TAIPEI,rows,complete,status};
}
async function detail(code:string,p:any){
 if(code==='moc-exhibitions'){
  const r=await get(p.detail_url);if(r.status===200&&Array.isArray(r.data)){const found=r.data.find((x:any)=>String(x.UID)===p.external_id);return {candidate:found?moc(found):null,absent:r.data.length===0,status:r.status};}
  return {candidate:null,absent:[404,410].includes(r.status),status:r.status};
 }
 // Official website may refuse automated retrieval. Never convert that to deletion
 // or pretend title-only HTML is an independent field verification.
 const r=await get(p.detail_url);return {candidate:null,absent:[404,410].includes(r.status),status:r.status};
}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405});
 const token=req.headers.get('x-automation-token');if(!token||token.length>256)return Response.json({error:'unauthorized'},{status:401});
 let run:string|undefined;
 try{
  const cfg=await rpc('exhibition_automation_start',{p_token:token});if(cfg.busy)return Response.json({status:'busy'});run=cfg.run_id;
  const scope=await rpc('exhibition_automation_scope',{});const state=new Map((scope.state??[]).map((s:any)=>[s.canonical_key,s]));
  const counts:Record<string,number>={};const errors:string[]=[];const began=Date.now();
  const sources=scope.sources??[];const perSource=Math.max(1,Math.floor(cfg.max_items/Math.max(1,sources.length)));
  for(const src of sources){
   if(!src.is_active||!src.is_authorized||!src.license_url)continue;
   const f=await feed(src.code);const ok=await rpc('exhibition_automation_feed',{p_run:run,p_code:src.code,p_count:f.rows.length,p_complete:f.complete});if(!ok){errors.push(src.code+':feed_unverified');continue;}
   const normal=src.code==='moc-exhibitions'?moc:taipei;
   const candidates=await Promise.all(f.rows.map(async(row:any)=>{const p=normal(row);return {p,h:await hash(p),old:state.get(p.canonical_key) as any}}));
   const keys=new Set(candidates.map(x=>x.p.canonical_key));
   const work=candidates.filter(x=>!x.old||x.old.input_hash!==x.h||!x.old.last_checked_at||Date.parse(x.old.last_checked_at)<Date.now()-86400000).sort((a,b)=>Number(!!a.old)-Number(!!b.old)||Date.parse(a.old?.last_checked_at??'1970-01-01')-Date.parse(b.old?.last_checked_at??'1970-01-01')).slice(0,perSource);
   for(let i=0;i<work.length;i+=4){
    if(Date.now()-began>100000){errors.push('time_budget_reached');break;}
    await Promise.all(work.slice(i,i+4).map(async({p,h,old})=>{
     try{const d=await detail(src.code,p);const e=evaluate(p,d.candidate,true);const evidence={...e,list_url:f.url,detail_url:p.detail_url,detail_http:d.status,checked_at:new Date().toISOString(),positions:2,independent_authorities:1,notice:'清單與單筆頁面屬同一官方來源，不計為兩個獨立來源',policy_version:POLICY_VERSION};
      const result=await rpc('exhibition_automation_submit',{p_run:run,p_code:src.code,p_payload:{...p,expected_updated_at:old?.updated_at??null},p_evidence:evidence,p_hash:h});counts[result.action]=(counts[result.action]??0)+1;
     }catch{errors.push(p.canonical_key+':check_failed');
      // Failures cannot mutate or remove an event; record a zero-score review.
      try{await rpc('exhibition_automation_submit',{p_run:run,p_code:src.code,p_payload:{...p,expected_updated_at:old?.updated_at??null},p_evidence:{gates:{},policy_version:POLICY_VERSION,list_url:f.url,detail_url:p.detail_url,detail_http:0,reasons:['check_failed'],checked_at:new Date().toISOString()},p_hash:h});}catch{errors.push(p.canonical_key+':review_record_failed');}
     }
    }));
   }
   const missing=(scope.state??[]).filter((s:any)=>s.source_code===src.code&&!keys.has(s.canonical_key)&&s.publication_status!=='archived'&&s.ends_at&&Date.parse(s.ends_at)>Date.now()).slice(0,5);
   for(const s of missing){if(Date.now()-began>110000)break;const id=s.canonical_key.split(':').slice(1).join(':');const p=src.code==='moc-exhibitions'?moc({UID:id}):{external_id:id,detail_url:'https://www.travel.taipei/zh-tw/activity/details/'+encodeURIComponent(id)};const d=await detail(src.code,p);const r=await rpc('exhibition_automation_missing',{p_run:run,p_key:s.canonical_key,p_detail_absent:d.absent,p_detail_url:p.detail_url,p_http:d.status});counts[r.action]=(counts[r.action]??0)+1;}
  }
  const result={counts,errors,apply_changes:cfg.apply_changes,policy_version:POLICY_VERSION,mail_delivery:'connected_gmail_hourly_queue'};
  await rpc('exhibition_automation_finish',{p_run:run,p_results:result,p_success:errors.length===0});return Response.json({run_id:run,...result});
 }catch(err){if(run)try{await rpc('exhibition_automation_finish',{p_run:run,p_results:{error:String(err instanceof Error?err.message:'failure')},p_success:false})}catch{}return Response.json({error:'automation_failed'},{status:500});}
});
