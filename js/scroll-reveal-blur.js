// ============================================
// SCROLL REVEAL BLUR — scroll-driven per-word unblur + fade
// ============================================
// Vanilla-JS port of the Framer "StickyBlurReveal" component
// (https://framer.com/m/Scroll-reveal-1-1-a79i.js@WIuZdq66zHREPFyhtccI).
//
// Algorithm:
//   - Each text element splits per-word; words start at blur(3px), opacity 0.1
//   - As the element rises into the viewport, a per-element progress 0→1
//     is computed: (visibleHeight - elementHeight) / (FULL_REVEAL_DISTANCE
//     - elementHeight). progress = 0 when the element's bottom first
//     touches the viewport bottom; progress = 1 after FULL_REVEAL_DISTANCE
//     more pixels of scroll.
//   - Per-word progress = clamp((progress − wordIndex/totalWords) ×
//     totalWords, 0, 1). Word 0 starts revealing first; subsequent words
//     start at scrollProgress = i/N.
//   - CSS transitions smooth the per-frame filter/opacity jumps.
//
// Compared to soft-blur-in this is much less theatrical: text is mostly
// there from the start, just blurred, and sharpens as the user scrolls.
//
// Apply to any element with data-animate="scroll-reveal-blur". The same
// container-host conventions used by soft-blur-in apply:
//   - .link-pill and .sbi-leaf nodes animate as whole boxes (no inner split)
//   - inline <i>/<img>/<svg> outside whole-units animate as their own units
(function () {
  const FULL_REVEAL_DISTANCE_PX = 1000;
  const INITIAL_BLUR_PX         = 3;
  const INITIAL_OPACITY         = 0.1;
  const TRANSITION              = 'filter 0.2s ease-out, opacity 0.2s ease-out';
  const LEAF_HOST_SEL           = '.link-pill, .sbi-leaf';

  async function init() {
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }
    document.querySelectorAll('[data-animate="scroll-reveal-blur"]').forEach(prepare);
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', () => {
      document.querySelectorAll('[data-animate="scroll-reveal-blur"]').forEach(measure);
      update();
    }, { passive: true });
  }

  function applyInitial(node) {
    node.style.transition = TRANSITION;
    node.style.filter = `blur(${INITIAL_BLUR_PX}px)`;
    node.style.opacity = String(INITIAL_OPACITY);
  }

  function prepare(el) {
    if (el.dataset.srbPrepared === '1') return;
    el.dataset.srbPrepared = '1';

    // Container hosts (pills, bullet circles) animate as whole boxes.
    el.querySelectorAll(LEAF_HOST_SEL).forEach((host) => {
      host.dataset.srbWhole = '1';
      applyInitial(host);
    });

    // Free-standing inline leaves outside any whole-host.
    el.querySelectorAll('i, img, svg').forEach((leaf) => {
      if (leaf.closest('[data-srb-whole]')) return;
      applyInitial(leaf);
    });

    // Split remaining text nodes per-word.
    const textNodes = collectTextNodes(el).filter(
      (n) => !n.parentElement || !n.parentElement.closest('[data-srb-whole]'),
    );
    for (const textNode of textNodes) {
      let text = textNode.nodeValue.replace(/\s+/g, ' ');
      if (!textNode.previousSibling) text = text.replace(/^\s+/, '');
      if (!textNode.nextSibling)     text = text.replace(/\s+$/, '');
      if (!text || text === ' ') continue;

      const parts = text.split(/(\s+)/);
      const fragment = document.createDocumentFragment();
      for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          fragment.appendChild(document.createTextNode(part));
        } else {
          const span = document.createElement('span');
          span.className = 'srb-unit';
          span.textContent = part;
          span.style.display = 'inline-block';
          applyInitial(span);
          fragment.appendChild(span);
        }
      }
      textNode.parentNode.replaceChild(fragment, textNode);
    }

    // Final ordered unit list (skip anything inside a whole-host).
    el._srbUnits = Array.from(
      el.querySelectorAll('.srb-unit, [data-srb-whole], i, img, svg'),
    ).filter((node) => {
      if (node.dataset && node.dataset.srbWhole === '1') return true;
      return !node.closest('[data-srb-whole]');
    });

    measure(el);
  }

  function measure(el) {
    const r = el.getBoundingClientRect();
    el._srbStart  = window.scrollY + r.top;
    el._srbHeight = r.height;
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

  function update() {
    const currentScroll = window.scrollY;
    const vh = window.innerHeight;
    document.querySelectorAll('[data-animate="scroll-reveal-blur"]').forEach((el) => {
      const units = el._srbUnits;
      if (!units || !units.length) return;
      if (el._srbStart === undefined) measure(el);

      const elementTop   = el._srbStart - currentScroll;
      const visibleHeight = vh - elementTop;
      const denom = FULL_REVEAL_DISTANCE_PX - el._srbHeight;
      const progress = denom > 0
        ? Math.max(0, Math.min(1, (visibleHeight - el._srbHeight) / denom))
        : (visibleHeight >= el._srbHeight ? 1 : 0);

      const total = units.length;
      for (let i = 0; i < total; i++) {
        const unitProgress = Math.max(
          0,
          Math.min(1, (progress - i / total) * total),
        );
        const blur = INITIAL_BLUR_PX * (1 - unitProgress);
        const opacity = INITIAL_OPACITY + (1 - INITIAL_OPACITY) * unitProgress;
        const u = units[i];
        u.style.filter = `blur(${blur}px)`;
        u.style.opacity = String(opacity);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
