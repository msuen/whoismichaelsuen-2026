/* Accessible speech reveal. Complete text stays in the DOM for accessibility.
   Glyph opacity changes, never the speech box's dimensions. No live-region
   letter updates, caret, reply lockout or automatic conversation advance. */
(() => {
  let running = null;
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

  function finish(notify = true) {
    if (!running) return false;
    const current = running;
    running = null;
    cancelAnimationFrame(current.frame);
    current.element.classList.remove('is-typing');
    for (const [link, tabindex] of current.links) {
      if (tabindex === null) link.removeAttribute('tabindex');
      else link.setAttribute('tabindex', tabindex);
    }
    window.__encounterVoice?.stop();
    if (notify) current.onFinish?.();
    return true;
  }

  function start(element, { enabled = true, onFinish } = {}) {
    finish(false);
    if (!enabled || document.hidden) return false;
    // One text-flow item: direct glyph children of a flex/grid speech box
    // lose their whitespace-only items. Preserve ordinary inline spacing.
    const flow = document.createElement('span');
    flow.className = 'encounter-typed-content';
    flow.append(...element.childNodes);
    element.append(flow);
    const walker = document.createTreeWalker(flow, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    const glyphs = [];
    for (const textNode of textNodes) {
      const fragment = document.createDocumentFragment();
      const parts = segmenter
        ? Array.from(segmenter.segment(textNode.textContent), part => part.segment)
        : Array.from(textNode.textContent);
      for (const character of parts) {
        const span = document.createElement('span');
        span.className = 'encounter-typed-glyph';
        span.textContent = character;
        fragment.append(span);
        glyphs.push({ span, character });
      }
      textNode.replaceWith(fragment);
    }
    if (!glyphs.length) return false;
    // Opacity preserves layout AND the full accessible text. Links remain
    // announced by their existing labels; keyboard activity finishes first.
    const links = Array.from(element.querySelectorAll('a'), link => [link, link.getAttribute('tabindex')]);
    for (const [link] of links) link.tabIndex = -1;
    element.classList.add('is-typing');
    let duration = 0;
    const deadlines = glyphs.map(({ character }) => {
      const deadline = duration;
      duration += /[.!?]/.test(character) ? 120 : /[,;:]/.test(character) ? 55 : 24;
      return deadline;
    });
    const pace = Math.min(1, 2800 / Math.max(1, duration));
    const current = { element, links, onFinish, glyphs, shown: 0, frame: 0, began: performance.now() + 160 };
    running = current;
    function frame(now) {
      if (running !== current) return;
      if (document.hidden) { finish(); return; }
      const elapsed = now - current.began;
      let spoken = null;
      while (current.shown < glyphs.length && deadlines[current.shown] * pace <= elapsed) {
        const glyph = glyphs[current.shown++];
        glyph.span.dataset.shown = 'true';
        if (/[\p{L}\p{N}]/u.test(glyph.character)) spoken = glyph.character;
      }
      if (spoken) window.__encounterVoice?.syllable(spoken);
      if (current.shown === glyphs.length) { finish(); return; }
      current.frame = requestAnimationFrame(frame);
    }
    current.frame = requestAnimationFrame(frame);
    return true;
  }

  window.__encounterTypewriter = {
    start,
    finish: () => finish(),
    cancel: () => finish(false),
    get active() { return !!running; },
    get progress() { return running ? { shown: running.shown, total: running.glyphs.length } : null; },
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
})();
