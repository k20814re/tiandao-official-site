(function () {
  "use strict";

  const DATA_URL = "data/site-content.json";
  const PLATFORM_ICONS = {
    discord: "☯",
    facebook: "f",
    youtube: "▶",
    "x (twitter)": "𝕏",
    x: "𝕏",
    twitter: "𝕏"
  };

  const byId = (id) => document.getElementById(id);

  function setText(id, value) {
    const element = byId(id);
    if (element && typeof value === "string" && value.trim()) {
      element.textContent = value.trim();
    }
  }

  function safeImagePath(value) {
    if (typeof value !== "string") return "";
    const path = value.trim();
    if (!path || path.startsWith("//") || path.includes("..")) return "";
    if (/^https:\/\//i.test(path) || /^[a-z0-9_./-]+$/i.test(path)) return path;
    return "";
  }

  function safeLink(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      const url = new URL(value.trim());
      return url.protocol === "https:" ? url.href : "";
    } catch (_error) {
      return "";
    }
  }

  function renderNews(items) {
    const container = byId("newsList");
    if (!container || !Array.isArray(items) || !items.length) return;

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      if (!item || typeof item.title !== "string" || !item.title.trim()) return;
      const article = document.createElement("article");
      const image = document.createElement("img");
      image.src = safeImagePath(item.image) || "assets/images/hero-poster.webp";
      image.alt = "";

      const copy = document.createElement("div");
      const heading = document.createElement("h3");
      heading.textContent = item.title.trim();
      if (typeof item.badge === "string" && item.badge.trim()) {
        const badge = document.createElement("em");
        badge.textContent = item.badge.trim();
        heading.appendChild(badge);
      }
      const description = document.createElement("p");
      description.textContent = typeof item.description === "string" ? item.description.trim() : "";
      copy.append(heading, description);

      const time = document.createElement("time");
      time.textContent = typeof item.date === "string" ? item.date.trim() : "";
      if (time.textContent) time.dateTime = time.textContent;
      article.append(image, copy, time);
      fragment.appendChild(article);
    });

    if (fragment.childNodes.length) container.replaceChildren(fragment);
  }

  function renderRoadmap(items) {
    const container = byId("roadmapGrid");
    if (!container || !Array.isArray(items) || !items.length) return;

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      if (!item || typeof item.title !== "string" || !item.title.trim()) return;
      const article = document.createElement("article");
      article.className = item.current ? "active reveal visible" : "reveal visible";
      const phase = document.createElement("small");
      phase.textContent = typeof item.phase === "string" ? item.phase.trim() : "";
      const title = document.createElement("h3");
      title.textContent = item.title.trim();
      const description = document.createElement("p");
      description.textContent = typeof item.description === "string" ? item.description.trim() : "";
      article.append(phase, title, description, document.createElement("i"));
      fragment.appendChild(article);
    });

    if (fragment.childNodes.length) container.replaceChildren(fragment);
  }

  function renderWorldFlow(items) {
    const container = byId("worldFlow");
    if (!container || !Array.isArray(items) || !items.length) return;

    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => {
      if (!item || typeof item.name !== "string" || !item.name.trim()) return;
      const step = document.createElement("div");
      if (item.current) step.className = "current";
      const order = Number.isFinite(Number(item.order)) && Number(item.order) > 0
        ? Number(item.order)
        : index + 1;
      const number = document.createElement("small");
      number.textContent = String(order).padStart(2, "0");
      const name = document.createElement("b");
      name.textContent = item.name.trim();
      step.append(number, name);
      fragment.appendChild(step);
    });

    const itemCount = fragment.childNodes.length;
    if (itemCount) {
      container.replaceChildren(fragment);
      container.style.setProperty("--flow-columns", String(itemCount));
    }
  }

  function renderRealms(items) {
    const container = byId("realmStrip");
    if (!container || !Array.isArray(items) || !items.length) return;

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      if (!item || typeof item.name !== "string" || !item.name.trim()) return;
      const realm = document.createElement("b");
      realm.textContent = item.name.trim();
      fragment.appendChild(realm);
    });
    if (fragment.childNodes.length) container.replaceChildren(fragment);
  }

  function renderSocial(items) {
    const container = byId("socialGrid");
    if (!container || !Array.isArray(items) || !items.length) return;

    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => {
      if (!item || typeof item.platform !== "string" || !item.platform.trim()) return;
      const href = safeLink(item.url);
      const card = document.createElement(href ? "a" : "span");
      card.className = `social social-${(index % 4) + 1}`;
      if (href) {
        card.href = href;
        card.target = "_blank";
        card.rel = "noopener noreferrer";
      }
      const icon = document.createElement("b");
      const platform = item.platform.trim();
      icon.textContent = PLATFORM_ICONS[platform.toLowerCase()] || platform.slice(0, 1).toUpperCase();
      const name = document.createElement("small");
      name.textContent = platform;
      const status = document.createElement("em");
      status.textContent = typeof item.status === "string" && item.status.trim()
        ? item.status.trim()
        : (href ? "前往官方社群" : "即將公開");
      card.append(icon, name, status);
      fragment.appendChild(card);
    });
    if (fragment.childNodes.length) container.replaceChildren(fragment);
  }

  function applyContent(data) {
    if (!data || typeof data !== "object") return;
    const settings = data.settings && typeof data.settings === "object" ? data.settings : {};
    setText("heroKicker", settings.heroKicker);
    setText("heroTitle", settings.heroTitle);
    setText("heroSubtitleText", settings.heroSubtitle);
    setText("heroStrong", settings.heroStrong);
    setText("heroDescription", settings.heroDescription);
    setText("joinTitle", settings.joinTitle);
    setText("joinDescription", settings.joinDescription);
    setText("appStatus", settings.appStatus);

    renderNews(data.news);
    renderRoadmap(data.roadmap);
    renderWorldFlow(data.worldFlow);
    renderRealms(data.realms);
    renderSocial(data.social);
  }

  fetch(DATA_URL, { cache: "no-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(applyContent)
    .catch((error) => {
      console.warn("官網內容資料讀取失敗，保留內建文字。", error);
    });
})();
