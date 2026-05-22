// ============================================
// UI SOUNDS (hover + click)
// ============================================
// Synthesizes tactile, subtle hover and click sounds via the Web Audio
// API. No audio files — everything is a short oscillator + envelope.
//
// AudioContext can only start after a user gesture (browser policy), so
// the context is created lazily on the first pointerdown/keydown
// anywhere. The same first gesture also unmutes the background audio
// loop owned by audio-toggle.js, which is how we get "audio on by
// default" without violating autoplay rules.
//
// UI sounds respect the audio toggle: when the bg loop is muted, hover
// and click sounds are silent too. State is shared via window.__audioOn.
(function () {
  const SELECTOR = '.link-pill, .apply-modal__close, .apply-submit, .apply-cancel';
  const HOVER_THROTTLE_MS = 120;

  let ctx = null;
  let lastHover = 0;

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  function audible() {
    // Default to on; audio-toggle.js flips this on mute.
    return window.__audioOn !== false;
  }

  function playHover() {
    if (!audible()) return;
    const now = performance.now();
    if (now - lastHover < HOVER_THROTTLE_MS) return;
    lastHover = now;

    const ac = ensureCtx();
    if (!ac || ac.state === 'suspended') return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  function playClick() {
    if (!audible()) return;
    const ac = ensureCtx();
    if (!ac || ac.state === 'suspended') return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.08);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  // Unlock AudioContext on the first user gesture. Pointerdown covers
  // mouse/touch/pen; keydown covers keyboard-only users.
  function unlock() {
    const ac = ensureCtx();
    if (ac && ac.state === 'suspended') ac.resume();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  }
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });

  // Delegate hover via pointerover with relatedTarget guard so we only
  // fire when the pointer transitions INTO a fresh interactive element
  // (not when moving across child spans within the same pill).
  document.addEventListener('pointerover', (e) => {
    const target = e.target.closest(SELECTOR);
    if (!target) return;
    const from = e.relatedTarget && e.relatedTarget.closest
      ? e.relatedTarget.closest(SELECTOR)
      : null;
    if (from === target) return;
    playHover();
  });

  // Click event fires on both mouse activation and keyboard (Enter /
  // Space), so this stays accessible without separate keydown handling.
  document.addEventListener('click', (e) => {
    if (e.target.closest(SELECTOR)) playClick();
  });
})();
