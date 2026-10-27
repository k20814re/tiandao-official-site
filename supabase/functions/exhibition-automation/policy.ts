export const POLICY_VERSION='2026-10-27.v1';
export const CITIES=['臺北市','新北市','桃園市','臺中市','臺南市','高雄市','基隆市','新竹市','嘉義市','新竹縣','苗栗縣','彰化縣','南投縣','雲林縣','嘉義縣','屏東縣','宜蘭縣','花蓮縣','臺東縣','澎湖縣','金門縣','連江縣'];
export const norm=(s:unknown)=>String(s??'').normalize('NFKC').replace(/台/g,'臺').replace(/\s+/g,'').toLowerCase();
export function date(s:unknown,end=false){const v=String(s??'').trim().replaceAll('/','-');if(!/^\d{4}-\d{2}-\d{2}(?:[ T].*)?$/.test(v))return null;const raw=v.slice(0,10);const test=new Date(raw+'T00:00:00Z');if(!Number.isFinite(test.getTime())||test.toISOString().slice(0,10)!==raw)return null;return raw+(end?'T23:59:59+08:00':'T00:00:00+08:00');}
export function safeUrl(s:unknown){try{const u=new URL(String(s));return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:null}catch{return null}}
export function moc(row:any){
 const info=Array.isArray(row.showInfo)?row.showInfo:[];const places=[...new Set(info.map((x:any)=>norm(x.locationName+'|'+x.location)))];const place=info[0]??{};
 const address=String(place.location??'').replaceAll('台','臺').trim();const city=CITIES.find(c=>address.includes(c))??'';
 const starts=date(row.startDate);const ends=date(row.endDate,true);const days=starts&&ends?(Date.parse(ends)-Date.parse(starts))/86400000:NaN;
 const title=String(row.title??'').trim(),venue=String(place.locationName??'').trim();
 const official=safeUrl(row.sourceWebPromote);const detail='https://cloud.culture.tw/frontsite/opendata/activityOpenDataJsonAction.do?method=doFindActivityById&id='+encodeURIComponent(String(row.UID??''));
 return {canonical_key:'moc:'+String(row.UID??''),external_id:String(row.UID??''),title_zh:title,starts_at:starts,ends_at:ends,city,venue_name:venue,address,official_url:official??detail,organizer_name:Array.isArray(row.masterUnit)?row.masterUnit.join('、').slice(0,500):'',ticket_info:place.price?String(place.price).slice(0,500):null,daily_hours:info.map((x:any)=>({start:x.time,end:x.endTime,source:'文化部官方API',needs_review:false})).slice(0,12),exhibition_category:/博覽會|音響大展|商展|消費展/.test(title)?'b2c_consumer_fair':'arts_exhibition',event_type:'exhibition',country_code:'TW',timezone:'Asia/Taipei',currency_code:'TWD',summary:[title,city,venue,'展期與時段請參考官方公告。資料來源：文化部展覽資訊開放資料。'].filter(Boolean).join('｜'),valid_identity:/^[a-zA-Z0-9_-]{1,128}$/.test(String(row.UID??'')),valid_dates:Number.isFinite(days)&&days>=0&&days<=730,valid_place:!!city&&!!venue&&norm(venue)!==norm(title)&&places.length===1,explicit_url:!!official,detail_url:detail};
}
export function taipei(row:any){
 const content=String(row.description??'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,' ');const match=content.match(/(?:展覽地點|活動地點|地點)[：:｜|]\s*([^\n]+)/);
 const starts=date(String(row.begin??'').slice(0,10));const ends=date(String(row.end??'').slice(0,10),true);const title=String(row.title??'').trim(),venue=match?.[1]?.trim()??'';
 return {canonical_key:'taipei-travel:'+String(row.id??''),external_id:String(row.id??''),title_zh:title,starts_at:starts,ends_at:ends,city:'臺北市',venue_name:venue,address:String(row.address??''),official_url:safeUrl(row.url),organizer_name:String(row.organizer??''),ticket_info:String(row.ticket??'')||null,daily_hours:[],exhibition_category:/展覽|特展|聯展|博覽會/.test(title)?'arts_exhibition':'other_event',event_type:/展覽|特展|聯展|博覽會/.test(title)?'exhibition':'other',country_code:'TW',timezone:'Asia/Taipei',currency_code:'TWD',summary:[title,'臺北市',venue,'資料來源：臺北旅遊網官方活動API。'].filter(Boolean).join('｜'),valid_identity:/^\d{1,20}$/.test(String(row.id??'')),valid_dates:!!starts&&!!ends&&ends>=starts,valid_place:!!venue,explicit_url:!!safeUrl(row.url),detail_url:safeUrl(row.url)};
}
export const WEIGHTS={licensed:15,identity:10,title:15,dates:15,place:15,detail:10,organizer:10,hours:5,official_link:5};
export function evaluate(candidate:any,detail:any,licensed:boolean){
 const gates={licensed,identity:candidate.valid_identity===true,title:!!candidate.title_zh&&norm(candidate.title_zh)===norm(detail?.title_zh),dates:candidate.valid_dates===true&&candidate.starts_at===detail?.starts_at&&candidate.ends_at===detail?.ends_at,place:candidate.valid_place===true&&norm(candidate.city)===norm(detail?.city)&&norm(candidate.venue_name)===norm(detail?.venue_name),detail:!!detail&&candidate.external_id===detail.external_id,organizer:!!candidate.organizer_name,hours:!!candidate.daily_hours?.length,official_link:candidate.explicit_url===true};
 const reasons=Object.entries(gates).filter(([,ok])=>!ok).map(([key])=>key);const hard=['licensed','identity','title','dates','place','detail'].every(k=>gates[k]);
 const raw=Object.entries(WEIGHTS).reduce((n,[k,w])=>n+(gates[k]?w:0),0);return {gates,score:hard?raw:Math.min(79,raw),hard_ok:hard,reasons,policy_version:POLICY_VERSION};
}
export function removalDecision(checks:{at:string;listAbsent:boolean;detailAbsent:boolean;complete:boolean}[]){
 const confirmed=checks.filter(c=>c.complete&&c.listAbsent&&c.detailAbsent).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));const spaced:typeof confirmed=[];
 for(const c of confirmed){if(!spaced.length||Date.parse(c.at)-Date.parse(spaced.at(-1)!.at)>=6*3600000)spaced.push(c);}
 const span=spaced.length?Date.parse(spaced.at(-1)!.at)-Date.parse(spaced[0].at):0;return {archive:spaced.length>=3&&span>=24*3600000,score:spaced.length>=3&&span>=24*3600000?90:Math.min(79,spaced.length*25),checks:spaced.length};
}
