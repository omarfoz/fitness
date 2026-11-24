/* Seamless, non-blocking navigation between real Fitness HTML pages.
 * Never show an overlay or gate navigation on background network activity.
 * Keep native links/back/forward and warm likely destinations quietly. */
(() => {
  'use strict';
  const ROUTES = new Set(['/', '/log.html', '/history.html', '/challenges.html', '/share.html']);
  try { sessionStorage.removeItem('fitness-page-transition'); } catch (_) {}

  // Previous app versions call hide() once Supabase has finished restoring
  // the session. They remain harmless no-ops: loading is always in background.
  const nothing = () => {};
  window.FitnessPageLoading = Object.freeze({ show: nothing, hide: nothing });

  const warmed = new Set();
  const warm = (href) => {
    if (!href) return;
    let url;
    try { url = new URL(href, location.href); } catch (_) { return; }
    if (url.origin !== location.origin || !ROUTES.has(url.pathname) ||
        url.pathname === location.pathname || warmed.has(url.pathname)) return;
    warmed.add(url.pathname);
    // HTML only, never private API responses or user data.
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'document';
    link.href = url.pathname;
    document.head.append(link);
  };
  const links = [...document.querySelectorAll('.bottom-tab[href], .page-nav-link[href]')];
  for (const link of links) {
    const warmLink = () => warm(link.href);
    link.addEventListener('pointerenter', warmLink, { once: true, passive: true });
    link.addEventListener('focus', warmLink, { once: true, passive: true });
    link.addEventListener('touchstart', warmLink, { once: true, passive: true });
  }

  // The current tab should never cause a full document reload when tapped.
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey ||
        event.metaKey || event.altKey || event.shiftKey) return;
    const link = event.target?.closest?.('a[href]');
    if (!link || link.target || link.hasAttribute('download')) return;
    let url;
    try { url = new URL(link.href, location.href); } catch (_) { return; }
    if (url.origin !== location.origin || !ROUTES.has(url.pathname)) return;
    if (url.pathname === location.pathname &&
        url.search === location.search &&
        url.hash === location.hash) {
      event.preventDefault();
      window.scrollTo?.({ top: 0, behavior: 'smooth' });
    }
    // On a different page: leave the native link entirely alone.
    // There is no full-screen spinner before or after navigation.
  });

  // Distribute low-priority prefetch after the page is interactive.
  const backgroundWarm = () => {
    let index = 0;
    const candidates = links.map(link => link.href);
    const step = () => {
      if (index >= candidates.length) return;
      warm(candidates[index++]);
      if (index < candidates.length) {
        if ('requestIdleCallback' in window)
          window.requestIdleCallback(step, { timeout: 1800 });
        else setTimeout(step, 650);
      }
    };
    if ('requestIdleCallback' in window)
      window.requestIdleCallback(step, { timeout: 2200 });
    else setTimeout(step, 1300);
  };
  if (document.readyState === 'complete') backgroundWarm();
  else window.addEventListener('load', backgroundWarm, { once: true });
})();

/* Stay on the latest version. GitHub Pages lets browsers keep HTML for up to
 * 10 minutes and the iPhone Home Screen app holds it longer, so after a
 * deploy people could see old pages. On open (and when the app comes back to
 * the foreground) compare this page's build with /version.json; if newer,
 * reload once through a cache-busting URL, then tidy the URL. */
(() => {
  'use strict';
  const meta = document.querySelector('meta[name="app-build"]');
  const mine = meta?.content || '';
  try {
    const u = new URL(location.href);
    if (u.searchParams.has('_b')) { u.searchParams.delete('_b'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); }
  } catch (_) {}
  let checking = false;
  const check = async () => {
    if (checking || !mine || !navigator.onLine) return;
    checking = true;
    try {
      const r = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const { build } = await r.json();
      if (!build || build === mine) return;
      const key = 'fitness-reloaded-for';
      if (sessionStorage.getItem(key) === build) return; // never loop
      sessionStorage.setItem(key, build);
      const u = new URL(location.href);
      u.searchParams.set('_b', build);
      location.replace(u.pathname + u.search + u.hash);
    } catch (_) { /* offline or blocked: keep the page as is */ }
    finally { checking = false; }
  };
  check();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) check(); });
})();
