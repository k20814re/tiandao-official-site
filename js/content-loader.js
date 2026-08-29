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

  const FEATURE_ICONS = [
    '<circle cx="32" cy="32" r="19"/><circle cx="32" cy="32" r="7"/><path d="M32 5v9M32 50v9M5 32h9M50 32h9M13 13l7 7M44 44l7 7M51 13l-7 7M20 44l-7 7"/>',
    '<path d="M32 55s17-16 17-31a17 17 0 1 0-34 0c0 15 17 31 17 31Z"/><circle cx="32" cy="24" r="6"/>',
    '<path d="m12 8 20 20-8 8L8 12l4-4ZM52 8 32 28l8 8 16-24-4-4ZM23 37 9 51l4 4 14-14M41 37l14 14-4 4-14-14"/>',
    '<circle cx="32" cy="22" r="9"/><circle cx="13" cy="28" r="6"/><circle cx="51" cy="28" r="6"/><path d="M15 52c0-10 7-16 17-16s17 6 17 16M4 51c0-7 4-12 11-13M60 51c0-7-4-12-11-13"/>',
    '<path d="M20 16c8 4 16 4 24 0l-5 10c9 7 14 17 14 27 0 5-9 7-21 7s-21-2-21-7c0-10 5-20 14-27l-5-10Z"/><path d="M24 16 20 8h9l3 6 3-6h9l-4 8M27 34h10M32 29v14"/>',
  ];

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

  function assetUrl(value) {
    const path = safeImagePath(value);
    return path ? new URL(path, document.baseURI).href : "";
  }

  function mediaType(value, fallback) {
    const path = safeImagePath(value).toLowerCase();
    if (path.endsWith(".webm")) return "video/webm";
    if (path.endsWith(".ogg") || path.endsWith(".ogv")) return "video/ogg";
    if (path.endsWith(".mp3")) return "audio/mpeg";
    if (path.endsWith(".wav")) return "audio/wav";
    if (path.endsWith(".m4a")) return "audio/mp4";
    if (path.endsWith(".mp4")) return "video/mp4";
    return fallback;
  }

  function setAttribute(id, name, value) {
    const element = byId(id);
    if (element && typeof value === "string" && value.trim()) {
      element.setAttribute(name, value.trim());
    }
  }

  function setImage(id, value, fallback = "") {
    const element = byId(id);
    if (!element) return;
    const path = safeImagePath(value) || fallback;
    if (path) element.src = path;
  }

  function setMediaSource(source, value, fallbackType) {
    if (!source) return;
    const path = safeImagePath(value);
    if (path) {
      source.src = path;
      source.type = mediaType(path, fallbackType);
    } else {
      source.removeAttribute("src");
      source.removeAttribute("type");
    }
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
      image.alt = typeof item.title === "string" ? item.title.trim() : "";

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

  function renderSectTags(items) {
    const container = byId("sectTags");
    if (!container || !Array.isArray(items) || !items.length) return;

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      if (!item || typeof item.name !== "string" || !item.name.trim()) return;
      const tag = document.createElement("li");
      tag.textContent = item.name.trim();
      fragment.appendChild(tag);
    });
    if (fragment.childNodes.length) container.replaceChildren(fragment);
  }

  function renderMapItems(items) {
    const container = byId("mapItems");
    if (!container || !Array.isArray(items) || !items.length) return;

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      if (!item || typeof item.name !== "string" || !item.name.trim()) return;
      const place = document.createElement("li");
      place.textContent = item.name.trim();
      fragment.appendChild(place);
    });
    if (fragment.childNodes.length) container.replaceChildren(fragment);
  }

  function renderFeatures(items) {
    const container = byId("featuresGrid");
    if (!container || !Array.isArray(items) || !items.length) return;

    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => {
      if (!item || typeof item.title !== "string" || !item.title.trim()) return;
      const card = document.createElement("article");
      card.className = "feature-card reveal visible";
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("viewBox", "0 0 64 64");
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = FEATURE_ICONS[index % FEATURE_ICONS.length];
      const title = document.createElement("h3");
      title.textContent = item.title.trim();
      const description = document.createElement("p");
      description.textContent = typeof item.description === "string" ? item.description.trim() : "";
      card.append(icon, title, description);
      fragment.appendChild(card);
    });

    if (fragment.childNodes.length) container.replaceChildren(fragment);
  }

  function renderAppTags(items) {
    const container = byId("appTags");
    if (!container || !Array.isArray(items) || !items.length) return;

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      if (!item || typeof item.name !== "string" || !item.name.trim()) return;
      const tag = document.createElement("span");
      tag.textContent = item.name.trim();
      fragment.appendChild(tag);
    });
    if (fragment.childNodes.length) container.replaceChildren(fragment);
  }

  function renderGallery(items) {
    const container = byId("galleryGrid");
    if (!container || !Array.isArray(items) || !items.length) return;

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      if (!item || !safeImagePath(item.image)) return;
      const figure = document.createElement("figure");
      if (String(item.layout).toLowerCase() === "wide") figure.className = "gallery-wide";
      const image = document.createElement("img");
      image.src = safeImagePath(item.image);
      image.alt = typeof item.alt === "string" ? item.alt.trim() : "";
      const caption = document.createElement("figcaption");
      caption.textContent = typeof item.caption === "string" ? item.caption.trim() : "";
      figure.append(image, caption);
      fragment.appendChild(figure);
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

  function applyText(text) {
    if (!text || typeof text !== "object") return;
    const bindings = {
      brandNameHeader: "brandName",
      brandNameJoin: "brandName",
      brandNameFooter: "brandName",
      brandTaglineHeader: "brandTagline",
      brandTaglineJoin: "brandTagline",
      brandTaglineFooter: "brandTagline",
      navHome: "navHome",
      navFeatures: "navFeatures",
      navWorld: "navWorld",
      navNews: "navNews",
      navRoadmap: "navRoadmap",
      navDownload: "navDownload",
      navCommunity: "navCommunity",
      navStudio: "navStudio",
      headerCta: "headerCta",
      heroTagline: "heroTagline",
      heroButton: "heroButton",
      videoToggleLabel: "videoPauseLabel",
      featuresTitle: "featuresTitle",
      newsTitle: "newsTitle",
      newsViewAll: "newsViewAll",
      trailerSectionTitle: "trailerTitle",
      trailerKicker: "trailerKicker",
      trailerTime: "trailerTime",
      galleryKicker: "galleryKicker",
      galleryTitle: "galleryTitle",
      roadmapKicker: "roadmapKicker",
      roadmapTitle: "roadmapTitle",
      roadmapSubtitle: "roadmapSubtitle",
      appKicker: "appKicker",
      appTitle: "appTitle",
      appDescription: "appDescription",
      studioKicker: "studioKicker",
      studioTitle: "studioTitle",
      studioDescription: "studioDescription",
      studioButton: "studioButton",
      communityTitle: "communityTitle",
      communityDescription: "communityDescription",
      joinButton: "joinButton",
      statsKicker: "statsKicker",
      statsTitle: "statsTitle",
      visitorLabel: "visitorLabel",
      visitorDescription: "visitorDescription",
      onlineLabel: "onlineLabel",
      onlineDescription: "onlineDescription",
      audioButtonLabel: "audioButton",
      trailerModalKicker: "trailerModalKicker",
      trailerModalTitle: "trailerModalTitle",
      trailerModalDescription: "trailerModalDescription",
      footerFeatures: "navFeatures",
      footerWorld: "navWorld",
      footerNews: "navNews",
      footerBrand: "brandLinkLabel",
      footerCredits: "creditsLabel",
      footerPrivacy: "privacyLabel",
      footerTerms: "termsLabel",
      footerRights: "footerRights",
      footerNote: "footerNote",
    };

    Object.entries(bindings).forEach(([id, key]) => setText(id, text[key]));
    setAttribute("brandLinkHeader", "aria-label", text.brandHomeLabel);
    setAttribute("menuButton", "aria-label", text.menuLabel);
    setAttribute("trailerButton", "aria-label", text.trailerButtonLabel);
    setAttribute("modalClose", "aria-label", text.modalCloseLabel);
    setText("noscriptNotice", text.noscriptNotice);
    const status = byId("statsStatus");
    if (status) {
      status.dataset.loading = text.statsLoading || "正在感應諸天來客……";
      status.dataset.ready = text.statsReady || "天機連線正常 · 人數即時更新";
      status.dataset.disconnected = text.statsDisconnected || "天機連線暫時中斷，正在重新感應……";
      status.dataset.databaseMissing = text.statsDatabaseMissing || "統計資料庫尚未啟用";
      status.dataset.error = text.statsError || "人數統計暫時無法連線";
    }
    setAttribute("trailerPoster", "alt", text.trailerPosterAlt);
    setAttribute("trailerModalPoster", "alt", text.trailerPosterAlt);
    setAttribute("appIcon", "alt", text.appIconAlt);
    setAttribute("studioArt", "alt", text.studioArtAlt);
    setAttribute("visitorCount", "aria-label", text.visitorLabel);
    setAttribute("onlineCount", "aria-label", text.onlineLabel);

    const audioButton = byId("audioToggle");
    if (audioButton) {
      audioButton.dataset.playingLabel = text.audioPlaying || "仙樂播放中";
      audioButton.dataset.defaultLabel = text.audioButton || "開啟仙樂";
      audioButton.dataset.missingLabel = text.audioMissing || "請放入音樂檔案";
    }
    const videoButton = byId("videoToggle");
    if (videoButton) {
      videoButton.dataset.pauseLabel = text.videoPauseLabel || "暫停背景";
      videoButton.dataset.playLabel = text.videoPlayLabel || "播放背景";
    }
  }

  function applyMeta(text) {
    if (!text || typeof text !== "object") return;
    if (typeof text.pageTitle === "string" && text.pageTitle.trim()) document.title = text.pageTitle.trim();
    const description = document.querySelector('meta[name="description"]');
    if (description && typeof text.pageDescription === "string" && text.pageDescription.trim()) {
      description.content = text.pageDescription.trim();
    }
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && typeof text.ogTitle === "string" && text.ogTitle.trim()) ogTitle.content = text.ogTitle.trim();
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription && typeof text.ogDescription === "string" && text.ogDescription.trim()) {
      ogDescription.content = text.ogDescription.trim();
    }
    if (typeof text.pageVersion === "string" && text.pageVersion.trim()) {
      setAttribute("pageVersionMeta", "content", text.pageVersion);
    }
  }

  function applyMedia(media) {
    if (!media || typeof media !== "object") return;

    const heroVideo = byId("heroVideo");
    const heroSource = byId("heroVideoSource");
    const heroPoster = safeImagePath(media.heroPoster);
    if (heroVideo) {
      if (heroPoster) heroVideo.poster = heroPoster;
      setMediaSource(heroSource, media.heroVideo, "video/mp4");
      heroVideo.hidden = !safeImagePath(media.heroVideo);
      if (!heroVideo.hidden) heroVideo.load();
    }
    const heroImage = byId("heroImage");
    if (heroImage && heroPoster) heroImage.style.backgroundImage = `url("${heroPoster}")`;

    const joinBackground = safeImagePath(media.joinBackground);
    const joinSection = byId("join");
    if (joinSection && joinBackground) {
      joinSection.style.backgroundImage = `linear-gradient(rgba(6,10,14,.75), rgba(6,10,14,.92)), url("${joinBackground}")`;
    }

    setImage("trailerPoster", media.trailerPoster, "assets/images/trailer-poster.webp");
    setImage("trailerModalPoster", media.trailerPoster, "assets/images/trailer-poster.webp");
    const trailerVideo = byId("trailerVideo");
    const trailerSource = byId("trailerVideoSource");
    const trailerPath = safeImagePath(media.trailerVideo);
    const trailerModalPoster = byId("trailerModalPoster");
    if (trailerModalPoster) trailerModalPoster.hidden = Boolean(trailerPath);
    if (trailerVideo) {
      setMediaSource(trailerSource, trailerPath, "video/mp4");
      trailerVideo.hidden = !trailerPath;
      if (trailerPath) trailerVideo.load();
    }

    setImage("appIcon", media.appIcon, "assets/images/app-icon-v8.png");
    setImage("studioArt", media.studioArt, "assets/images/ck-studio-sketch.webp");

    const audio = byId("themeAudio");
    const musicPath = safeImagePath(media.themeMusic);
    if (audio) {
      audio.dataset.configured = musicPath ? "true" : "false";
      if (musicPath) {
        audio.src = musicPath;
        audio.load();
      } else {
        audio.removeAttribute("src");
        audio.load();
      }
    }

    const favicon = document.querySelector('link[rel="icon"]');
    const faviconPath = safeImagePath(media.favicon);
    if (favicon && faviconPath) favicon.href = faviconPath;

    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage && heroPoster) ogImage.content = assetUrl(heroPoster);
  }

  function applyContent(data) {
    if (!data || typeof data !== "object") return;
    const settings = data.settings && typeof data.settings === "object" ? data.settings : {};
    const world = data.world && typeof data.world === "object" ? data.world : {};
    const realm = world.realm && typeof world.realm === "object" ? world.realm : {};
    const sect = world.sect && typeof world.sect === "object" ? world.sect : {};
    const map = world.map && typeof world.map === "object" ? world.map : {};
    applyText(data.text);
    applyMeta(data.text);
    applyMedia(data.media);
    setText("heroKicker", settings.heroKicker);
    setText("heroTitle", settings.heroTitle);
    setText("heroSubtitleText", settings.heroSubtitle);
    setText("heroStrong", settings.heroStrong);
    setText("heroDescription", settings.heroDescription);
    setText("joinTitle", settings.joinTitle);
    setText("joinDescription", settings.joinDescription);
    setText("appStatus", settings.appStatus);

    setText("worldKicker", world.kicker);
    setText("worldTitle", world.title);
    setText("worldSubtitle", world.subtitle);
    setText("realmLabel", realm.label);
    setText("realmTitle", realm.title);
    setText("realmDescription", realm.description);
    setText("sectLabel", sect.label);
    setText("sectTitle", sect.title);
    setText("sectDescription", sect.description);
    setText("mapLabel", map.label);
    setText("mapTitle", map.title);
    setText("mapDescription", map.description);

    renderNews(data.news);
    renderRoadmap(data.roadmap);
    renderWorldFlow(data.worldFlow);
    renderRealms(data.realms);
    renderSectTags(data.sectTags);
    renderMapItems(data.mapItems);
    renderFeatures(data.features);
    renderAppTags(data.appTags);
    renderGallery(data.gallery);
    renderSocial(data.social);
    document.dispatchEvent(new CustomEvent("tiandao-content-ready"));
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
