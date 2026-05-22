// ============================================
// AUDIO TOGGLE
// ============================================
// Plays a low-volume ambient loop and exposes a top-right pill button
// to mute/unmute it.
//
// Browser autoplay policy blocks audio with sound unless the user has
// interacted with the page first. The loop is started MUTED (always
// allowed), then unmuted on the FIRST user gesture anywhere — that's
// our "audio on by default" behavior within what the browser permits.
// The toggle button stays available for the user to mute/unmute later.
//
// Exposes window.__audioOn so js/ui-sounds.js can silence the synth
// hover/click sounds when the user has muted everything.
(function () {
  const BG_VOLUME = 0.25;

  const audio = document.getElementById('bg-audio');
  const toggle = document.getElementById('audio-toggle');
  if (!audio || !toggle) return;
  const icon = toggle.querySelector('.ti');

  audio.volume = BG_VOLUME;
  audio.muted = true;
  window.__audioOn = false;

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
    window.__audioOn = !audio.muted;
  }

  // Kick off the loop muted so autoplay accepts it. If even muted
  // playback is rejected, the first-gesture handler below will retry.
  audio.play().catch(() => {});

  // First user gesture anywhere unmutes — equivalent to "audio on by
  // default" within autoplay rules. Auto-unmute only fires once; from
  // then on the toggle is the sole control.
  let autoUnmuted = false;
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

  toggle.addEventListener('click', () => {
    autoUnmuted = true; // user took control; suppress auto-unmute
    audio.muted = !audio.muted;
    if (audio.paused) {
      audio.play().catch((e) => console.warn('audio play failed', e));
    }
    syncUI();
  });

  syncUI();
})();
