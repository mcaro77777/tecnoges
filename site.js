(() => {
  'use strict';

  const root = document.documentElement;
  const themeButton = document.querySelector('.theme-toggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.getElementById('navigation');
  const header = document.querySelector('.site-header');
  const year = document.getElementById('year');
  const dialog = document.getElementById('sofia-dialog');
  const video = document.getElementById('sofia-video');
  const transcript = document.getElementById('sofia-transcript');
  const floatingWhatsApp = document.querySelector('.floating-whatsapp');
  const primaryWhatsApp = document.querySelector('.hero-actions .button-whatsapp');
  let dialogTrigger = null;

  const setTheme = (theme, persist = true) => {
    const isDark = theme === 'dark';
    root.dataset.theme = isDark ? 'dark' : 'light';
    if (themeButton) {
      themeButton.setAttribute('aria-pressed', String(isDark));
      themeButton.setAttribute('aria-label', isDark ? 'Activar modo claro' : 'Activar modo oscuro');
    }
    if (themeMeta) themeMeta.setAttribute('content', isDark ? '#08090b' : '#f7f7f9');
    if (persist) {
      try { localStorage.setItem('msst-theme', isDark ? 'dark' : 'light'); } catch (_) { /* storage may be disabled */ }
    }
  };

  setTheme(root.dataset.theme, false);
  themeButton?.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));

  const closeMenu = (returnFocus = false) => {
    if (!navigation || !menuButton) return;
    navigation.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Abrir menú');
    if (returnFocus) menuButton.focus();
  };

  menuButton?.addEventListener('click', () => {
    if (!navigation) return;
    const open = !navigation.classList.contains('open');
    navigation.classList.toggle('open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  });
  navigation?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => closeMenu()));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navigation?.classList.contains('open')) closeMenu(true);
  });

  const updateHeader = () => header?.classList.toggle('scrolled', window.scrollY > 12);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
  if (year) year.textContent = String(new Date().getFullYear());

  if (floatingWhatsApp && primaryWhatsApp && 'IntersectionObserver' in window) {
    const setFloatingWhatsAppVisibility = (suppressed) => {
      floatingWhatsApp.classList.toggle('is-suppressed', suppressed);
      floatingWhatsApp.setAttribute('aria-hidden', String(suppressed));
      if (suppressed) floatingWhatsApp.setAttribute('tabindex', '-1');
      else floatingWhatsApp.removeAttribute('tabindex');
    };
    const whatsappObserver = new IntersectionObserver(([entry]) => {
      setFloatingWhatsAppVisibility(entry.isIntersecting);
    }, { threshold: 0.65 });
    whatsappObserver.observe(primaryWhatsApp);
  }

  const videoSources = {
    webm: dialog?.dataset.videoWebm || '',
    mp4: dialog?.dataset.videoMp4 || ''
  };
  let videoPrepared = false;

  const prepareVideo = () => {
    if (!video || videoPrepared || (!videoSources.webm && !videoSources.mp4)) return false;
    const revealVideo = () => {
      video.hidden = false;
      if (transcript) transcript.hidden = true;
    };
    const restoreTranscript = () => {
      video.hidden = true;
      if (transcript) transcript.hidden = false;
    };
    video.addEventListener('loadedmetadata', revealVideo, { once: true });
    video.addEventListener('canplay', revealVideo, { once: true });
    video.addEventListener('error', restoreTranscript, { once: true });
    if (videoSources.webm) {
      const source = document.createElement('source');
      source.src = videoSources.webm;
      source.type = 'video/webm';
      video.append(source);
    }
    if (videoSources.mp4) {
      const source = document.createElement('source');
      source.src = videoSources.mp4;
      source.type = 'video/mp4';
      video.append(source);
    }
    video.load();
    videoPrepared = true;
    return true;
  };

  const openSofia = (trigger) => {
    if (!dialog || typeof dialog.showModal !== 'function') return;
    dialogTrigger = trigger;
    prepareVideo();
    dialog.showModal();
    dialog.querySelector('[data-close-sofia]')?.focus();
  };

  const closeSofia = () => {
    if (!dialog?.open) return;
    video?.pause();
    dialog.close();
  };

  document.querySelectorAll('[data-open-sofia]').forEach((button) => {
    button.addEventListener('click', () => openSofia(button));
  });
  dialog?.querySelectorAll('[data-close-sofia]').forEach((control) => {
    control.addEventListener('click', closeSofia);
  });
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) closeSofia();
  });
  dialog?.addEventListener('close', () => {
    video?.pause();
    dialogTrigger?.focus();
  });

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealItems = [...document.querySelectorAll('.reveal')];
  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealItems.forEach((item) => observer.observe(item));
  }
})();
