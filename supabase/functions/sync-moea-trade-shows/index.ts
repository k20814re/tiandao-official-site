// v11.0 official MOEA CSV ingest. Default: dry-run. No scraping, Gmail or affiliate generation.
// Deploy with JWT verification; schedule only after source format and dates pass acceptance.
const FEED = "https://www.trade.gov.tw/OpenData/getOpenData.aspx?oid=7B98079D47D2133B";
const DATASET = "https://data.gov.tw/dataset/11585";
const SOURCE_CODE = "moea_trade_show_csv_v11";
const POSITIVE = /國際|貿易|商展|產業|工業|科技|工具機|電子|半導體|醫療|機械|智慧|製造|設備|能源|食品|建材|車輛|物流|專業|商務|採購|供應鏈/i;
const NEGATIVE = /個展|聯展|攝影展|畫展|藝術|插畫|博物館|文藝|畢業展|音樂|動漫|演唱|親子|文化節|生活節/i;
const allowedVenues = /南港|世貿|會展|展覽館|展覽中心|貿易中心|高雄展覽|台北國際會議/i;
const field = (row: Record<string,string>, keys: string[]) => {
  for (const k of keys) { const hit=Object.keys(row).find(x=>x.replace(/\s/g,"").includes(k)); if(hit && row[hit]?.trim())return row[hit].trim(); }
  return "";
};
function parseCSV(raw: string): Record<string,string>[] {
  const rows:string[][]=[]; let row:string[]=[],cell="",quoted=false;
  for(let i=0;i<raw.length;i++){const c=raw[i];
    if(c==='"'){if(quoted && raw[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell="";}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&raw[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell="";}
    else cell+=c;
  }
  if(quoted)throw Error("CSV quoting incomplete");
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
  if(rows.length<2)throw Error("CSV missing rows");
  const header=rows.shift()!.map(x=>x.replace(/^\uFEFF/,"").trim());
  if(header.length<5)throw Error("CSV unexpected columns");
  return rows.map(c=>Object.fromEntries(header.map((h,i)=>[h,c[i]??""])));
}
function localDay(raw:string):string|null {
  const s=raw.trim();const m=s.match(/^(\d{2,4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  if(!m)return null;let y=Number(m[1]);if(y<1911)y+=1911;const mo=Number(m[2]),d=Number(m[3]);
  const dt=new Date(Date.UTC(y,mo-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==mo-1||dt.getUTCDate()!==d)return null;
  return [y,String(mo).padStart(2,"0"),String(d).padStart(2,"0")].join("-");
}
function safeOfficial(raw:string):string|null {
  try {const u=new URL(raw);return u.protocol==="https:"||u.protocol==="http:"?u.href:null;}catch{return null;}
}
function stableKey(s:string){return s.normalize("NFKC").toLowerCase().replace(/\s+/g,"").slice(0,300);}
function encodeDay(day:string,end=false){return day+(end?"T23:59:59+08:00":"T00:00:00+08:00");}
Deno.serve(async(req)=>{
  if(req.method!=="POST")return Response.json({error:"POST required"},{status:405});
  // Supabase Edge Function verify_jwt must remain true.
  const dryRun=new URL(req.url).searchParams.get("commit")!=="true";
  try{
    const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!key)throw Error("server secrets missing");
    const headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};
    const sourceRes=await fetch(url+"/rest/v1/trade_event_sources?code=eq."+SOURCE_CODE+"&select=id,is_authorized,is_active,feed_url&limit=1",{headers});
    if(!sourceRes.ok)throw Error("source registry unavailable");
    const sources=await sourceRes.json();
    const source=sources[0];
    if(!source?.is_authorized||!source?.is_active||source.feed_url!==FEED)throw Error("official source not approved in registry");
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    let response:Response;try{response=await fetch(FEED,{signal:controller.signal,headers:{Accept:"text/csv,application/octet-stream;q=0.9"}});}finally{clearTimeout(timer);}
    if(!response.ok)throw Error("official feed HTTP "+response.status);
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.length<50||bytes.length>8_000_000)throw Error("unexpected feed size");
    const raw=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
    const rows=parseCSV(raw);
    const now=new Date();const cutoff=new Date(now.getTime()-7*86400000).toISOString().slice(0,10);
    const candidates:Record<string,unknown>[]=[];const rejected:Record<string,string>[]=[];
    for(const row of rows){
      const title=field(row,["展覽名稱中文名稱","展覽中文名稱","展覽名稱","活動名稱"]);
      const venue=field(row,["展館中文名稱","展館名稱","展覽地點"]);
      const start=localDay(field(row,["展覽起日","開始日期","展期起"]));
      const end=localDay(field(row,["展覽迄日","結束日期","展期迄"]));
      const official=safeOfficial(field(row,["網站連結","網站網址","活動網址"]))||DATASET;
      const organizer=field(row,["主辦單位中文名稱","主辦單位"]);
      const reason= !title||!venue||!start||!end?"missing required fields":end<start?"invalid date range":end<cutoff?"historical event":NEGATIVE.test(title)?"non-B2B title":!(POSITIVE.test(title)||POSITIVE.test(organizer))?"B2B not established":!allowedVenues.test(venue)?"venue not approved":"";
      if(reason){rejected.push({title:title.slice(0,90),reason});continue;}
      const score=20+20+20+20+10+10; // title, start, end, venue, official dataset, business evidence
      const canonical_key="moea11:"+stableKey([title,start,venue].join("|"));
      candidates.push({canonical_key,title_zh:title,venue_name:venue,organizer_name:organizer||null,starts_at:encodeDay(start!),ends_at:encodeDay(end!,true),official_url:official,source_id:source.id,exhibition_category:"b2b_trade_show",publication_status:score>=80?"published":"draft",verification_status:"single_official_source",last_verified_at:new Date().toISOString(),source_checked_at:new Date().toISOString(),last_seen_at:new Date().toISOString(),published_at:score>=80?new Date().toISOString():null,country_code:"TW",timezone:"Asia/Taipei",status:"scheduled",summary:"經濟部國際貿易署公開資料整理，展期及參觀資訊請以主辦單位公告為準。"});
    }
    if(rows.length>3000)throw Error("unexpected feed row count");
    if(!dryRun && candidates.length){
      // Commit only when requested by an authenticated backend invocation; no public GET writes.
      const saved=await fetch(url+"/rest/v1/trade_events?on_conflict=canonical_key",{method:"POST",headers:{...headers,Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(candidates)});
      if(!saved.ok)throw Error("upsert failed: "+(await saved.text()).slice(0,250));
    }
    return Response.json({dry_run:dryRun,feed:FEED,rows:rows.length,accepted:candidates.length,rejected:rejected.length,examples:candidates.slice(0,4).map(x=>({title:x.title_zh,starts_at:x.starts_at})),rejection_examples:rejected.slice(0,6)});
  }catch(e){return Response.json({ok:false,error:String(e)},{status:502});}
});
