'use strict';
(()=>{
const URL='https://ibvmfmgikraatiobpmmz.supabase.co/rest/v1/trade_events';
const KEY='sb_publishable_nJ8cX-FtOkbzfgdz8Z2IJA_tcg58qfE';
const $ = id => document.getElementById(id);
const form = $('event-filters'), results = $('event-results'), detail = $('detail-shell');
const categoryNames = {b2b_trade_show:'國際貿易商展',b2c_consumer_fair:'消費展',arts_exhibition:'文藝展覽',other_event:'其他展覽'};
const REFERENCE_EVENTS = [{"id": "reference-boat-2026", "title_zh": "2026 台灣國際遊艇展", "starts_at": "2026-11-13", "ends_at": "2026-11-15", "city": "高雄市", "venue_name": "亞灣、嘉信22號、愛河灣亞果及高雄港第三船渠遊艇碼頭", "organizer_name": "經濟部國際貿易署、高雄市政府", "official_url": "https://www.boatshow.tw/zh-tw/menu/BC7BC6360A3813FBD0636733C6861689/info.html", "exhibition_category": "b2b_trade_show", "reference_only": true, "summary": "人工整理的商展參考資訊，非自動稽核結果。資料整理日：2026/10/29；票價、報名及異動請查看來源公告。"}, {"id": "reference-health-2026", "title_zh": "2026 台灣醫療科技展", "starts_at": "2026-12-03", "ends_at": "2026-12-06", "city": "臺北市", "venue_name": "台北南港展覽館1館", "organizer_name": "財團法人生技醫療科技政策研究中心（場館公告所列）", "official_url": "https://www.tainex.com.tw/event/696", "exhibition_category": "b2b_trade_show", "reference_only": true, "summary": "人工整理的商展參考資訊，非自動稽核結果。資料整理日：2026/10/29；票價、報名及異動請查看來源公告。"}, {"id": "reference-timtos-2027", "title_zh": "2027 台北國際工具機展 TIMTOS", "starts_at": "2027-03-02", "ends_at": "2027-03-06", "city": "臺北市", "venue_name": "台北南港展覽館1館、2館", "organizer_name": "中華民國對外貿易發展協會、臺灣機械工業同業公會", "official_url": "https://www.timtos.com.tw/zh-tw/menu/61A553D4CE0B4443D0636733C6861689/info.html", "exhibition_category": "b2b_trade_show", "reference_only": true, "summary": "人工整理的商展參考資訊，非自動稽核結果。資料整理日：2026/10/29；票價、報名及異動請查看來源公告。"}];
const PAGE_SIZE = 10;
let events = [], sources = new Map(), currentPage = 1;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const safeLink = value => {try {const u = new window.URL(value);return ['https:','http:'].includes(u.protocol) ? u.href : '';} catch {return '';}};
const TAIPEI_DAY = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei'});
const day = v => {if(!v)return '';const raw=String(v);if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){const d=new Date(raw+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===raw?raw:'';}const d=new Date(raw);return Number.isFinite(d.getTime())?TAIPEI_DAY.format(d):'';};
const TODAY = TAIPEI_DAY.format(new Date());
const eventType = x => categoryNames[x.exhibition_category] || '其他／待分類';
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
    const text=clean([x.title_zh,x.summary,x.organizer_name,x.city,x.venue_name,x.address,x.industry].filter(Boolean).join(' ')).toLowerCase();
    const c=clean(x.city).replace(/^台/,'臺'),s=day(x.starts_at),e=day(x.ends_at)||s;
    const cityOk=!f.city||(f.city==='其他地區'?!cities.includes(c):c===f.city.replace(/^台/,'臺'));
    return active(x)&&matchesCategory(x,f.category)&&(!f.q||text.includes(f.q))&&cityOk&&(!f.from||e>=f.from)&&(!f.to||s<=f.to);
  }).sort((a,b)=>{const aStart=day(a.starts_at),bStart=day(b.starts_at),aKey=aStart>=TODAY?aStart:day(a.ends_at),bKey=bStart>=TODAY?bStart:day(b.ends_at);return aKey.localeCompare(bKey)||clean(a.title_zh).localeCompare(clean(b.title_zh),'zh-Hant');});
  currentPage = 1;
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
  currentPage=Math.max(1,Math.min(currentPage,pages));
  const start=(currentPage-1)*PAGE_SIZE;
  const pagination=`<nav class="event-pagination full-row" aria-label="展覽分頁" tabindex="-1"><button type="button" data-page="${currentPage-1}" ${currentPage===1?'disabled':''}>上一頁</button><span>第 ${currentPage} / ${pages} 頁 · ${start+1}–${Math.min(start+PAGE_SIZE,list.length)} 筆，共 ${list.length} 筆</span><button type="button" data-page="${currentPage+1}" ${currentPage===pages?'disabled':''}>下一頁</button></nav>`;
  results.innerHTML=pagination+`<div class="data-bar is-live full-row"><div><span class="data-dot"></span><b>展覽參考資訊</b><small>符合條件 ${list.length} 筆／已收錄 ${events.length} 筆</small></div><a class="official-link" href="#sources">來源與收錄說明 ↗</a></div>`+list.slice(start,start+PAGE_SIZE).map(x=>{
    const s=day(x.starts_at),md=s?s.slice(5).replace('-','/'):'待定',state=dateState(x),source=sourceInfo(x);
    const loc=[x.city,x.venue_name].filter(Boolean).join(' · ')||'地點待確認（後續補充）',desc=clean(x.summary)||'簡介待補充。';
    const rangeNote=longRange(x)?'<span class="event-tag is-warning">日期跨度較長｜請核對官方</span>':'';
    return `<article class="event-card"><div class="event-top"><div><span class="eyebrow">${esc(x.city||'台灣')}</span><h3>${esc(x.title_zh||'展覽名稱待確認')}</h3><p class="event-location">${esc(loc)}</p></div><div class="event-date"><b>${esc(state==='展出中'?'展出中':md)}</b><span>${esc(state==='展出中'?'以官方公告為準':s?s.slice(0,4):'日期')}</span></div></div><div class="event-tags"><span class="event-tag is-type">${esc(eventType(x))}</span><span class="event-tag is-state">${esc(state)}</span><span class="event-tag">${esc(date(x.starts_at))}－${esc(date(x.ends_at))}</span>${rangeNote}<span class="event-tag">僅供參考</span></div><p>${esc(desc.slice(0,150))}${desc.length>150?'…':''}</p><div class="event-footer"><span class="source-meta">${esc(source.name)}<br>查核：${esc(x.reference_only?'2026/10/29 整理；非自動稽核':verified(x.last_verified_at))}</span><div class="event-source-links">${sourceLinks(x)}<button class="official-link detail-button" type="button" data-pick="${esc(x.id)}">查看詳情</button></div></div></article>`;
  }).join('')+pagination;
  results.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{currentPage=Number(b.dataset.page);render(list,f);results.scrollIntoView({behavior:'smooth',block:'start'});results.querySelector('.event-pagination').focus({preventScroll:true});}));
  results.querySelectorAll('[data-pick]').forEach(b=>b.addEventListener('click',()=>pick(b.dataset.pick)));
}
function hours(value) {if(!Array.isArray(value)||!value.length)return '待確認（後續補充）';return value.slice(0,8).map(v=>[clean(v.time||v.start||v.raw),clean(v.endTime||v.end),clean(v.locationName)].filter(Boolean).join('－')).filter(Boolean).join('； ')||'待確認（後續補充）';}
function pick(id) {
  const x=events.find(v=>String(v.id)===String(id));if(!x)return;
  const source=sourceInfo(x);
  detail.innerHTML=`<article class="event-card"><p class="eyebrow">EXHIBITION REFERENCE · 展覽參考資訊</p><h3>${esc(x.title_zh)}</h3><p class="detail-reference">僅供參考。展期、地點、票價與活動異動，以主辦單位最新公告為準；缺漏資訊後續補充。</p><p>${esc(clean(x.summary)||'簡介待補充。')}</p><ul class="source-list"><li><b>展覽類型</b><span>${esc(eventType(x))}</span></li><li><b>展期狀態</b><span>${esc(dateState(x))}${longRange(x)?'｜日期跨度較長，請核對官方頁面':''}</span></li><li><b>日期</b><span>${esc(date(x.starts_at))}－${esc(date(x.ends_at))}</span></li><li><b>每日時段</b><span>${esc(hours(x.daily_hours))}</span></li><li><b>場館</b><span>${esc(x.venue_name||'待確認（後續補充）')}</span></li><li><b>地址</b><span>${esc(x.address||'待確認（後續補充）')}</span></li><li><b>主辦單位</b><span>${esc(x.organizer_name||'待確認（後續補充）')}</span></li><li><b>票價／報名</b><span>${esc(x.ticket_info||'待確認（後續補充）')}</span></li><li><b>資料來源</b><span>${esc(source.name)}</span></li><li><b>資料查核</b><span>${esc(x.reference_only?'2026/10/29 整理；非自動稽核':verified(x.last_verified_at))}</span></li></ul><div class="hero-actions">${sourceLinks(x,true)}</div></article>`;
  $('event-detail')?.scrollIntoView({behavior:'smooth',block:'start'});
}
async function readList(url) {
  const response=await fetch(url,{headers:{apikey:KEY,Accept:'application/json'}});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const data=await response.json();if(!Array.isArray(data))throw new Error('資料格式錯誤');return data;
}
async function load() {
  results.innerHTML='<div class="event-status"><span class="spinner"></span><p><b>正在載入展覽參考資訊</b><br>未收錄資料持續補充，請以官方最新公告為準。</p></div>';
  try {
    const u=new window.URL(URL);
    u.searchParams.set('select','id,title_zh,summary,industry,event_type,exhibition_category,source_id,city,venue_name,address,starts_at,ends_at,organizer_name,official_url,ticket_info,daily_hours,last_verified_at');
    u.searchParams.set('publication_status','eq.published');u.searchParams.set('deleted_at','is.null');u.searchParams.set('order','starts_at.asc,title_zh.asc');u.searchParams.set('limit','1000');
    const sourceUrl=new window.URL('trade_event_sources',URL);
    sourceUrl.searchParams.set('select','id,name,homepage_url,license_url');
    const [data,sourceData]=await Promise.all([readList(u),readList(sourceUrl).catch(()=>[])]);
    events=[...data,...REFERENCE_EVENTS.filter(r=>!data.some(x=>x.official_url===r.official_url||clean(x.title_zh)===clean(r.title_zh)))];sources=new Map(sourceData.map(s=>[s.id,s]));apply();
  } catch {
    status('展覽資訊暫時無法載入','請稍後重試或前往官方來源查詢；這不代表目前沒有展覽，資訊仍以官方公告為準。',true,true,true);
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
document.querySelectorAll('.journey-tab').forEach(tab=>tab.addEventListener('click',()=>{
  document.querySelectorAll('.journey-tab').forEach(x=>x.classList.toggle('is-active',x===tab));
  const label=tab.querySelector('small')?.textContent||tab.childNodes[0].textContent.trim();
  $('journey-panel').innerHTML=`<div><span class="status-chip">資料整理中</span><h3>${esc(label)}資訊後續補上</h3><p>目前尚無可顯示的資料；後續提供的資訊也將附上來源，僅供參考。</p></div><div class="pending-card"><b>資料整理中，後續補上</b><span>實際價格、時間與服務內容以官方或業者最新公告為準。</span></div>`;
}));
load();
})();
