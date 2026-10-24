'use strict';

(() => {
  const byId = id => document.getElementById(id);
  const ui = {
    form: byId('event-filters'),
    results: byId('event-results')
  };

  ui.form.addEventListener('submit', event => {
    event.preventDefault();
    if (!ui.form.reportValidity()) return;
    ui.results.innerHTML = '<div class="event-status is-error"><p><b>目前無法搜尋網路</b><br>服務接通前不顯示寫死資料或假結果。</p></div>';
  });

  ui.form.addEventListener('reset', () => requestAnimationFrame(() => {
    ui.results.innerHTML = '<div class="event-status"><p><b>目前沒有搜尋結果</b><br>真實網路搜尋服務接通後，結果才會顯示在這裡。</p></div>';
  }));

  document.querySelectorAll('.journey-tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.journey-tab').forEach(item => item.classList.toggle('is-active', item === tab));
    const label = tab.childNodes[0].textContent.trim();
    document.getElementById('journey-panel').innerHTML = '<div><span class="status-chip">P1 · 尚未接通</span><h3>' + label + '類資料尚未接通</h3><p>選定有可靠來源的商展並接入相應資料服務後，才會顯示內容。</p></div><div class="pending-card"><b>目前沒有資料</b><span>不使用固定推薦或虛構即時資訊。</span></div>';
  }));

  document.getElementById('planner-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const start = new Date(data.depart + 'T00:00:00');
    const end = new Date(data.return + 'T00:00:00');
    if (end < start) {
      alert('返回日期不能早於出發日期。');
      return;
    }

    const output = document.getElementById('timeline-output');
    output.hidden = false;
    output.innerHTML = '<div class="timeline-head"><div><span class="status-chip">P1 · 尚未接通</span><h3>目前無法建立智慧行程</h3><p>AI 排程、真實商展、交通、住宿與地點資料尚未接通；本次輸入未送出或儲存，也沒有產生固定行程。</p></div><button type="button" class="filter-reset" data-close-timeline>關閉</button></div>';
    output.querySelector('[data-close-timeline]').addEventListener('click', () => {
      output.hidden = true;
    });
    output.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
