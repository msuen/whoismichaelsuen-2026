// ============================================
// PARALLAX SCROLL EFFECT
// ============================================
(function () {
  const layers = document.querySelectorAll('#parallax .parallax-layer');
  const hero = document.getElementById('parallax');
  const about = document.getElementById('about-layer');
  if (!layers.length || !hero) return;

  // Speed used to size the synthetic body height. = the about-layer's
  // data-speed (the slowest-rising "front" layer that the user must
  // scroll all the way through). At max scrollY, translate of about
  // equals contentHeight, so about's bottom reaches the viewport bottom.
  const ABOUT_SPEED = 0.8;

  let heroHeight = window.innerHeight;
  const heroTint = hero.querySelector('.hero-tint');

  function updateBodyHeight() {
    heroHeight = window.innerHeight;
    if (about) {
      const contentHeight = about.scrollHeight;
      document.body.style.height = (heroHeight + contentHeight / ABOUT_SPEED) + 'px';
    } else {
      document.body.style.height = heroHeight + 'px';
    }
  }
  updateBodyHeight();
  window.addEventListener('resize', updateBodyHeight);

  let pendingScroll = false;

  function onScroll() {
    if (pendingScroll) return;
    pendingScroll = true;
    requestAnimationFrame(applyScroll);
  }

  function applyScroll() {
    pendingScroll = false;
    const scrollY = window.scrollY;

    for (const layer of layers) {
      const speed = parseFloat(layer.dataset.speed) || 0;
      const baseOffset = parseFloat(layer.dataset.offsetY) || 0;
      const yOffset = baseOffset - (scrollY * speed);
      layer.style.transform = `translate3d(0, ${yOffset}px, 0)`;
    }

    // Fade the hero title as buildings rise into it.
    const header = hero.querySelector('header');
    if (header) {
      const fadeStart = heroHeight * 0.05;
      const fadeEnd   = heroHeight * 0.45;
      const opacity = scrollY <= fadeStart
        ? 1
        : scrollY >= fadeEnd
          ? 0
          : 1 - (scrollY - fadeStart) / (fadeEnd - fadeStart);
      header.style.opacity = opacity;
    }

    // Hide the (expensive) mix-blend-mode tint once it's no longer
    // visible — the about-layer covers everything past the hero.
    if (heroTint) {
      heroTint.style.display = scrollY > heroHeight ? 'none' : '';
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  // Run once synchronously so transforms (esp. the water layer's
  // data-offset-y) are committed before first paint.
  applyScroll();
})();

// ============================================
// FOREGROUND CHARACTER BREATHING (canvas redraw)
// ============================================
// Renders bg1@2x.png to a canvas, then on every frame re-blits a rectangle
// covering the character's head, shoulders, and upper torso a few pixels
// higher. The arm hanging down to his knee stays put — that's the part of
// the silhouette that wouldn't move when breathing anyway. Pixel
// coordinates are in the source image (1800x1125); the canvas is sized to
// match and CSS object-fit handles viewport scaling.
(function () {
  const canvas = document.getElementById('foreground-canvas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const img = new Image();
  img.decoding = 'async';

  // Two source rectangles, animated independently:
  //   The character has a long visible neck connecting head to body.
  //   Silhouette widths (sampled from source bg1@2x.png):
  //     y=720–795: 90–106 px wide  — HEAD (hair, ears, jaw)
  //     y=798–832: 70 → 12 px wide — NECK (tapers from chin to shoulder)
  //     y=834+:    widens to 80+   — BODY (t-shirt, shoulders, torso)
  //
  //   HEAD — entire head silhouette: hair + face + ears + chin/jaw
  //   curve all the way down to where the narrow neck column starts.
  //   Source y=660–825. Currently static (head tilt removed; see
  //   head-tilt-backup.html to reintroduce).
  //
  //   BODY — shoulders + upper t-shirt, source y=834–880. Top lands
  //   right where the silhouette widens out of the neck into the
  //   shoulder/t-shirt line. Stretched bottom-anchored.
  //
  //   The 9 px gap at y=825–834 is the narrow neck column. Not
  //   cleared, not animated — base image's neck pixels stay put.
  const HEAD        = { x: 820, y: 660, w: 180, h: 165 };
  const BODY        = { x: 740, y: 834, w: 320, h: 46 };
  const ERASE_HEAD  = { x: 740, y: 600, w: 320, h: 225 };  // y=600–825
  const ERASE_BODY  = { x: 740, y: 834, w: 320, h: 46 };   // y=834–880

  // Live-tunable state on window.__hero so the ?tune panel can edit it.
  const state = window.__hero || (window.__hero = {
    breath: { amp: 5, period: 3000 },
  });

  let startedAt = 0;
  let running = false;

  function drawStatic() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  }

  // Cache the about-layer reference once — querying every frame is cheap
  // but a closure lookup is cheaper.
  const aboutLayerEl = document.getElementById('about-layer');

  function frame(t) {
    if (!running) return;
    // Skip per-frame canvas redraws when the about-layer has fully
    // scrolled up to cover the hero — the canvas is occluded so there's
    // nothing visible to update.
    if (aboutLayerEl && aboutLayerEl.getBoundingClientRect().top <= 0) {
      requestAnimationFrame(frame);
      return;
    }
    if (!startedAt) startedAt = t;
    const elapsed = t - startedAt;

    // Breath: 0 → state.breath.amp → 0 over state.breath.period
    const breathPeriod = state.breath.period;
    const breathPhase = (elapsed % breathPeriod) / breathPeriod;
    const stretch = state.breath.amp * (1 - Math.cos(breathPhase * Math.PI * 2)) / 2;

    // Repaint from scratch every frame.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Wipe the head and shoulders regions so the static base pixels
    // don't ghost behind the animated copies. The 9 px gap between them
    // (the neck at y=825–834) is intentionally left intact — the base
    // image's neck pixels stay put while the body breathes.
    ctx.clearRect(ERASE_HEAD.x, ERASE_HEAD.y, ERASE_HEAD.w, ERASE_HEAD.h);
    ctx.clearRect(ERASE_BODY.x, ERASE_BODY.y, ERASE_BODY.w, ERASE_BODY.h);

    // BODY: bottom-anchored vertical stretch. Source height stays the
    // same; dest height grows by `stretch` and dest Y shifts up by the
    // same amount, so the chest cut line stays glued to its original Y.
    ctx.drawImage(
      img,
      BODY.x, BODY.y, BODY.w, BODY.h,
      BODY.x, BODY.y - stretch, BODY.w, BODY.h + stretch
    );

    // HEAD: static. Drawn at original position with no rotation.
    ctx.drawImage(
      img,
      HEAD.x, HEAD.y, HEAD.w, HEAD.h,
      HEAD.x, HEAD.y, HEAD.w, HEAD.h
    );

    requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    startedAt = 0;
    requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    drawStatic();
  }

  function onReady() {
    // Always paint the static composite first so the canvas has content
    // even before the first requestAnimationFrame fires (background tabs,
    // reduced-motion, slow paint).
    drawStatic();
    if (!reducedMotion.matches) start();
  }

  img.addEventListener('load', onReady, { once: true });
  img.addEventListener('error', (e) => console.warn('foreground-canvas: bg1 failed to load', e), { once: true });
  img.src = 'images/bg1@2x.png';
  if (img.complete && img.naturalWidth > 0) onReady();

  reducedMotion.addEventListener('change', (e) => {
    if (e.matches) stop();
    else start();
  });
})();

// ============================================
// SCROLL REVEAL (uses getBoundingClientRect since
// elements are inside a fixed parallax container
// where IntersectionObserver doesn't work)
// ============================================
(function () {
  const reveals = document.querySelectorAll('.scroll-reveal');
  if (!reveals.length) return;

  function checkReveals() {
    const viewH = window.innerHeight;
    for (const el of reveals) {
      if (el.classList.contains('revealed')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top < viewH - 40 && rect.bottom > 0) {
        el.classList.add('revealed');
      }
    }
  }

  window.addEventListener('scroll', checkReveals, { passive: true });
  checkReveals();
})();

// ============================================
// TYPED TEXT EFFECT
// ============================================
(function () {
  const target = document.getElementById('typed-target');
  if (!target) return;

  const words = [
    'build', 'experiment on', 'play with', 'laugh about',
    'contemplate', 'destroy', 'make', 'prototype',
    'brainstorm', 'riff on', 'sketch', 'launch', 'ship', 'kick off'
  ];

  let wordIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let timeout;

  function type() {
    const currentWord = words[wordIndex];

    if (isDeleting) {
      target.textContent = currentWord.substring(0, charIndex - 1);
      charIndex--;
    } else {
      target.textContent = currentWord.substring(0, charIndex + 1);
      charIndex++;
    }

    let delay = isDeleting ? 50 : 100;

    if (!isDeleting && charIndex === currentWord.length) {
      delay = 2000; // pause at full word
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      wordIndex = (wordIndex + 1) % words.length;
      delay = 400;
    }

    timeout = setTimeout(type, delay);
  }

  // Start after a short delay
  setTimeout(type, 1500);
})();

// ============================================
// APPLY AS A CLIENT — MODAL
// ============================================
(function () {
  const modal = document.getElementById('apply-modal');
  const form = document.getElementById('apply-form');
  if (!modal || !form) return;

  const openers = document.querySelectorAll('[data-open-apply-modal]');
  const closers = modal.querySelectorAll('[data-close-apply-modal]');
  let lastFocus = null;

  function open() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('apply-modal-open');
    const firstInput = form.querySelector('input, textarea');
    if (firstInput) firstInput.focus({ preventScroll: true });
  }

  function close() {
    modal.hidden = true;
    document.body.classList.remove('apply-modal-open');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  openers.forEach((btn) => btn.addEventListener('click', open));
  closers.forEach((el) => el.addEventListener('click', close));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });

  const submitBtn = form.querySelector('.apply-submit');
  const status = form.querySelector('.apply-status');

  function clearStatus() {
    if (!status) return;
    status.textContent = '';
    status.dataset.state = '';
  }

  // Reset to a fresh state every time the modal opens — otherwise the
  // success message would still be sitting in the row from last time.
  openers.forEach((btn) => btn.addEventListener('click', () => {
    clearStatus();
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send inquiry';
  }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    clearStatus();

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      if (!res.ok) {
        let detail = '';
        try {
          const body = await res.json();
          if (body && Array.isArray(body.errors)) {
            detail = body.errors.map((err) => err.message).join(', ');
          }
        } catch (_) {}
        throw new Error(detail || `Submission failed (${res.status})`);
      }
      // Success state: lock the form so the user can't double-submit,
      // and leave the "Inquiry sent. Thank you!" message in the button
      // row until they close the modal.
      if (status) {
        status.dataset.state = 'ok';
        status.textContent = 'Inquiry sent. Thank you!';
      }
      form.reset();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sent';
    } catch (err) {
      if (status) {
        status.dataset.state = 'error';
        status.textContent = `Couldn't send. Try emailing michael@weirdo.design directly.`;
      }
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
})();

// ============================================
// PORTFOLIO SWITCHER
// ============================================
(function () {
  const nav = document.getElementById('portfolio-nav');
  if (!nav) return;

  const buttons = nav.querySelectorAll('.portfolio-link');
  const descriptions = document.querySelectorAll('.portfolio-desc');

  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      const project = btn.dataset.project;

      // Update active button
      for (const b of buttons) b.classList.remove('active');
      btn.classList.add('active');

      // Show matching description
      for (const desc of descriptions) {
        desc.classList.toggle('hidden', desc.dataset.project !== project);
      }
    });
  }
})();
