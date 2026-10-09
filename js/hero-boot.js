/* Hold the native sunset until the visitor-local palette and canvases paint. */
(() => {
  const root = document.documentElement;
  const parts = { palette: false, foreground: false, water: false, fonts: false };
  let released = false;
  let scheduled = false;
  let fallbackTimer;
  function reveal(reason = 'ready') {
    if (released) return;
    released = true;
    clearTimeout(fallbackTimer);
    window.__sceneBoot.state = reason;
    const hero = document.getElementById('parallax');
    if (hero) hero.inert = false;
    root.classList.remove('hero-booting');
    const loader = document.getElementById('scene-loader');
    if (loader) {
      loader.setAttribute('aria-hidden', 'true');
      const done = () => { loader.hidden = true; };
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
      else loader.addEventListener('transitionend', done, { once: true });
    }
  }
  window.__sceneBoot = {
    state: 'loading', parts,
    mark(part, state = 'ready') {
      if (!(part in parts) || released) return;
      parts[part] = state;
      if (!scheduled && Object.values(parts).every(Boolean)) {
        scheduled = true;
        window.__timeForegroundRedraw?.();
        window.__timeWaterRedraw?.(true);
        requestAnimationFrame(() => requestAnimationFrame(() => reveal(
          Object.values(parts).includes('fallback') ? 'fallback' : 'ready'
        )));
      }
    }
  };
  // Fail open for a missing critical script/image; never impose a minimum delay.
  fallbackTimer = setTimeout(() => reveal('timeout-fallback'), 12000);
  document.addEventListener('DOMContentLoaded', () => {
    const hero = document.getElementById('parallax');
    if (hero && !released) hero.inert = true;
    document.fonts.ready
      .then(() => window.__sceneBoot.mark('fonts'))
      .catch(() => window.__sceneBoot.mark('fonts', 'fallback'));
  });
})();
