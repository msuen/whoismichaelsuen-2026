// ============================================
// AUDIO TOGGLE
// ============================================
// Plays a low-volume ambient loop and exposes a top-right pill button
// to mute/unmute it.
//
// Browser autoplay policy blocks audio with sound unless the user has
// interacted with the page first. So the loop is started MUTED (which is
// always allowed) and the toggle button unmutes it on click — the click
// itself counts as the interaction that satisfies the policy.
(function () {
  const BG_VOLUME = 0.25;

  const audio = document.getElementById('bg-audio');
  const toggle = document.getElementById('audio-toggle');
  if (!audio || !toggle) return;
  const icon = toggle.querySelector('.ti');

  audio.volume = BG_VOLUME;
  audio.muted = true;

  // Reflect current mute state in the icon glyph + ARIA.
  function syncUI() {
    if (icon) {
      icon.classList.toggle('ti-volume', !audio.muted);
      icon.classList.toggle('ti-volume-off', audio.muted);
    }
    toggle.setAttribute('aria-pressed', audio.muted ? 'false' : 'true');
    toggle.setAttribute(
      'aria-label',
      audio.muted ? 'Turn background audio on' : 'Turn background audio off',
    );
  }

  // Start the loop muted so it satisfies autoplay rules. Ignore failures
  // (some browsers still reject; the click handler will start it then).
  audio.play().catch(() => {});

  toggle.addEventListener('click', () => {
    audio.muted = !audio.muted;
    if (audio.paused) {
      audio.play().catch((e) => console.warn('audio play failed', e));
    }
    syncUI();
  });

  syncUI();
})();
