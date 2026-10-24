'use strict';

(() => {
  const byId = id => document.getElementById(id);
  const ui = {
    form: byId('event-filters'), query: byId('event-query'), country: byId('event-country'),
    industry: byId('event-industry'), from: byId('event-from'), to: byId('event-to'),
    status: byId('event-status'), results: byId('event-results'), bar: byId('data-bar'),
    label: byId('data-label'), detail: byId('data-detail'), retry: byId('retry-events')
  };
  let events = [];
  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

  function valid(item) {
    try {
      const source = new URL(item.source_url);
      return source.protocol === 'https:' && item.name_zh && /^\d{4}-\d{2}-\d{2}$/.test(item.start_date) && /^\d{4}-\d{2}-\d{2}$/.test(item.end_date);
    } catch { return false; }
  }

  function normalise(item) {
    const fields = ['id','name_zh','name_en','country','country_code','city','industry','start_date','end_date','summary_zh','source_name','source_url','verified_at'];
    return Object.fromEntries(fields.map(field => [field, String(item[field] ?? '')]));
  }

  async function fromSupabase() {
    const config = typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG : null;
    if (!config?.url || !config?.publishableKey) throw new Error('未設定 Supabase 公開連線');
    const table = config.tradeEventsTable;
    if (!table) throw new Error('已偵測 Supabase 公開設定，商展資料表尚未啟用');
    const headers = { apikey: config.publishableKey };
    const columns = 'id,name_zh,name_en,country,country_code,city,industry,start_date,end_date,summary_zh,source_name,source_url,verified_at';
    const response = await fetch(`${config.url}/rest/v1/${encodeURIComponent(table)}?select=${columns}&is_published=eq.true&order=start_date.asc`, {
      headers, signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) throw new Error(`Supabase 回應 ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) throw new Error('Supabase 尚無公開商展資料');
    return rows.filter(valid).map(normalise);
  }

  async function fromFallback() {
    const response = await fetch('data/trade-events.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`備援資料回應 ${response.status}`);
    const cleaned = (await response.json()).filter(valid).map(normalise);
    if (!cleaned.length) throw new Error('備援資料格式不完整');
    return cleaned;
  }

  function fillSelect(select, values) {
    [...select.options].slice(1).forEach(option => option.remove());
    values.sort((a,b) => a.localeCompare(b, 'zh-Hant')).forEach(value => select.add(new Option(value, value)));
  }

  function formattedDate(start, end) {
    const first = new Date(`${start}T00:00:00`), last = new Date(`${end}T00:00:00`);
    const formatter = new Intl.DateTimeFormat('zh-TW', { month:'short', day:'numeric' });
    return { year: first.getFullYear(), range: start === end ? formatter.format(first) : `${formatter.format(first)}－${formatter.format(last)}` };
  }

  function render() {
    const query = ui.query.value.trim().toLocaleLowerCase('zh-Hant');
    const filtered = events.filter(item => {
      const words = [item.name_zh,item.name_en,item.country,item.city,item.industry].join(' ').toLocaleLowerCase('zh-Hant');
      return (!query || words.includes(query)) && (!ui.country.value || item.country === ui.country.value) &&
        (!ui.industry.value || item.industry === ui.industry.value) && (!ui.from.value || item.end_date >= ui.from.value) &&
        (!ui.to.value || item.start_date <= ui.to.value);
    });
    if (!filtered.length) {
      ui.results.hidden = true; ui.status.hidden = false; ui.status.className = 'event-status';
      ui.status.innerHTML = '<p><b>找不到符合條件的商展</b><br>請放寬關鍵字、國家、產業或日期範圍。這不代表該市場沒有活動。</p>';
      ui.detail.textContent = `顯示 0 筆，共 ${events.length} 筆可查證資料`;
      return;
    }
    ui.status.hidden = true; ui.results.hidden = false;
    ui.results.innerHTML = filtered.map(item => {
      const date = formattedDate(item.start_date,item.end_date);
      return `<article class="event-card"><div class="event-top"><div><span class="eyebrow">${escapeHTML(item.industry)}</span><h3>${escapeHTML(item.name_zh)}</h3><p class="event-location">${escapeHTML(item.name_en)} · ${escapeHTML(item.city)}，${escapeHTML(item.country)}</p></div><div class="event-date"><b>${escapeHTML(date.range)}</b><span>${date.year}</span></div></div><div class="event-tags"><span class="event-tag">${escapeHTML(item.country)}</span><span class="event-tag">${escapeHTML(item.industry)}</span><span class="event-tag">官方來源</span></div><p>${escapeHTML(item.summary_zh)}</p><footer class="event-footer"><span class="source-meta">來源：${escapeHTML(item.source_name)}<br>查核：${escapeHTML(item.verified_at || '未標示')}</span><a class="official-link" href="${escapeHTML(item.source_url)}" target="_blank" rel="noopener noreferrer">查看官方資訊 ↗</a></footer></article>`;
    }).join('');
    ui.detail.textContent = `顯示 ${filtered.length} 筆，共 ${events.length} 筆可查證資料`;
  }

  async function load() {
    ui.status.hidden = false; ui.status.className = 'event-status';
    ui.status.innerHTML = '<span class="spinner" aria-hidden="true"></span><p>正在載入商展資料…</p>';
    ui.results.hidden = true; ui.retry.hidden = true; ui.bar.className = 'data-bar';
    ui.label.textContent = '正在連接資料來源…'; ui.detail.textContent = '請稍候';
    try {
      events = await fromSupabase(); ui.bar.classList.add('is-live'); ui.label.textContent = 'Supabase 公開資料';
    } catch (databaseError) {
      try {
        events = await fromFallback(); ui.bar.classList.add('is-fallback'); ui.label.textContent = '官方來源備援資料';
        ui.detail.textContent = `資料庫暫不可用；顯示網站內建且已查證的資料（${databaseError.message}）`; ui.retry.hidden = false;
      } catch (fallbackError) {
        ui.status.className = 'event-status is-error';
        ui.status.innerHTML = `<p><b>目前無法載入商展資料</b><br>${escapeHTML(fallbackError.message)}。請稍後再試，或直接使用官方商展網站查詢。</p>`;
        ui.label.textContent = '資料載入失敗'; ui.detail.textContent = '沒有顯示未經確認的資料'; ui.retry.hidden = false; return;
      }
    }
    fillSelect(ui.country,[...new Set(events.map(item => item.country).filter(Boolean))]);
    fillSelect(ui.industry,[...new Set(events.map(item => item.industry).filter(Boolean))]); render();
  }

  ui.form.addEventListener('input', render);
  ui.form.addEventListener('reset', () => requestAnimationFrame(render));
  ui.retry.addEventListener('click', load);
  load();
})();
