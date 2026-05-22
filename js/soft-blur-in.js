// ============================================
// SOFT BLUR IN — text reveal
// ============================================
// Implements pixel-point/animate-text "soft-blur-in" (Apple keynote-style
// per-character fade with gentle upward motion and blur).
//
// Source spec: .agents/skills/animate-text/assets/effects/soft-blur-in.json
// Showcase (site-scaled) values used here:
//   enter duration:   648 ms   (900 × runtime speed_multiplier 0.72)
//   enter stagger:    18 ms    (25 × 0.72)
//   enter y travel:   9.28 px  (16 × y_travel_multiplier 0.58)
//   enter blur:       12 px → 0
//   easing:           cubic-bezier(0.22, 1, 0.36, 1)
//   initial delay:    random 0–400 ms
//
// Apply to any text element with data-animate="soft-blur-in". Each element
// animates the FIRST time it enters the viewport. The target unit (per
// character / per word) is chosen automatically by text length, or set
// explicitly with data-blur-target="per-character" | "per-word".
//
// Inline children (links, buttons, <strong>, etc.) inside the target are
// preserved — only text nodes get split into <span class="sbi-unit"> wraps,
// so clickable hit areas survive the split.
//
// Visibility detection uses getBoundingClientRect rather than
// IntersectionObserver because every animated block sits inside a fixed-
// position parallax parent, where IntersectionObserver reports stale rects.
(function () {
  const ENTER_DURATION_MS = 1400;   // per-unit reveal duration (slower for quiet entrance)
  const ENTER_STAGGER_MS  = 28;     // delay between consecutive units
  const Y_TRAVEL_PX       = 9.28;
  const BLUR_PX           = 12;
  const EASING            = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const PER_CHAR_MAX_LEN  = 30;   // text length cutoff for per-char vs per-word
  const VIEWPORT_MARGIN   = 40;   // px before the bottom edge to trigger

  const FROM_TRANSFORM = `translate3d(0, ${Y_TRAVEL_PX}px, 0)`;
  const FROM_FILTER    = `blur(${BLUR_PX}px)`;
  const TO_TRANSFORM   = 'translate3d(0, 0, 0)';
  const TO_FILTER      = 'blur(0px)';

  const UNIT_STYLE = {
    display: 'inline-block',
    whiteSpace: 'pre',
    backfaceVisibility: 'hidden',
    transformOrigin: '50% 55%',
    willChange: 'transform, opacity, filter',
    opacity: '0',
    transform: FROM_TRANSFORM,
    filter: FROM_FILTER,
  };

  // FIFO queue end timestamp — when the currently-playing animation will
  // finish. Newly-triggered blocks wait until this point so they never
  // overlap (a scroll that exposes several blocks at once reveals them
  // one after another instead of all at once).
  let queueEndsAt = 0;

  async function init() {
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }
    document.querySelectorAll('[data-animate="soft-blur-in"]').forEach(prepare);
    checkVisibility();
    window.addEventListener('scroll', checkVisibility, { passive: true });
    window.addEventListener('resize', checkVisibility, { passive: true });
  }

  function prepare(el) {
    if (el.dataset.sbiPrepared === '1') return;
    el.dataset.sbiPrepared = '1';

    // Drop any fallback fade-in classes — we're driving the reveal ourselves.
    el.classList.remove('opacity-0', 'animate-fade-in');
    el.style.opacity = '1';
    el.style.transformStyle = 'preserve-3d';

    // Stage perspective (harmless for 2D animations; needed for 3D).
    const stage = el.parentElement;
    if (stage) {
      const ps = getComputedStyle(stage).perspective;
      if (!ps || ps === 'none') stage.style.perspective = '900px';
    }

    // Pick target: explicit data-blur-target wins; otherwise auto by length.
    const explicit = el.dataset.blurTarget;
    const totalLen = el.textContent.trim().length;
    const target = explicit || (totalLen <= PER_CHAR_MAX_LEN ? 'per-character' : 'per-word');

    el._sbiUnits = splitElement(el, target);
  }

  // Walk only text nodes inside `el`, replacing each text node with a
  // sequence of <span class="sbi-unit"> wrappers (and whitespace text nodes
  // for per-word). Inline parents (<a>, <button>, <strong>) survive intact.
  //
  // Container-like elements that should fade in as one piece (link pills,
  // numbered bullet circles) are marked with .link-pill or .sbi-leaf and
  // animate as a single unit — the splitter applies the from-state to the
  // whole element and skips text splitting inside it. Free-standing inline
  // leaf elements (<i> icons, <img>, <svg>) outside a whole-unit also
  // animate as units. Units are returned in DOM order so stagger ranking
  // matches the visual reading order.
  function splitElement(el, target) {
    const LEAF_HOST_SEL = '.link-pill, .sbi-leaf';

    const wholeStyle = {
      opacity: '0',
      transform: FROM_TRANSFORM,
      filter: FROM_FILTER,
      willChange: 'transform, opacity, filter',
    };

    // Container leaves — animate as whole boxes (pill chrome + contents,
    // bullet circle + number) so the pill background and bullet dot fade
    // in with their text instead of sitting visible behind it.
    el.querySelectorAll(LEAF_HOST_SEL).forEach((host) => {
      host.dataset.sbiWhole = '1';
      Object.assign(host.style, wholeStyle);
    });

    // Free-standing inline leaf elements that aren't inside a whole-unit.
    el.querySelectorAll('i, img, svg').forEach((leaf) => {
      if (leaf.closest('[data-sbi-whole]')) return;
      Object.assign(leaf.style, wholeStyle);
    });

    const textNodes = collectTextNodes(el).filter(
      (n) => !n.parentElement || !n.parentElement.closest('[data-sbi-whole]'),
    );

    for (const textNode of textNodes) {
      // Collapse internal whitespace runs into single spaces (the HTML source
      // indentation/newlines become spaces). At the edges, strip leading
      // whitespace only when there's no element sibling before this node
      // (and the same for trailing) — otherwise we'd glue words together
      // across inline tags like <a>, <strong>, <button>.
      let text = textNode.nodeValue.replace(/\s+/g, ' ');
      if (!textNode.previousSibling) text = text.replace(/^\s+/, '');
      if (!textNode.nextSibling)     text = text.replace(/\s+$/, '');
      if (!text || text === ' ') continue;

      const parts = target === 'per-word'
        ? text.split(/(\s+)/)            // words + whitespace runs
        : Array.from(text);              // every char, including spaces

      const fragment = document.createDocumentFragment();
      for (const part of parts) {
        if (!part) continue;
        if (target === 'per-word' && /^\s+$/.test(part)) {
          // Plain whitespace between words — no animation, no span.
          fragment.appendChild(document.createTextNode(part));
        } else {
          const span = document.createElement('span');
          span.className = 'sbi-unit';
          span.textContent = part;
          Object.assign(span.style, UNIT_STYLE);
          fragment.appendChild(span);
        }
      }
      textNode.parentNode.replaceChild(fragment, textNode);
    }

    // Final pass: collect text spans, whole-unit containers, and any
    // free-standing inline leaves in document order. Anything nested
    // inside a whole-unit is excluded since the host animates as one
    // piece.
    return Array.from(
      el.querySelectorAll('.sbi-unit, [data-sbi-whole], i, img, svg'),
    ).filter((node) => {
      if (node.dataset && node.dataset.sbiWhole === '1') return true;
      return !node.closest('[data-sbi-whole]');
    });
  }

  function collectTextNodes(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        return n.nodeValue && n.nodeValue.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  function checkVisibility() {
    const vh = window.innerHeight;
    const targets = document.querySelectorAll('[data-animate="soft-blur-in"]');
    for (const el of targets) {
      if (el.dataset.sbiAnimated === '1') continue;
      if (!el._sbiUnits) continue;
      const r = el.getBoundingClientRect();
      if (r.top < vh - VIEWPORT_MARGIN && r.bottom > 0) animate(el);
    }
  }

  function animate(el) {
    el.dataset.sbiAnimated = '1';
    const units = el._sbiUnits || [];
    if (!units.length) return;

    // Queue this block to start at max(now, queueEndsAt). When multiple
    // blocks enter the viewport at once, each waits for the previous
    // to finish its full reveal.
    const now = performance.now();
    const startAt = Math.max(now, queueEndsAt);
    const initialDelay = startAt - now;
    const total = (units.length - 1) * ENTER_STAGGER_MS + ENTER_DURATION_MS;
    queueEndsAt = startAt + total;

    setTimeout(() => {
      units.forEach((unit, i) => {
        unit.animate(
          [
            { transform: FROM_TRANSFORM, filter: FROM_FILTER, opacity: 0 },
            { transform: TO_TRANSFORM,   filter: TO_FILTER,   opacity: 1 },
          ],
          {
            duration: ENTER_DURATION_MS,
            delay: i * ENTER_STAGGER_MS,
            easing: EASING,
            fill: 'forwards',
          },
        );
      });
    }, initialDelay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
