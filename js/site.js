(() => {
  const menu = document.querySelector('.menu-button');
  const nav = document.querySelector('nav');
  const closeMenu = () => { nav?.classList.remove('open'); menu?.setAttribute('aria-expanded', 'false'); };
  menu?.addEventListener('click', () => {
    const open = nav?.classList.toggle('open') ?? false;
    menu.setAttribute('aria-expanded', String(open));
  });
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('click', event => {
    if (nav?.classList.contains('open') && !nav.contains(event.target) && !menu?.contains(event.target)) closeMenu();
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 980) closeMenu(); });

  const video = document.querySelector('.hero-video');
  const videoButton = document.querySelector('#videoToggle');
  video?.addEventListener('error', () => { video.hidden = true; }, { once: true });
  videoButton?.addEventListener('click', e => {
    if (!video || video.hidden) return;
    const button = e.currentTarget;
    const pauseLabel = button.dataset.pauseLabel || '暫停背景';
    const playLabel = button.dataset.playLabel || '播放背景';
    const label = button.querySelector('span');
    if (video.paused) {
      video.play().catch(() => {});
      if (label) label.textContent = pauseLabel;
    } else {
      video.pause();
      if (label) label.textContent = playLabel;
    }
  });

  const audio = document.querySelector('#themeAudio');
  const audioButton = document.querySelector('#audioToggle');
  const audioLabel = audioButton?.querySelector('span:last-child');
  const soundBars = audioButton?.querySelector('.sound-bars');
  const audioMissingLabel = () => audioButton?.dataset.missingLabel || '請放入音樂檔案';
  const audioDefaultLabel = () => audioButton?.dataset.defaultLabel || '開啟仙樂';
  const audioPlayingLabel = () => audioButton?.dataset.playingLabel || '仙樂播放中';
  audio?.addEventListener('error', () => { if (audioLabel) audioLabel.textContent = audioMissingLabel(); });
  audioButton?.addEventListener('click', async () => {
    if (!audio) return;
    try {
      if (audio.paused) {
        await audio.play();
        if (audioLabel) audioLabel.textContent = audioPlayingLabel();
        soundBars?.classList.add('playing');
        audioButton.setAttribute('aria-pressed', 'true');
      } else {
        audio.pause();
        if (audioLabel) audioLabel.textContent = audioDefaultLabel();
        soundBars?.classList.remove('playing');
        audioButton.setAttribute('aria-pressed', 'false');
      }
    } catch { if (audioLabel) audioLabel.textContent = audioMissingLabel(); }
  });

  const modal = document.querySelector('#trailerModal');
  const modalDialog = modal?.querySelector('.trailer-modal');
  const trailerVideo = document.querySelector('#trailerVideo');
  const lastFocused = { element: null };
  const setModal = open => {
    if (!modal) return;
    modal.hidden = !open;
    modal.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('modal-open', open);
    if (open) {
      lastFocused.element = document.activeElement;
      document.querySelector('#modalClose')?.focus();
      if (trailerVideo && !trailerVideo.hidden) trailerVideo.play().catch(() => {});
    } else if (lastFocused.element instanceof HTMLElement) {
      trailerVideo?.pause();
      if (trailerVideo) trailerVideo.currentTime = 0;
      lastFocused.element.focus();
    }
  };
  document.querySelector('#trailerButton')?.addEventListener('click', () => setModal(true));
  document.querySelector('#modalClose')?.addEventListener('click', () => setModal(false));
  modal?.addEventListener('click', event => { if (event.target === modal) setModal(false); });
  document.addEventListener('keydown', event => {
    if (!modal || modal.hidden) return;
    if (event.key === 'Escape') setModal(false);
    if (event.key === 'Tab' && modalDialog) {
      const focusable = [...modalDialog.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => !el.hasAttribute('disabled'));
      if (focusable.length < 2) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    }), { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(element => revealObserver.observe(element));
  } else document.querySelectorAll('.reveal').forEach(element => element.classList.add('visible'));

  const navLinks = [...document.querySelectorAll('nav a[href^="#"]')];
  const sections = navLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const activeObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
    }), { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
    sections.forEach(section => activeObserver.observe(section));
  }
})();
