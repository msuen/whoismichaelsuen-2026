// ============================================
// FADE UP — per-word splitter (no runtime scroll work)
// ============================================
// Walks every element with data-animate="fade-up" and replaces its
// text nodes with per-word <span class="reveal-unit"> wrappers. The
// actual reveal animation is driven entirely by CSS scroll-driven
// animations (see .reveal-unit + @keyframes soft-blur-reveal in
// css/styles.css), so this script does NOT install a scroll listener
// and does no per-frame work — the browser composites every unit's
// animation on its own view-timeline.
//
// Container conventions:
//   - Whole-unit hosts (.link-pill, .sbi-leaf) animate as one piece;
//     no inner text split.
//   - Inline <i>/<img>/<svg> leaves outside any whole-host animate
//     as their own units.
(function () {
  const LEAF_HOST_SEL = '.link-pill, .sbi-leaf';

  async function init() {
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }
    document.querySelectorAll('[data-animate="fade-up"]').forEach(prepare);
  }

  function prepare(el) {
    if (el.dataset.fuPrepared === '1') return;
    el.dataset.fuPrepared = '1';

    // Container hosts — animate as whole boxes.
    el.querySelectorAll(LEAF_HOST_SEL).forEach((host) => {
      host.dataset.fuWhole = '1';
      host.classList.add('reveal-unit');
    });

    // Inline leaves outside any whole-host.
    el.querySelectorAll('i, img, svg').forEach((leaf) => {
      if (leaf.closest('[data-fu-whole]')) return;
      leaf.classList.add('reveal-unit');
    });

    // Split remaining text nodes per-word.
    const textNodes = collectTextNodes(el).filter(
      (n) => !n.parentElement || !n.parentElement.closest('[data-fu-whole]'),
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
          span.className = 'reveal-unit';
          span.textContent = part;
          fragment.appendChild(span);
        }
      }
      textNode.parentNode.replaceChild(fragment, textNode);
    }
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
