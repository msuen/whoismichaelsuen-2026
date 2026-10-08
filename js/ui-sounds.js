// ============================================
// UI SOUNDS (hover + click)
// ============================================
// Synthesizes tactile, subtle hover and click sounds via the Web Audio
// API. No audio files — everything is a short oscillator + envelope.
//
// Audio is explicitly opt-in. The shared audio toggle unlocks
// the context; ordinary scene interaction never turns sound on. Hover,
// click and soft character syllables all respect window.__audioOn.
(function () {
  const SELECTOR = '.link-pill, .apply-modal__close, .apply-submit, .apply-cancel, .encounter-trigger, .encounter-choice, .encounter-answer-link';
  const HOVER_THROTTLE_MS = 120;

  let ctx = null;
  let lastHover = 0;
  let lastVoice = 0;
  let voiceIndex = 0;
  const voices = new Set();
  const AMBIENCE_LEVEL = .25;
  let ambience = null;

  // Route once after opt-in. Music stays at one steady level, including
  // where mobile browsers ignore HTMLMediaElement.volume adjustments.
  function attachAmbience(audio) {
    if (ambience) return ambience.audio === audio;
    const ac = ensureCtx();
    if (!ac) return false;
    try {
      const source = ac.createMediaElementSource(audio);
      const gain = ac.createGain();
      gain.gain.value = AMBIENCE_LEVEL;
      source.connect(gain).connect(ac.destination);
      ambience = { audio, source, gain };
      audio.volume = 1;
      return true;
    } catch { return false; }
  }

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  function audible() {
    return window.__audioOn === true;
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

  // Warm, low-pitched syllables rather than a recording or voice clone.
  function playVoice() {
    if (!audible() || document.hidden) return;
    const now = performance.now();
    if (now - lastVoice < 90) return;
    lastVoice = now;
    const ac = ensureCtx();
    if (!ac || ac.state !== 'running') return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    osc.type = 'triangle';
    const pitch = 180 + (voiceIndex++ * 29 % 75);
    osc.frequency.setValueAtTime(pitch, t);
    osc.frequency.exponentialRampToValueAtTime(pitch * .88, t + .045);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(680, t);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(.35, t + .004);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .05);
    osc.connect(filter).connect(gain).connect(ac.destination);
    voices.add(osc);
    osc.onended = () => { voices.delete(osc); osc.disconnect(); filter.disconnect(); gain.disconnect(); };
    osc.start(t);
    osc.stop(t + .055);
  }

  function stopVoice() {
    for (const osc of voices) {
      try { osc.stop(); } catch { /* Already ended. */ }
    }
    voices.clear();
  }

  // Called by the audio button, or a later gesture after opt-in.
  function unlock(explicitConsent = false) {
    if (!audible() && explicitConsent !== true) return;
    const ac = ensureCtx();
    if (ac && ac.state === 'suspended') ac.resume();
  }
  window.__encounterVoice = {
    unlock, syllable: playVoice, stop: stopVoice, attachAmbience,
    get musicMix() { return ambience ? { routed: true, level: ambience.gain.gain.value } : { routed: false }; },
  };
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
