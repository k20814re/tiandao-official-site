'use strict';
(()=>{
const URL='https://ibvmfmgikraatiobpmmz.supabase.co/rest/v1/trade_events';
const KEY='sb_publishable_nJ8cX-FtOkbzfgdz8Z2IJA_tcg58qfE';
const $ = id => document.getElementById(id);
const form = $('event-filters'), results = $('event-results'), detail = $('detail-shell');
const categoryNames = {b2b_trade_show:'國際貿易商展',b2c_consumer_fair:'消費展',arts_exhibition:'文藝展覽',other_event:'其他展覽'};
// Independently checked against organizer/venue pages 2026-10-29; labeled as manual references, not official CSV ingest.
const REFERENCE_EVENTS = [{"id": "reference-boat-2026", "title_zh": "2026 台灣國際遊艇展", "starts_at": "2026-11-13", "ends_at": "2026-11-15", "city": "高雄市", "venue_name": "亞灣、嘉信22號、愛河灣亞果及高雄港第三船渠遊艇碼頭", "organizer_name": "經濟部國際貿易署、高雄市政府", "official_url": "https://www.boatshow.tw/zh-tw/menu/BC7BC6360A3813FBD0636733C6861689/info.html", "exhibition_category": "b2b_trade_show", "reference_only": true, "summary": "人工整理的商展參考資訊，非自動稽核結果。資料整理日：2026/10/29；票價、報名及異動請查看來源公告。"}, {"id": "reference-health-2026", "title_zh": "2026 台灣醫療科技展", "starts_at": "2026-12-03", "ends_at": "2026-12-06", "city": "臺北市", "venue_name": "台北南港展覽館1館", "organizer_name": "財團法人生技醫療科技政策研究中心（場館公告所列）", "official_url": "https://expo.taiwan-healthcare.org/zh/", "exhibition_category": "b2b_trade_show", "reference_only": true, "summary": "人工整理的商展參考資訊，非自動稽核結果。資料整理日：2026/10/29；票價、報名及異動請查看來源公告。"}, {"id": "reference-timtos-2027", "title_zh": "2027 台北國際工具機展 TIMTOS", "starts_at": "2027-03-02", "ends_at": "2027-03-06", "city": "臺北市", "venue_name": "台北南港展覽館1館、2館", "organizer_name": "中華民國對外貿易發展協會、臺灣機械工業同業公會", "official_url": "https://www.timtos.com.tw/zh-tw/menu/61A553D4CE0B4443D0636733C6861689/info.html", "exhibition_category": "b2b_trade_show", "reference_only": true, "summary": "人工整理的商展參考資訊，非自動稽核結果。資料整理日：2026/10/29；票價、報名及異動請查看來源公告。"}];
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
    return `<article class="event-card"><div class="event-top"><div><span class="eyebrow">${esc(x.city||'台灣')}</span><h3>${esc(x.title_zh||'展覽名稱待確認')}</h3><p class="event-location">${esc(loc)}</p></div><div class="event-date"><b>${esc(state==='展出中'?'展出中':md)}</b><span>${esc(state==='展出中'?'以官方公告為準':s?s.slice(0,4):'日期')}</span></div></div><div class="event-tags"><span class="event-tag is-type">${esc(eventCategoryLabel(x))}</span><span class="event-tag is-state">${esc(state)}</span><span class="event-tag">${esc(date(x.starts_at))}－${esc(date(x.ends_at))}</span>${rangeNote}<span class="event-tag">僅供參考</span></div><p>${esc(desc.slice(0,150))}${desc.length>150?'…':''}</p><div class="event-footer"><span class="source-meta">${esc(source.name)}<br>查核：${esc(x.reference_only?'2026/10/29 整理；非自動稽核':verified(x.last_verified_at))}</span><div class="event-source-links">${sourceLinks(x)}<button class="official-link detail-button" type="button" data-pick="${esc(x.id)}">查看詳情</button></div></div></article>`;
  }).join('')+pagination;
  results.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{currentPage=Number(b.dataset.page);render(list,f);results.scrollIntoView({behavior:'smooth',block:'start'});results.querySelector('.event-pagination').focus({preventScroll:true});}));
  results.querySelectorAll('[data-pick]').forEach(b=>b.addEventListener('click',()=>pick(b.dataset.pick)));
}
function hours(value) {if(!Array.isArray(value)||!value.length)return '待確認（後續補充）';return value.slice(0,8).map(v=>[clean(v.time||v.start||v.raw),clean(v.endTime||v.end),clean(v.locationName)].filter(Boolean).join('－')).filter(Boolean).join('； ')||'待確認（後續補充）';}
function pick(id) {
  const x=events.find(v=>String(v.id)===String(id));if(!x)return;
  selectedVenueEvent=x;
  const activeTab=document.querySelector('.journey-tab.is-active');if(activeTab)journeyInfo(activeTab);
  const source=sourceInfo(x);
  detail.innerHTML=`<article class="event-card"><p class="eyebrow">EXHIBITION REFERENCE · 展覽參考資訊</p><h3>${esc(x.title_zh)}</h3><p class="detail-reference">僅供參考。展期、地點、票價與活動異動，以主辦單位最新公告為準；缺漏資訊後續補充。</p><p>${esc(clean(x.summary)||'簡介待補充。')}</p><ul class="source-list"><li><b>展覽類型</b><span>${esc(eventCategoryLabel(x))}</span></li><li><b>展期狀態</b><span>${esc(dateState(x))}${longRange(x)?'｜日期跨度較長，請核對官方頁面':''}</span></li><li><b>日期</b><span>${esc(date(x.starts_at))}－${esc(date(x.ends_at))}</span></li><li><b>每日時段</b><span>${esc(hours(x.daily_hours))}</span></li><li><b>場館</b><span>${esc(x.venue_name||'待確認（後續補充）')}</span></li><li><b>地址</b><span>${esc(x.address||'待確認（後續補充）')}</span></li><li><b>主辦單位</b><span>${esc(x.organizer_name||'待確認（後續補充）')}</span></li><li><b>票價／報名</b><span>${esc(x.ticket_info||'待確認（後續補充）')}</span></li><li><b>資料來源</b><span>${esc(source.name)}</span></li><li><b>資料查核</b><span>${esc(x.reference_only?'2026/10/29 整理；非自動稽核':verified(x.last_verified_at))}</span></li></ul><div class="hero-actions">${sourceLinks(x,true)}</div></article>`;
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
    const curated=REFERENCE_EVENTS.filter(r=>!approved.some(x=>x.official_url===r.official_url||clean(x.title_zh)===clean(r.title_zh)));
    events=[...approved,...curated];sources=new Map(sourceData.map(s=>[s.id,s]));apply();
  } catch (error) {
    const timedOut=controller.signal.aborted;
    status(timedOut?'展覽資料讀取逾時（10 秒）':'展覽資訊暫時無法載入',timedOut?'網路回應超過 10 秒，請按「重新載入」重試；目前資料並非零筆。':'請稍後重試或前往官方來源查詢；這不代表目前沒有展覽，資訊仍以官方公告為準。',true,true,true);
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
// Module 06 v13.6: first-party factual venue cards. No booking, payment or scraped descriptions.
const LOCAL_ATTRIBUTION='資訊來源：各場館官方公告、主辦單位及公開商業登記數據。本站僅提供公開客觀數據之加值導覽參考，非旅行業、亦不經手或處理任何站內交易。實際營業時間、房價、車資、費率等資訊，請一律以業者與現場最新公告為準。';
const LOCAL_GUIDES={
  nangang:{
    area:'臺北市南港區',label:'南港展覽館 1 館',source:'台北南港展覽館交通公告；店家公開商業資訊',
    hotels:[
      {name:'台北漢來大飯店',address:'臺北市南港區經貿一路168號',phone:'02-2788-6868',stars:'星級待官方核實',distance:'實際步行距離待核實',price:'房價隨日期變動，待業者公開報價核實'},
      {name:'南港老爺行旅',address:'臺北市南港區經貿二路196號10樓',phone:'02-7750-0588',stars:'星級待官方核實',distance:'實際步行距離待核實',price:'房價隨日期變動，待業者公開報價核實'}],
    food:[
      {name:'欣葉小聚 南港店',type:'臺菜',address:'臺北市南港區經貿二路166號1樓',phone:'02-2785-1819',hours:'每日 11:00–14:30、17:00–21:00（以店家公告為準）',price:'每人消費待菜單核實',dish:'臺式飯菜'},
      {name:'武侍酒 日式居酒屋',type:'日式居酒屋',address:'臺北市南港區南港路一段111號',phone:'02-2653-6773',hours:'午餐及晚餐時段；每日時段可能不同',price:'每人消費待菜單核實',dish:'燒肉料理'}],
    transit:[
      ['捷運','板南線／文湖線「南港展覽館站」1 號出口，沿左側至 1 館；2 館走地下連通道'],
      ['高鐵／臺鐵','南港站轉捷運板南線至南港展覽館站'],
      ['公車','南港展覽館站（1 館）：589、817、951、藍22、藍15 等；班次以即時公告為準'],
      ['停車','展館停車費率待場館最新公告核實'],
      ['末班車','依搭乘路線、方向及日期而異；未取得可核實班次，不顯示推估時間']],
    weather:'臺北市南港區',weatherNote:'目前尚未接入具合法授權與穩定更新的行政區天氣 API，無法提供即時溫度、降雨機率或一週預報。'
  },
  kaohsiung:{
    area:'高雄市前鎮區',label:'高雄展覽館／亞灣遊艇展區',source:'高雄展覽館交通公告；店家公開商業資訊',
    hotels:[
      {name:'高雄洲際酒店',address:'高雄市前鎮區新光路33號',phone:'07-339-1888',stars:'星級待官方核實',distance:'實際步行距離待核實',price:'房價隨日期變動，待業者公開報價核實'},
      {name:'高雄日航酒店',address:'高雄市前鎮區林森四路268號',phone:'07-537-8800',stars:'星級待官方核實',distance:'實際步行距離待核實',price:'房價隨日期變動，待業者公開報價核實'}],
    food:[
      {name:'Belon 貝隆餐酒館',type:'西式海鮮餐飲',address:'高雄市前鎮區成功二路39-1號',phone:'0908-888-382',hours:'多為 16:30 起晚間營業；每日以業者公告為準',price:'每人消費待菜單核實',dish:'海鮮料理'},
      {name:'Sauga Bar 鯊加碼頭餐酒館',type:'西式餐酒館',address:'高雄市前鎮區成功二路周邊碼頭區（門牌待核實）',phone:'07-537-1558',hours:'晚間時段；每日以業者公告為準',price:'每人消費待菜單核實',dish:'西式餐點'}],
    transit:[
      ['捷運','紅線 R8 三多商圈站 2 號出口，場館公告步行約 10 分鐘'],
      ['輕軌','C8 高雄展覽館站，場館公告步行約 7 分鐘'],
      ['高鐵','左營站轉捷運紅線至 R8 三多商圈站'],
      ['公車','高雄展覽館站：紅21；輕軌高雄展覽館站附近：214A'],
      ['停車','高雄展覽館汽車前 30 分鐘免費；一般每半小時 30 元、展會每半小時 40 元；每日上限依公告'],
      ['末班車','依路線、方向及日期而異；請於出發前核實，不提供推估時間']],
    weather:'高雄市前鎮區',weatherNote:'目前尚未接入具合法授權與穩定更新的行政區天氣 API，無法提供即時溫度、降雨機率或一週預報。'
  }
};
let selectedVenueEvent=null;
function currentGuide(){
  const v=clean(selectedVenueEvent?.venue_name),city=clean(selectedVenueEvent?.city);
  if(/南港展覽館|TaiNEX/i.test(v))return LOCAL_GUIDES.nangang;
  if(/亞灣|遊艇碼頭|高雄展覽館|愛河灣|第三船渠/i.test(v))return LOCAL_GUIDES.kaohsiung;
  if(city.includes('高雄') && /遊艇/.test(clean(selectedVenueEvent?.title_zh)))return LOCAL_GUIDES.kaohsiung;
  return null;
}
function localCard(title,items){
  return '<article class="event-card" style="margin:0 0 12px"><h4>'+esc(title)+'</h4><ul class="source-list">'+items.map(([k,v])=>'<li><b>'+esc(k)+'</b><span>'+esc(v||'待核實')+'</span></li>').join('')+'</ul></article>';
}
function journeyInfo(tab){
  const panel=$('journey-panel');if(!panel)return;
  const guide=currentGuide(),kind=tab.dataset.journey;
  if(!guide){panel.innerHTML='<div class="event-status"><b>請先選擇展覽</b><p>選取展覽「查看詳情」後，這裡會顯示該展區已查核的生活圈資料。</p></div>';return;}
  let cards='';
  if(kind==='stay')cards=guide.hotels.map(h=>localCard(h.name,[['地址',h.address],['電話',h.phone],['星級',h.stars],['距展館',h.distance],['公開房價',h.price]])).join('');
  else if(kind==='food')cards=guide.food.map(h=>localCard(h.name,[['料理',h.type],['地址',h.address],['電話',h.phone],['營業時間',h.hours],['平均消費',h.price],['特色料理',h.dish]])).join('');
  else if(kind==='move')cards=guide.transit.map(([a,b])=>localCard(a,[['路線／資訊',b]])).join('');
  else if(kind==='wear')cards=localCard(guide.weather,[['即時溫度','尚無已驗證即時數據'],['降雨機率','尚無已驗證即時數據'],['未來一週','尚無已驗證預報'],['更新狀態',guide.weatherNote]]);
  else cards=localCard('周邊活動',[['展區',guide.area],['資料狀態','周邊活動清單核實整理中，尚無可發布紀錄']]);
  panel.innerHTML='<section aria-label="展館生活圈站內資訊"><p><b>'+esc(guide.label)+'｜'+esc(guide.area)+'</b></p><p>本站直接展示已核實客觀資料，不提供代訂、交易或自動排行程；未確認欄位保留「待核實」。</p>'+cards+'<p class="service-disclaimer"><b>資訊與法遵說明</b><br>'+esc(LOCAL_ATTRIBUTION)+'<br>本批資料整理日：2026/10/29；來源：'+esc(guide.source)+'。遊艇展涉及多個碼頭，所列高雄展覽館周邊資料不代表每一碼頭皆在步行範圍內。</p></section>';
}
document.querySelectorAll('.journey-tab').forEach(tab=>tab.addEventListener('click',()=>{
  document.querySelectorAll('.journey-tab').forEach(x=>x.classList.toggle('is-active',x===tab));
  journeyInfo(tab);
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
load();
})();
