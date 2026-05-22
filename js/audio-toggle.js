// ============================================
// AUDIO TOGGLE
// ============================================
// Plays a low-volume ambient loop and exposes a top-right pill button
// to mute/unmute it.
//
// Browser autoplay policy blocks unmuted audio.play() unless the page
// already has user gesture / media engagement. We try unmuted first —
// for returning visitors, allowlisted domains, and browsers with a
// permissive policy it just works. If the browser rejects the
// unmuted play, we fall back to muted playback and unmute on the first
// user gesture anywhere on the page.
//
// Exposes window.__audioOn so js/ui-sounds.js can silence the synth
// hover/click sounds when the user has muted everything.
(function () {
  const BG_VOLUME = 0.25;

  const audio = document.getElementById('bg-audio');
  const toggle = document.getElementById('audio-toggle');
  if (!audio || !toggle) return;
  // Swap the <use href> on the inline SVG icon. Inlined SVG replaced
  // the Tabler webfont; the icon symbols are defined at the top of body.
  const iconUse = toggle.querySelector('.ti use');

  audio.volume = BG_VOLUME;
  window.__audioOn = false;

  function syncUI() {
    if (iconUse) {
      iconUse.setAttribute('href', audio.muted ? '#ti-volume-off' : '#ti-volume');
    }
    toggle.setAttribute('aria-pressed', audio.muted ? 'false' : 'true');
    toggle.setAttribute(
      'aria-label',
      audio.muted ? 'Turn background audio on' : 'Turn background audio off',
    );
    window.__audioOn = !audio.muted;
  }

  let autoUnmuted = false;

  function startMutedFallback() {
    audio.muted = true;
    syncUI();
    audio.play().catch(() => {});

    function autoUnmute() {
      if (autoUnmuted) return;
      autoUnmuted = true;
      audio.muted = false;
      if (audio.paused) audio.play().catch(() => {});
      syncUI();
      window.removeEventListener('pointerdown', autoUnmute);
      window.removeEventListener('keydown', autoUnmute);
    }
    window.addEventListener('pointerdown', autoUnmute);
    window.addEventListener('keydown', autoUnmute);
  }

  // Try unmuted first. If the browser allows it (returning visitor,
  // high media engagement, allowlist, permissive policy), we're done.
  // Otherwise fall back to muted + first-gesture unmute.
  audio.muted = false;
  const tryUnmuted = audio.play();
  if (tryUnmuted && typeof tryUnmuted.then === 'function') {
    tryUnmuted.then(
      () => {
        autoUnmuted = true;
        syncUI();
      },
      () => {
        startMutedFallback();
      },
    );
  } else {
    // Older browsers — play() returned void. Assume it worked; if not,
    // the first toggle click recovers it.
    syncUI();
  }

  toggle.addEventListener('click', () => {
    autoUnmuted = true; // user took control; suppress auto-unmute
    audio.muted = !audio.muted;
    if (audio.paused) {
      audio.play().catch((e) => console.warn('audio play failed', e));
    }
    syncUI();
  });

  // Initial UI reflects the starting state (unmuted attempt).
  syncUI();
})();
