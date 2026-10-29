'use strict';
(()=>{
const URL='https://ibvmfmgikraatiobpmmz.supabase.co/rest/v1/trade_events';
const KEY='sb_publishable_nJ8cX-FtOkbzfgdz8Z2IJA_tcg58qfE';
const $ = id => document.getElementById(id);
const form = $('event-filters'), results = $('event-results'), detail = $('detail-shell');
const categoryNames = {b2b_trade_show:'國際貿易商展',b2c_consumer_fair:'消費展',arts_exhibition:'文藝展覽',other_event:'其他展覽'};
// Offline-only, dated and clearly labeled emergency references. Never merge into healthy API results.
const REFERENCE_EVENTS=[{"id":"reference-boat-2026","title_zh":"2026 台灣國際遊艇展","starts_at":"2026-11-13","ends_at":"2026-11-15","city":"高雄市","venue_name":"亞灣、嘉信22號、愛河灣亞果及高雄港第三船渠遊艇碼頭","official_url":"https://www.boatshow.tw/zh-tw/menu/BC7BC6360A3813FBD0636733C6861689/info.html","exhibition_category":"b2b_trade_show","reference_only":true,"summary":"API 異常時人工來源備援；2026/10/29 整理，非即時同步，請核對主辦公告。"},{"id":"reference-health-2026","title_zh":"2026 台灣醫療科技展","starts_at":"2026-12-03","ends_at":"2026-12-06","city":"臺北市","venue_name":"台北南港展覽館1館","official_url":"https://expo.taiwan-healthcare.org/zh/","exhibition_category":"b2b_trade_show","reference_only":true,"summary":"API 異常時人工來源備援；2026/10/29 整理，非即時同步，請核對主辦公告。"},{"id":"reference-timtos-2027","title_zh":"2027 台北國際工具機展 TIMTOS","starts_at":"2027-03-02","ends_at":"2027-03-06","city":"臺北市","venue_name":"台北南港展覽館1館、2館","official_url":"https://www.timtos.com.tw/zh-tw/menu/61A553D4CE0B4443D0636733C6861689/info.html","exhibition_category":"b2b_trade_show","reference_only":true,"summary":"API 異常時人工來源備援；2026/10/29 整理，非即時同步，請核對主辦公告。"}];
// Ephemeral comparison matrix: page-memory only; no persistent storage or network writes.
let savedItems=[];
const SAVED_LIMIT=100;
function bookmark(item){
 if(!item?.id||!item?.name)return;
 const i=savedItems.findIndex(x=>x.id===item.id&&x.kind===item.kind);
 if(i>=0)savedItems.splice(i,1);else {if(savedItems.length>=SAVED_LIMIT){alert('本次對照表最多 100 筆。');return;}savedItems.push({...item,savedAt:new Date().toISOString()});}
 renderSaved();
}
function renderSaved(){
 const el=$('saved-items'),count=$('saved-count');if(!el)return;
 if(count)count.textContent=String(savedItems.length);
 el.innerHTML=savedItems.length?savedItems.map((x,i)=>'<article class="event-card" style="margin:0 0 10px"><h3>'+esc(x.name)+'</h3><p>'+esc(x.kind==='event'?'商展':x.kind==='stay'?'住宿':x.kind==='food'?'餐飲':x.kind==='weather'?'天氣':x.kind==='move'?'交通':'周邊')+'｜'+esc(x.location||'地點待確認')+'</p><p>'+esc(x.details||'')+'</p><p class="source-meta">本次瀏覽資料對照；非預訂、非行程安排。'+(x.source?'來源：'+esc(x.source):'')+'</p><div class="hero-actions"><button type="button" class="official-link" data-saved-remove="'+i+'">移除此項</button></div></article>').join(''):'<p class="event-status">尚未選取任何資訊。選取商展或周邊資料後會列在此表。</p>';
 el.querySelectorAll('[data-saved-remove]').forEach(b=>b.addEventListener('click',()=>{savedItems.splice(Number(b.dataset.savedRemove),1);renderSaved();}));
 const clear=$('saved-clear');if(clear)clear.disabled=!savedItems.length;
}
function eventBookmark(x){bookmark({id:String(x.id),kind:'event',name:clean(x.title_zh),location:clean([x.city,x.venue_name].filter(Boolean).join(' · ')),details:date(x.starts_at)+'－'+date(x.ends_at),source:sourceInfo(x).name});}
$('saved-clear')?.addEventListener('click',()=>{savedItems=[];renderSaved();});
const PAGE_SIZE = 10;
let events = [], sources = new Map(), currentPage = 0;
let activeController = null, isLoading = false, lastLoadAt = 0;
const LOAD_TIMEOUT_MS = 10000, RETRY_THROTTLE_MS = 1200;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const safeLink = value => {try {const u = new window.URL(value);return ['https:','http:'].includes(u.protocol) ? u.href : '';} catch {return '';}};
const TAIPEI_DAY = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei'});
const day = v => {if(!v)return '';const raw=String(v);if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){const d=new Date(raw+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===raw?raw:'';}const d=new Date(raw);return Number.isFinite(d.getTime())?TAIPEI_DAY.format(d):'';};
const TODAY = TAIPEI_DAY.format(new Date());
const eventType = x => categoryNames[x.exhibition_category] || '其他／待分類';
const eventCategoryLabel = x => x.exhibition_category ? eventType(x) : '展覽類別：核實整理中';
const matchesCategory = (x, category) => !category || (category === 'other_event' ? !x.exhibition_category || x.exhibition_category === category : x.exhibition_category === category);
const active = x => {const end = day(x.ends_at) || day(x.starts_at);return Boolean(end) && end >= TODAY;};
const dateState = x => {const s=day(x.starts_at),e=day(x.ends_at);if(!s||!e||e<s)return '日期待確認';if(e<TODAY)return '已結束';if(s>TODAY)return '即將開始';return '展出中';};
const longRange = x => {const s=new Date(day(x.starts_at)),e=new Date(day(x.ends_at));return Number.isFinite(s.getTime())&&Number.isFinite(e.getTime())&&(e-s)>1000*60*60*24*730;};
const date = v => {const d=day(v);return d?d.replaceAll('-','/'):'待確認（後續補充）';};
const verified = v => {if(!v)return '待確認';const d=new Date(v);return Number.isNaN(d.getTime())?'待確認':new Intl.DateTimeFormat('zh-TW',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Taipei'}).format(d);};
function sourceInfo(x) {
  const s = sources.get(x.source_id) || {};
  return {name:x.reference_only?'主辦／展館公開公告（人工整理）':clean(s.name)||'來源名稱待補',official:safeLink(x.official_url),dataset:safeLink(s.homepage_url),license:safeLink(s.license_url)};
}
function sourceLinks(x, detailed=false) {
  const s=sourceInfo(x), links=[];
  if(s.official) links.push(`<a class="official-link" href="${esc(s.official)}" target="_blank" rel="noopener noreferrer">活動來源 ↗</a>`);
  if(s.dataset && (detailed || !s.official)) links.push(`<a class="official-link" href="${esc(s.dataset)}" target="_blank" rel="noopener noreferrer">資料來源 ↗</a>`);
  if(detailed && s.license) links.push(`<a class="official-link" href="${esc(s.license)}" target="_blank" rel="noopener noreferrer">資料授權 ↗</a>`);
  return links.length ? links.join('') : '<span class="source-meta">來源網址待補，請先確認主辦單位公告。</span>';
}
function status(title, message, error=false, retry=false, showSources=false) {
  results.innerHTML=`<div class="event-status${error?' is-error':''}"><p><b>${esc(title)}</b><br>${esc(message)}</p>${showSources?'<a class="official-link" href="#sources">查看官方查詢連結 ↗</a>':''}${retry?'<button class="retry-button" type="button">重新載入</button>':''}</div>`;
  results.querySelector('.retry-button')?.addEventListener('click', load);
}
function filters() {const d=new FormData(form);return {category:clean(d.get('category')),q:clean(d.get('query')).toLowerCase(),city:clean(d.get('city')),from:clean(d.get('from')),to:clean(d.get('to'))};}
function apply() {
  const f=filters(), cities=[...$('event-country').options].map(o=>o.value.replace(/^台/,'臺')).filter(c=>c&&c!=='其他地區');
  const list=events.filter(x=>{
    if (x.exhibition_category !== 'b2b_trade_show') return false;
    const text=clean([x.title_zh,x.summary,x.organizer_name,x.city,x.venue_name,x.address,x.industry].filter(Boolean).join(' ')).toLowerCase();
    const c=clean(x.city).replace(/^台/,'臺'),s=day(x.starts_at),e=day(x.ends_at)||s;
    const cityOk=!f.city||(f.city==='其他地區'?!cities.includes(c):c===f.city.replace(/^台/,'臺'));
    return active(x)&&matchesCategory(x,f.category)&&(!f.q||text.includes(f.q))&&cityOk&&(!f.from||e>=f.from)&&(!f.to||s<=f.to);
  }).sort((a,b)=>{const aStart=day(a.starts_at),bStart=day(b.starts_at),aKey=aStart>=TODAY?aStart:day(a.ends_at),bKey=bStart>=TODAY?bStart:day(b.ends_at);return aKey.localeCompare(bKey)||clean(a.title_zh).localeCompare(clean(b.title_zh),'zh-Hant');});
  currentPage = 0;
  render(list, f);
}
function render(list, f) {
  if(!list.length) {
    const categoryAvailable=events.some(x=>active(x)&&matchesCategory(x,f.category));
    if(!categoryAvailable) {
      const label=categoryNames[f.category]||'展覽';
      status(`${label}資料整理中，後續補上`,'本頁已開放瀏覽，目前尚無這個類型可顯示的展覽資料。可以先查看其他展覽或官方來源；所有資訊僅供參考。',false,false,true);
    } else status('目前沒有符合條件的展覽','請放寬關鍵字、縣市或日期；已結束的活動不會顯示，尚未收錄的資訊會持續補充。',false,false,true);
    return;
  }
  const pages=Math.ceil(list.length/PAGE_SIZE);
  currentPage=Math.max(0,Math.min(currentPage,pages-1));
  const start=currentPage*PAGE_SIZE;
  const pagination=`<nav class="event-pagination full-row" aria-label="展覽分頁" tabindex="-1"><button type="button" data-page="${currentPage-1}" ${currentPage===0?'disabled':''}>上一頁</button><span>第 ${currentPage+1} / ${pages} 頁 · ${start+1}–${Math.min(start+PAGE_SIZE,list.length)} 筆，共 ${list.length} 筆</span><button type="button" data-page="${currentPage+1}" ${currentPage===pages-1?'disabled':''}>下一頁</button></nav>`;
  results.innerHTML=pagination+`<div class="data-bar is-live full-row"><div><span class="data-dot"></span><b>展覽參考資訊</b><small>符合條件 ${list.length} 筆／已收錄 ${events.length} 筆</small></div><a class="official-link" href="#sources">來源與收錄說明 ↗</a></div>`+list.slice(start,start+PAGE_SIZE).map(x=>{
    const s=day(x.starts_at),md=s?s.slice(5).replace('-','/'):'待定',state=dateState(x),source=sourceInfo(x);
    const loc=[x.city,x.venue_name].filter(Boolean).join(' · ')||'地點待確認（後續補充）',desc=clean(x.summary)||'簡介待補充。';
    const rangeNote=longRange(x)?'<span class="event-tag is-warning">日期跨度較長｜請核對官方</span>':'';
    return `<article class="event-card"><div class="event-top"><div><span class="eyebrow">${esc(x.city||'台灣')}</span><h3>${esc(x.title_zh||'展覽名稱待確認')}</h3><p class="event-location">${esc(loc)}</p></div><div class="event-date"><b>${esc(state==='展出中'?'展出中':md)}</b><span>${esc(state==='展出中'?'以官方公告為準':s?s.slice(0,4):'日期')}</span></div></div><div class="event-tags"><span class="event-tag is-type">${esc(eventCategoryLabel(x))}</span><span class="event-tag is-state">${esc(state)}</span><span class="event-tag">${esc(date(x.starts_at))}－${esc(date(x.ends_at))}</span>${rangeNote}<span class="event-tag">僅供參考</span></div><p>${esc(desc.slice(0,150))}${desc.length>150?'…':''}</p><div class="event-footer"><span class="source-meta">${esc(source.name)}<br>查核：${esc(x.reference_only?'2026/10/29 整理；非自動稽核':verified(x.last_verified_at))}</span><div class="event-source-links">${sourceLinks(x)}<button class="official-link" type="button" data-save-event="${esc(x.id)}">加入／移除本次對照表</button><button class="official-link detail-button" type="button" data-pick="${esc(x.id)}">查看詳情</button></div></div></article>`;
  }).join('')+pagination;
  results.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{currentPage=Number(b.dataset.page);render(list,f);results.scrollIntoView({behavior:'smooth',block:'start'});results.querySelector('.event-pagination').focus({preventScroll:true});}));
  results.querySelectorAll('[data-pick]').forEach(b=>b.addEventListener('click',()=>pick(b.dataset.pick)));
  results.querySelectorAll('[data-save-event]').forEach(b=>b.addEventListener('click',()=>{const x=events.find(e=>String(e.id)===b.dataset.saveEvent);if(x)eventBookmark(x);}));
}
function hours(value) {if(!Array.isArray(value)||!value.length)return '待確認（後續補充）';return value.slice(0,8).map(v=>[clean(v.time||v.start||v.raw),clean(v.endTime||v.end),clean(v.locationName)].filter(Boolean).join('－')).filter(Boolean).join('； ')||'待確認（後續補充）';}
function pick(id) {
  const x=events.find(v=>String(v.id)===String(id));if(!x)return;
  if(selectedVenueEvent&&String(selectedVenueEvent.id)!==String(x.id)&&savedItems.length){
    if(!window.confirm('切換展覽後，是否清空目前對照表？\n按「確定」清空並切換；按「取消」保留對照表並停留在原展覽。'))return;
    savedItems=[];renderSaved();
  }
  selectedVenueEvent=x;
  const activeTab=document.querySelector('.journey-tab.is-active');if(activeTab)journeyInfo(activeTab);
  const source=sourceInfo(x);
  detail.innerHTML=`<article class="event-card"><p class="eyebrow">EXHIBITION REFERENCE · 展覽參考資訊</p><h3>${esc(x.title_zh)}</h3><p class="detail-reference">僅供參考。展期、地點、票價與活動異動，以主辦單位最新公告為準；缺漏資訊後續補充。</p><p>${esc(clean(x.summary)||'簡介待補充。')}</p><ul class="source-list"><li><b>展覽類型</b><span>${esc(eventCategoryLabel(x))}</span></li><li><b>展期狀態</b><span>${esc(dateState(x))}${longRange(x)?'｜日期跨度較長，請核對官方頁面':''}</span></li><li><b>日期</b><span>${esc(date(x.starts_at))}－${esc(date(x.ends_at))}</span></li><li><b>每日時段</b><span>${esc(hours(x.daily_hours))}</span></li><li><b>場館</b><span>${esc(x.venue_name||'待確認（後續補充）')}</span></li><li><b>地址</b><span>${esc(x.address||'待確認（後續補充）')}</span></li><li><b>主辦單位</b><span>${esc(x.organizer_name||'待確認（後續補充）')}</span></li><li><b>票價／報名</b><span>${esc(x.ticket_info||'待確認（後續補充）')}</span></li><li><b>資料來源</b><span>${esc(source.name)}</span></li><li><b>資料查核</b><span>${esc(x.reference_only?'2026/10/29 整理；非自動稽核':verified(x.last_verified_at))}</span></li></ul><div class="hero-actions">${sourceLinks(x,true)}</div></article>`;
  const save=document.createElement('button');save.type='button';save.className='official-link';save.textContent='加入／移除本次對照表';save.addEventListener('click',()=>eventBookmark(x));detail.querySelector('.hero-actions')?.prepend(save);
  $('event-detail')?.scrollIntoView({behavior:'smooth',block:'start'});
}
async function readList(url, signal) {
  const response=await fetch(url,{headers:{apikey:KEY,Accept:'application/json'},signal});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const data=await response.json();if(!Array.isArray(data))throw new Error('資料格式錯誤');return data;
}
async function load() {
  if(isLoading || Date.now()-lastLoadAt<RETRY_THROTTLE_MS)return;
  lastLoadAt=Date.now();isLoading=true;
  activeController?.abort();
  const controller=new AbortController();activeController=controller;
  const timeout=setTimeout(()=>controller.abort(),LOAD_TIMEOUT_MS);
  results.innerHTML='<div class="event-status"><span class="spinner"></span><p><b>正在載入展覽參考資訊</b><br>未收錄資料持續補充，請以官方最新公告為準。</p></div>';
  try {
    const u=new window.URL(URL);
    u.searchParams.set('select','id,title_zh,summary,industry,event_type,exhibition_category,source_id,city,venue_name,address,starts_at,ends_at,organizer_name,official_url,ticket_info,daily_hours,last_verified_at');
    u.searchParams.set('publication_status','eq.published');u.searchParams.set('deleted_at','is.null');u.searchParams.set('order','starts_at.asc,title_zh.asc');u.searchParams.set('limit','1000');
    const sourceUrl=new window.URL('trade_event_sources',URL);
    sourceUrl.searchParams.set('select','id,name,homepage_url,license_url');
    const [data,sourceData]=await Promise.all([readList(u,controller.signal),readList(sourceUrl,controller.signal).catch(()=>[])]);
    if(controller.signal.aborted)throw new DOMException('Request timed out','AbortError');
    const approved=data.filter(x=>x.exhibition_category==='b2b_trade_show');
    events=approved;sources=new Map(sourceData.map(s=>[s.id,s]));apply();
  } catch (error) {
    // Only on genuine transport/API errors; never replace a healthy zero-result response.
    events=REFERENCE_EVENTS.filter(active);sources=new Map();apply();
    const note=document.createElement('div');note.className='event-status is-error';
    note.innerHTML='<p><b>政府／資料庫 API 暫時無法讀取，顯示人工備援商展</b><br>以下為 2026/10/29 整理的歷史快照，非即時官方同步；已結束的展覽不顯示。請核對活動來源。</p><button class="retry-button" type="button">重新連線</button>';
    note.querySelector('button').addEventListener('click',load);results.prepend(note);
  } finally {
    clearTimeout(timeout);isLoading=false;
    if(activeController===controller)activeController=null;
  }
}
form.addEventListener('submit',e=>{e.preventDefault();if(form.reportValidity())apply();});
form.addEventListener('change',()=>{if(form.reportValidity())apply();});
form.addEventListener('reset',()=>requestAnimationFrame(()=>{$('event-category').value='';apply();}));
const requestedCategory=new URLSearchParams(window.location.search).get('category');
if(Object.hasOwn(categoryNames,requestedCategory)) {
  $('event-category').value=requestedCategory;
  document.querySelectorAll('.category-chips button').forEach(b=>{const selected=b.dataset.value===requestedCategory;b.classList.toggle('is-selected',selected);b.setAttribute('aria-pressed',String(selected));});
}
// v13.6 LIVE: read-only dynamic venue proxy, no static merchant or weather records.
const VENUE_API='https://ibvmfmgikraatiobpmmz.supabase.co/functions/v1/b2b-venue-v137-staging';
const LIVE_ATTRIBUTION='資料來源：經濟部、交通部觀光署、中央氣象署及商工行政公開登記數據（依實際顯示來源為準）。本表由使用者自行選取公開展覽及周邊資訊，僅供本次瀏覽時比較參考，不構成旅遊行程安排、交通住宿代訂或交易確認。本站不收款、不代訂、不保證空位、房價或班次。所有資料以官方及業者最新公告為準；重新整理或關閉頁面後，已選資訊將清空。';
let selectedVenueEvent=null,journeySequence=0;
function venueKey(x){
 const v=clean(x?.venue_name);
 if(/南港展覽館|TaiNEX/i.test(v))return 'nangang';
 if(/高雄展覽館|亞灣|遊艇碼頭|愛河灣|第三船渠/i.test(v))return 'kaohsiung';
 return null;
}
function localCard(title,rows){
 return '<article class="event-card" style="margin:0 0 12px"><h4>'+esc(title)+'</h4><ul class="source-list">'+rows.map(([k,v])=>'<li><b>'+esc(k)+'</b><span>'+esc(v===null||v===undefined||v===''?'來源未提供':v)+'</span></li>').join('')+'</ul></article>';
}
function liveFooter(){
 return '<p class="service-disclaimer"><b>資料來源與法遵聲明</b><br>'+esc(LIVE_ATTRIBUTION)+'</p>';
}
async function journeyInfo(tab){
 const panel=$('journey-panel');if(!panel)return;
 const seq=++journeySequence,venue=venueKey(selectedVenueEvent),kind=tab.dataset.journey;
 if(!selectedVenueEvent){panel.innerHTML='<div class="event-status">請先選擇商展並點選「查看詳情」。</div>';return;}
 if(!venue){panel.innerHTML='<div class="event-status">此展館尚未完成動態資料來源對應，資訊核實中。</div>'+liveFooter();return;}
 if(!['food','stay','wear','move','play','leisure'].includes(kind)){
   panel.innerHTML='<div class="event-status"><b>交通與周邊資料 API 整合中</b><p>尚未取得可驗證的站點出口、即時班次、停車費率或周邊活動動態來源，暫不顯示過時資訊。</p></div>'+liveFooter();return;
 }
 const type=kind==='wear'?'weather':kind;
 panel.innerHTML='<div class="event-status"><span class="spinner"></span>正在取得政府動態資料，請稍候…</div>'+liveFooter();
 try{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
  let response;try{response=await fetch(VENUE_API+'?venue='+encodeURIComponent(venue)+'&kind='+type,{headers:{apikey:KEY},signal:controller.signal});}finally{clearTimeout(timeout);}
  const data=await response.json();if(seq!==journeySequence)return;
  if(!response.ok||data.status!=='ok'){panel.innerHTML='<div class="event-status"><b>動態資料尚無法提供</b><p>'+esc(data.message||'官方 API 暫時不可用，請稍後重試。')+'</p></div>'+liveFooter();return;}
  if(type==='weather'){
   const cards=(data.series||[]).map((e,i)=>localCard(e.element,(e.periods||[]).slice(0,7).map(t=>[t.start+' ～ '+t.end,t.value||'資料未提供']))+'<button class="official-link" type="button" data-save-weather="'+i+'">加入／移除本次對照表</button>').join('');
   panel.innerHTML='<p><b>'+esc(data.district)+'｜中央氣象署一週預報</b></p><p>此為預報，不是即時觀測溫度。資料取得：'+esc(data.updated_at)+'</p>'+(cards||'<p>目前無可顯示的預報值。</p>')+liveFooter();
   panel.querySelectorAll('[data-save-weather]').forEach(b=>b.addEventListener('click',()=>{const x=(data.series||[])[Number(b.dataset.saveWeather)];if(!x)return;bookmark({id:venue+':weather:'+x.element,kind:'weather',name:clean(data.district)+' '+clean(x.element),location:clean(data.district),details:(x.periods||[]).slice(0,7).map(t=>clean(t.start)+' '+clean(t.value)).join('；'),source:'中央氣象署預報 '+clean(data.updated_at)});}));return;
  }
  const cards=(data.items||[]).map((x,i)=>localCard(x.name,[['地址',x.address],['電話',x.phone],['距展館',x.km+' 公里（直線距離，非步行）'],...(type==='stay'?[['合法登記編號',x.registration],['參考房價',x.price]]:[['營業時段',x.hours],['公開價格',x.price]]),['資料更新',x.updated_at]])+'<button class="official-link" type="button" data-save-local="'+i+'">加入／移除本次對照表</button>').join('');
  panel.innerHTML='<p><b>'+esc(type==='stay'?'合法旅宿公開資料':'餐飲公開資料')+'｜距場館 3 公里內</b></p><p>來源：'+esc(data.source||'交通部觀光署／TDX')+'；無法由登記資料推導實際價格、訂位或營業時段。</p>'+(cards||'<div class="event-status">目前沒有符合條件且可驗證的公開資料。</div>')+liveFooter();
  panel.querySelectorAll('[data-save-local]').forEach(b=>b.addEventListener('click',()=>{const x=(data.items||[])[Number(b.dataset.saveLocal)];if(!x)return;bookmark({id:venue+':'+type+':'+clean(x.name)+':'+clean(x.address),kind:type,name:clean(x.name),location:clean(x.address),details:'電話：'+clean(x.phone)+'；距展館 '+x.km+' 公里（直線）',source:data.source||'TDX'});}));
 }catch(e){if(seq!==journeySequence)return;panel.innerHTML='<div class="event-status">政府資料暫時無法讀取（可能逾時或網路異常），請稍後再試。</div>'+liveFooter();}
}
document.querySelectorAll('.journey-tab').forEach(tab=>tab.addEventListener('click',()=>{
 document.querySelectorAll('.journey-tab').forEach(x=>x.classList.toggle('is-active',x===tab));journeyInfo(tab);
}));
// Module 06: allowlisted HTTPS affiliate redirects only, with explicit consent.
// No partner URLs are enabled until the owner verifies the affiliate contract and destination.
const APPROVED_PARTNER_HOSTS = new Set();
const outboundDialog=$('partner-outbound-modal');
let pendingPartnerUrl='';
function validPartnerUrl(raw) {
  try { const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&APPROVED_PARTNER_HOSTS.has(u.hostname.toLowerCase())?u.href:''; } catch {return '';}
}
document.querySelectorAll('[data-partner-url]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();
  const url=validPartnerUrl(link.getAttribute('data-partner-url'));
  if(!url||!outboundDialog)return;
  pendingPartnerUrl=url;outboundDialog.showModal();
}));
$('partner-outbound-cancel')?.addEventListener('click',()=>{pendingPartnerUrl='';outboundDialog?.close();});
$('partner-outbound-confirm')?.addEventListener('click',()=>{
  const url=validPartnerUrl(pendingPartnerUrl);pendingPartnerUrl='';outboundDialog?.close();
  if(url)window.open(url,'_blank','noopener,noreferrer');
});
renderSaved();
load();
})();
