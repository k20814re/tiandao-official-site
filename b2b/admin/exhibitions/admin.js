"use strict";
(() => {
  const cfg =
    window.SUPABASE_CONFIG || window.supabaseConfig || SUPABASE_CONFIG;
  const API = cfg.url,
    KEY = cfg.publishableKey,
    STORE = "tiandao_admin_session";
  const $ = (id) => document.getElementById(id),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  let session = JSON.parse(sessionStorage.getItem(STORE) || "null"),
    profile = null,
    events = [],
    sources = [];
  function recoverySessionFromUrl() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get("type") !== "recovery" || !p.get("access_token")) return null;
    return {
      access_token: p.get("access_token"),
      refresh_token: p.get("refresh_token"),
      token_type: p.get("token_type") || "bearer",
      expires_in: Number(p.get("expires_in") || 0),
      type: "recovery",
    };
  }
  const msg = (id, text, type = "") => {
    const el = $(id);
    el.textContent = text;
    el.className = "message" + (type ? " is-" + type : "");
  };
  const headers = (extra = {}) => ({
    apikey: KEY,
    "Content-Type": "application/json",
    ...(session?.access_token
      ? { Authorization: "Bearer " + session.access_token }
      : {}),
    ...extra,
  });
  async function request(path, options = {}) {
    const r = await fetch(API + path, {
      ...options,
      headers: headers(options.headers),
    });
    if (
      r.status === 401 &&
      session?.refresh_token &&
      !options._retried &&
      path !== "/auth/v1/token?grant_type=refresh_token"
    ) {
      await refresh();
      return request(path, { ...options, _retried: true });
    }
    if (!r.ok) {
      let body = {};
      try {
        body = await r.json();
      } catch {}
      const e = new Error(
        body.message ||
          body.error_description ||
          body.detail ||
          (typeof body.error === "string" ? body.error : "") ||
          body.hint ||
          "HTTP " + r.status,
      );
      e.status = r.status;
      throw e;
    }
    if (r.status === 204 || r.status === 205 || r.headers.get("content-length") === "0") return null;
    const bodyText = await r.text();
    return bodyText ? JSON.parse(bodyText) : null;
  }
  async function refresh() {
    const r = await fetch(API + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!r.ok) {
      logout();
      throw new Error("登入已過期");
    }
    session = await r.json();
    sessionStorage.setItem(STORE, JSON.stringify(session));
  }
  async function login(email, password) {
    const r = await fetch(API + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) {
      const b = await r.json();
      throw new Error(b.error_description || "登入失敗");
    }
    session = await r.json();
    sessionStorage.setItem(STORE, JSON.stringify(session));
    await boot();
  }
  async function updatePassword(password) {
    const r = await fetch(API + "/auth/v1/user", {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ password }),
    });
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      throw new Error(
        b.msg || b.message || b.error_description || "密碼更新失敗",
      );
    }
    session.user = await r.json();
    history.replaceState(null, "", location.pathname + location.search);
    sessionStorage.setItem(STORE, JSON.stringify(session));
    $("recovery-view").hidden = true;
    await boot();
  }
  function logout() {
    session = null;
    profile = null;
    sessionStorage.removeItem(STORE);
    $("app-view").hidden = true;
    $("login-view").hidden = false;
    $("logout").hidden = true;
  }
  async function boot() {
    if (!session) return logout();
    try {
      profile = (
        await request(
          "/rest/v1/exhibition_admin_profiles?select=user_id,role,display_name&user_id=eq." +
            encodeURIComponent(session.user.id),
        )
      )[0];
      if (!profile) throw new Error("此帳號尚未指派展覽後台角色");
      $("identity").textContent =
        (profile.display_name || session.user.email) + "｜" + profile.role;
      $("login-view").hidden = true;
      $("app-view").hidden = false;
      $("logout").hidden = false;
      await Promise.all([loadSources(), loadEvents()]);
    } catch (e) {
      if (e.status === 404) $("setup-notice").hidden = false;
      msg("login-message", e.message, "error");
      logout();
    }
  }
  async function loadSources() {
    sources = await request(
      "/rest/v1/trade_event_sources?select=id,code,name,source_type,is_active&is_active=eq.true&order=name",
    );
    const options = sources
      .map(
        (s) =>
          '<option value="' +
          esc(s.id) +
          '">' +
          esc(s.name) +
          "（" +
          esc(s.source_type) +
          "）</option>",
      )
      .join("");
    $("source-filter").innerHTML =
      '<option value="">全部來源</option>' + options;
    $("form-source").innerHTML = '<option value="">人工建立</option>' + options;
    $("import-source").innerHTML = '<option value="">請選擇</option>' + options;
  }
  async function loadEvents() {
    msg("app-message", "正在載入…");
    events = await request(
      "/rest/v1/trade_events?select=id,title_zh,summary,city,venue_name,address,starts_at,ends_at,organizer_name,official_url,publication_status,source_id,external_id,country_code,timezone,currency_code,translations,updated_at,deleted_at,exhibition_category,source_checked_at&deleted_at=is.null&order=updated_at.desc&limit=1000",
    );
    render();
    msg("app-message", "共載入 " + events.length + " 筆", "ok");
  }
  const statusName = (s) =>
    ({ draft: "草稿", archived: "已封存", published: "已發布" })[s] || s;
  function isTradeShowCandidate(x) {
    const title = String(x.title_zh || "");
    const sourceName = String(sources.find((s) => s.id === x.source_id)?.name || "");
    const combined = title + " " + sourceName;
    return /商展|國際.*展|產業展|貿易展|專業展|展售|博覽會|旅展|車展|電腦展|食品展|烘焙展|玩具展|寵物展|工具機展|半導體展|電子展|加盟展|建材展|家具展|機械展|自動化展/.test(combined);
  }
  const categoryName = (s) => ({b2b_trade_show:"B2B 專業商展",b2c_consumer_fair:"B2C 消費展",arts_exhibition:"藝文展",other_event:"一般活動"})[s] || "未分類";
  function render() {
    for (const s of ["draft", "archived", "published"])
      $("count-" + s).textContent = events.filter(
        (x) => x.publication_status === s,
      ).length;
    $("count-all").textContent = events.length;
    const q = $("search").value.trim().toLowerCase(),
      st = $("status-filter").value,
      src = $("source-filter").value,
      tradeOnly = $("trade-only").checked,
      category = $("category-filter").value;
    const rows = events.filter(
      (x) =>
        (!st || x.publication_status === st) &&
        (!src || x.source_id === src) &&
        (!tradeOnly || isTradeShowCandidate(x)) &&
        (!category || (category === "unclassified" ? !x.exhibition_category : x.exhibition_category === category)) &&
        (!q ||
          [x.title_zh, x.city, x.venue_name, x.organizer_name]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
    $("event-list").innerHTML = rows.length
      ? rows
          .map((x) => {
            const source = sources.find((s) => s.id === x.source_id);
            return (
              "<tr><td><b>" +
              esc(x.title_zh) +
              "</b><small>" +
              esc(x.external_id || x.id) + "</small><small>" + esc(categoryName(x.exhibition_category)) +
              "</small></td><td>" +
              esc(String(x.starts_at || "").slice(0, 10)) +
              "－" +
              esc(String(x.ends_at || "").slice(0, 10)) +
              "<small>" +
              esc(
                [x.city, x.venue_name].filter(Boolean).join(" · ") ||
                  "地點未填",
              ) +
              "</small></td><td>" +
              esc(source?.name || "人工") +
              '</td><td><span class="badge ' +
              esc(x.publication_status) +
              '">' +
              esc(statusName(x.publication_status)) +
              "</span></td><td>" +
              esc(new Date(x.updated_at).toLocaleString("zh-TW")) +
              '</td><td><div class="row-actions"><button data-edit="' +
              esc(x.id) +
              '">編輯</button><button class="danger" data-delete="' +
              esc(x.id) +
              '">封存</button></div></td></tr>'
            );
          })
          .join("")
      : '<tr><td colspan="6">沒有符合條件的資料。</td></tr>';
  }
  function localValue(v) {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d)
      ? ""
      : new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  function openEvent(x = {}) {
    const f = $("event-form");
    f.reset();
    f.elements.id.value = x.id || "";
    for (const k of [
      "title_zh",
      "publication_status",
      "source_id",
      "external_id",
      "country_code",
      "timezone",
      "currency_code",
      "city",
      "venue_name",
      "address",
      "organizer_name",
      "official_url",
      "summary",
      "exhibition_category",
    ])
      if (x[k] != null) f.elements[k].value = x[k];
    f.elements.source_checked_at.value = x.source_checked_at ? String(x.source_checked_at).slice(0, 10) : "";
    f.elements.starts_at.value = localValue(x.starts_at);
    f.elements.ends_at.value = localValue(x.ends_at);
    f.elements.translations.value = x.translations
      ? JSON.stringify(x.translations, null, 2)
      : "";
    if (!x.id) {
      f.elements.country_code.value = "TW";
      f.elements.timezone.value = "Asia/Taipei";
      f.elements.currency_code.value = "TWD";
      f.elements.publication_status.value = "draft";
    }
    $("event-dialog-title").textContent = x.id ? "編輯展覽" : "新增展覽";
    $("event-dialog").showModal();
  }
  async function saveEvent() {
    const f = $("event-form");
    if (!f.reportValidity()) return;
    const d = Object.fromEntries(new FormData(f));
    if (Number.isNaN(Date.parse(d.starts_at)) || Number.isNaN(Date.parse(d.ends_at)) || new Date(d.ends_at) < new Date(d.starts_at))
      return msg("app-message", "結束時間不得早於開始時間", "error");
    let translations = {};
    if (d.translations.trim())
      try {
        translations = JSON.parse(d.translations);
      } catch {
        return msg("app-message", "多語翻譯必須是有效 JSON", "error");
      }
    const id = d.id;
    delete d.id;
    d.source_id = d.source_id || null;
    d.exhibition_category = d.exhibition_category || null;
    d.source_checked_at = d.source_checked_at ? new Date(d.source_checked_at + "T00:00:00+08:00").toISOString() : null;
    d.external_id = d.external_id || null;
    d.country_code = (d.country_code || "TW").toUpperCase();
    d.currency_code = (d.currency_code || "TWD").toUpperCase();
    d.starts_at = new Date(d.starts_at).toISOString();
    d.ends_at = new Date(d.ends_at).toISOString();
    d.translations = translations;
    const path =
      "/rest/v1/trade_events" + (id ? "?id=eq." + encodeURIComponent(id) : "");
    await request(path, {
      method: id ? "PATCH" : "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(d),
    });
    $("event-dialog").close();
    await loadEvents();
    msg("app-message", id ? "展覽已更新" : "展覽已建立", "ok");
  }
  async function archive(id) {
    if (!confirm("確定封存這筆展覽？公開頁將不再顯示。")) return;
    await request("/rest/v1/trade_events?id=eq." + encodeURIComponent(id), {
      method: "PATCH",
      body: JSON.stringify({
        deleted_at: new Date().toISOString(),
        publication_status: "draft",
      }),
    });
    await loadEvents();
  }
  async function parseFile(file) {
    const data = await file.arrayBuffer();
    if (!window.XLSX) throw new Error("XLSX 解析器尚未載入，請重新整理後再試");
    const book = XLSX.read(data, { type: "array", cellDates: true });
    return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], {
      defval: "",
    });
  }
  async function digest(text) {
    const data = new TextEncoder().encode(text.normalize("NFKC").toLowerCase());
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  }
  async function importRows(rows, sourceId) {
    const required = ["title_zh", "starts_at", "ends_at"];
    const valid = [],
      errors = [],
      seenKeys = new Set();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const missing = required.filter((k) => !String(r[k] || "").trim());
      if (missing.length) {
        errors.push("第 " + (i + 2) + " 列缺少 " + missing.join(", "));
        continue;
      }
      const start = new Date(r.starts_at),
        end = new Date(r.ends_at);
      if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
        errors.push("第 " + (i + 2) + " 列日期無效");
        continue;
      }
      const translations = {};
      if (r.title_en || r.summary_en)
        translations.en = {
          title: String(r.title_en || ""),
          summary: String(r.summary_en || ""),
        };
      if (r.summary_zh)
        translations["zh-Hant"] = { summary: String(r.summary_zh) };
      const fingerprint = await digest(
        [
          r.title_zh,
          start.toISOString(),
          r.venue_name || "",
          r.organizer_name || "",
        ].join("|"),
      );
      const canonicalKey = "curated:" + sourceId + ":" + fingerprint;
      if (seenKeys.has(canonicalKey)) continue;
      seenKeys.add(canonicalKey);
      const allowedCategories = ["b2b_trade_show","b2c_consumer_fair","arts_exhibition","other_event"];
      if (r.exhibition_category && !allowedCategories.includes(String(r.exhibition_category).trim())) {
        errors.push("第 " + (i + 2) + " 列分類代碼不正確");
        continue;
      }
      const checkedAt = String(r.source_checked_at || "").trim();
      if (checkedAt && (!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt) || Number.isNaN(Date.parse(checkedAt + "T00:00:00+08:00")))) {
        errors.push("第 " + (i + 2) + " 列官方來源查核日期格式不正確（YYYY-MM-DD）");
        continue;
      }
      valid.push({
        canonical_key: canonicalKey,
        title_zh: String(r.title_zh).trim(),
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        city: r.city || null,
        venue_name: r.venue_name || null,
        address: r.address || null,
        organizer_name: r.organizer_name || null,
        official_url: r.official_url || null,
        summary: r.summary_zh || null,
        exhibition_category: ["b2b_trade_show","b2c_consumer_fair","arts_exhibition","other_event"].includes(String(r.exhibition_category || "")) ? r.exhibition_category : null,
        source_checked_at: checkedAt ? new Date(checkedAt + "T00:00:00+08:00").toISOString() : null,
        external_id: r.external_id || null,
        source_id: sourceId,
        country_code: String(r.country_code || "TW").toUpperCase(),
        timezone: r.timezone || "Asia/Taipei",
        currency_code: String(r.currency_code || "TWD").toUpperCase(),
        translations,
        publication_status: "draft",
        dedupe_fingerprint: fingerprint,
        deleted_at: null,
      });
    }
    if (errors.length) throw new Error(errors.slice(0, 8).join("；"));
    if (!valid.length) throw new Error("沒有可匯入的資料");
    // Requires a unique index on canonical_key; ignore conflicts atomically.
    // No merge: never overwrite existing editorial changes or published events.
    let inserted = 0;
    for (let i = 0; i < valid.length; i += 50) {
      const batch = valid.slice(i, i + 50);
      const result = await request("/rest/v1/trade_events?on_conflict=canonical_key&select=id", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify(batch),
      });
      inserted += Array.isArray(result) ? result.length : 0;
    }
    return inserted;
  }
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    msg("login-message", "登入中…");
    try {
      const d = new FormData(e.currentTarget);
      await login(d.get("email"), d.get("password"));
    } catch (err) {
      msg("login-message", err.message, "error");
    }
  });
  $("recovery-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget),
      password = String(d.get("password") || ""),
      confirmation = String(d.get("password_confirm") || "");
    if (password !== confirmation)
      return msg("recovery-message", "兩次輸入的密碼不一致", "error");
    msg("recovery-message", "正在儲存新密碼…");
    try {
      await updatePassword(password);
      msg("app-message", "密碼已更新並完成登入", "ok");
    } catch (err) {
      msg("recovery-message", err.message, "error");
    }
  });
  $("logout").addEventListener("click", logout);
  $("reload").addEventListener("click", () =>
    loadEvents().catch((e) => msg("app-message", e.message, "error")),
  );
  $("sync-taipei").addEventListener("click", async () => {
    if (profile?.role !== "publisher")
      return msg("app-message", "只有 publisher 可以執行官方來源同步", "error");
    msg("app-message", "正在同步臺北旅遊網，資料會先進入待審核…");
    try {
      const result = await request("/functions/v1/sync-taipei-events", {
        method: "POST",
        body: "{}",
      });
      await loadEvents();
      msg(
        "app-message",
        "臺北旅遊網同步完成：讀取 " +
          result.fetched +
          " 筆，新增或更新 " +
          result.created_or_updated +
          " 筆；尚未自動發布。",
        "ok",
      );
    } catch (e) {
      msg("app-message", "同步失敗：" + e.message, "error");
    }
  });
  $("new-event").addEventListener("click", () => openEvent());
  $("open-import").addEventListener("click", () =>
    $("import-dialog").showModal(),
  );
  for (const id of ["search", "status-filter", "source-filter", "trade-only", "category-filter"])
    $(id).addEventListener(id === "search" ? "input" : "change", render);
  document.querySelectorAll("[data-status]").forEach((b) =>
    b.addEventListener("click", () => {
      $("status-filter").value = b.dataset.status;
      render();
    }),
  );
  $("event-list").addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]"),
      del = e.target.closest("[data-delete]");
    if (edit) openEvent(events.find((x) => x.id === edit.dataset.edit));
    if (del)
      archive(del.dataset.delete).catch((x) =>
        msg("app-message", x.message, "error"),
      );
  });
  $("save-event").addEventListener("click", (e) => {
    e.preventDefault();
    saveEvent().catch((x) => msg("app-message", x.message, "error"));
  });
  $("run-import").addEventListener("click", async (e) => {
    e.preventDefault();
    const f = $("import-form");
    if (!f.reportValidity()) return;
    msg("import-message", "檢查檔案中…");
    try {
      const d = new FormData(f),
        rows = await parseFile(d.get("file"));
      $("import-preview").hidden = false;
      $("import-preview").textContent =
        "讀取 " + rows.length + " 列；正在去重並建立草稿…";
      const n = await importRows(rows, d.get("source_id"));
      msg("import-message", "已匯入 " + n + " 筆草稿", "ok");
      await loadEvents();
    } catch (x) {
      msg("import-message", x.message, "error");
    }
  });
  const recoverySession = recoverySessionFromUrl();
  if (recoverySession) {
    session = recoverySession;
    $("login-view").hidden = true;
    $("recovery-view").hidden = false;
  } else {
    boot();
  }
})();
