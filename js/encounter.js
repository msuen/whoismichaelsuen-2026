/* Authored waterfront conversation. No live chat or visitor persistence. */
(() => {
  const hero = document.getElementById('parallax');
  const layer = document.querySelector('.encounter-layer');
  const trigger = document.getElementById('encounter-trigger');
  const panel = document.getElementById('encounter-dialog');
  const player = document.getElementById('encounter-player');
  const biography = document.getElementById('bio');
  const aboutLayer = document.getElementById('about-layer');
  const replySpace = document.createElement('div');
  replySpace.className = 'encounter-biography-space';
  replySpace.setAttribute('aria-hidden', 'true');
  biography.prepend(replySpace);
  document.getElementById('foreground-canvas').parentElement.classList.add('encounter-stage');
  const quietLine = document.getElementById('encounter-quiet');
  const modal = document.getElementById('apply-modal');
  const audio = document.getElementById('bg-audio');
  const audioToggle = document.getElementById('audio-toggle');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const hoverPointer = matchMedia('(hover: hover) and (pointer: fine)');
  const GREETING_SCROLL = 48;
  const GREETING_DISTANCE = 110;
  const GREETING_DWELL = 140;
  const HEAD_GAP = 24;
  const REPLY_GAP = 24;
  const SCROLL_SETTLE = 280;
  const state = {
    variant: 'expanded',
    node: 'closed',
    open: false,
    quiet: false,
    invitation: false,
    invitationSource: null,
    framing: 'overhead',
    foregroundLift: 0,
    replyAnchor: 'character',
    scrollBuffer: 160,
    titleMuted: false,
    audio: false,
    submissions: 'formspree',
  };
  let quietTimeout;
  let proximityTimeout;
  let pointerFrame = 0;
  let lastPointer = null;
  let dismissScrollY = 0;
  let reservedSpace = 0;
  let scrollCloseTimeout;
  let scrollFrame = 0;
  let layoutWidth = hero.clientWidth;
  let layoutHeight = hero.clientHeight;

  const tree = window.__encounterTree;
  let speechPage = 0;
  let speechPages = [];
  const expandedTrail = [];
  const typewriter = window.__encounterTypewriter;

  function rememberStep() {
    expandedTrail.push({ node: state.node, page: speechPage });
    if (expandedTrail.length > 64) expandedTrail.shift();
  }

  function animateSpeech(element, requested = true) {
    typewriter.start(element, {
      enabled: requested && !reducedMotion.matches && document.documentElement.dataset.encounterInput !== 'keyboard',
      onFinish: report,
    });
    // Glyph wrappers keep their full size; place once before first paint.
    place();
  }

  // Only paginate when a full line cannot fit above the unmoved head.
  // Keep inline links intact and prefer a sentence boundary when possible.
  function expandedSpeechPages(spoken) {
    const line = panel.querySelector('.floating-speech');
    const source = document.createElement('div');
    source.innerHTML = spoken;
    const tokens = [];
    for (const node of source.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        for (const word of node.textContent.match(/\s*\S+\s*/g) || []) {
          const escaped = word.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          tokens.push({ html: escaped, sentence: /[.!?][”’"']?\s*$/.test(word) });
        }
      } else if (node instanceof HTMLElement) tokens.push({ html: node.outerHTML, sentence: false });
    }
    const scale = Math.max(hero.clientWidth / 1800, hero.clientHeight / 1125);
    const available = hero.clientHeight + (695 - 1125) * scale - HEAD_GAP - 16;
    const html = words => words.map(word => word.html).join('');
    const fits = words => {
      line.innerHTML = html(words);
      return panel.offsetHeight <= available;
    };
    const pages = [];
    let words = [];
    for (const token of tokens) {
      if (words.length && !fits([...words, token])) {
        const sentence = words.map(word => word.sentence).lastIndexOf(true);
        const cut = sentence >= 0 ? sentence + 1 : words.length;
        pages.push(html(words.slice(0, cut)));
        words = words.slice(cut);
        if (words.length && !fits([...words, token])) { pages.push(html(words)); words = []; }
      }
      words.push(token);
    }
    if (words.length) pages.push(html(words));
    return pages;
  }

  function choices() {
    const replies = speechPage < speechPages.length - 1
      ? [['continue', 'Go on.'], ['back', 'Back a step.'], ['R0', 'Something else.'], ['Q0', 'Let’s sit for a while.']]
      : [...tree[state.node].choices];
    if (replies.length === 3) replies.splice(1, 0, ['back', 'Back a step.']);
    return `<div class="encounter-choices">${replies.map(([action, label]) => `<button type="button" class="encounter-choice" data-encounter-action="${action}">${label}</button>`).join('')}</div>`;
  }

  function renderFloating(content) {
    return `<h2 id="encounter-heading" class="encounter-sr-only">${content.title}</h2><p id="encounter-copy" class="floating-speech">${content.spoken}</p>`;
  }

  function report() {
    window.__encounter = { ...state, typing: typewriter.active, ...(state.open ? { speechPage: speechPage + 1, speechPages: speechPages.length } : {}) };
  }

  function place() {
    // Speech and replies follow the existing artwork. Opening never moves
    // the foreground; replies below the fold are revealed by page scrolling.
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    const scale = Math.max(w / 1800, h / 1125);
    state.scrollBuffer = Math.round(Math.max(160, Math.min(280, h * .3)));
    const cx = w / 2;
    const characterX = cx - 85 * scale;
    const characterY = h + (700 - 1125) * scale;
    const characterHeight = 385 * scale;
    const headX = cx + 20 * scale;
    const headY = h + (695 - 1125) * scale;
    const scrollOffset = scrollY * .8;
    const headerBottom = hero.querySelector('h1').getBoundingClientRect().bottom;
    const cue = trigger.querySelector('.encounter-cue');
    layer.style.setProperty('--character-x', `${characterX}px`);
    layer.style.setProperty('--character-y', `${characterY}px`);
    layer.style.setProperty('--character-w', `${205 * scale}px`);
    layer.style.setProperty('--character-h', `${characterHeight}px`);
    layer.style.setProperty('--cue-local-x', `${headX - cue.offsetWidth / 2 - characterX}px`);
    layer.style.setProperty('--cue-local-y', `${headY - HEAD_GAP - cue.offsetHeight - characterY}px`);
    const quietWidth = quietLine.offsetWidth || 240;
    const quietHeight = quietLine.offsetHeight || 52;
    layer.style.setProperty('--quiet-x', `${Math.max(16, Math.min(w - quietWidth - 16, headX - quietWidth / 2))}px`);
    layer.style.setProperty('--quiet-y', `${headY - HEAD_GAP - quietHeight}px`);
    if (!state.open) {
      state.foregroundLift = 0;
      state.framing = 'overhead';
      state.titleMuted = !quietLine.hidden && headY - scrollOffset - HEAD_GAP - quietHeight < headerBottom + 16;
      document.documentElement.classList.toggle('encounter-title-muted', state.titleMuted);
      return;
    }

    state.foregroundLift = 0;
    state.framing = 'two-voices';
    const replyWidth = player.offsetWidth;
    player.style.setProperty('--reply-x', `${Math.max(16 + replyWidth / 2, Math.min(w - 16 - replyWidth / 2, headX))}px`);
    player.style.setProperty('--reply-y', `${characterY + characterHeight + REPLY_GAP}px`);
    // Add room below the artwork, not by lifting it. Retain acquired space
    // for this page visit so closing cannot pull biography text upward.
    const bioPadding = parseFloat(getComputedStyle(biography).paddingTop);
    const neededSpace = Math.max(0, characterY + characterHeight + REPLY_GAP + player.offsetHeight + 32 - aboutLayer.offsetTop - bioPadding);
    if (neededSpace > reservedSpace) {
      reservedSpace = Math.ceil(neededSpace);
      replySpace.style.height = `${reservedSpace}px`;
      document.body.style.height = `${innerHeight + aboutLayer.scrollHeight / .8}px`;
    }
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    const x = Math.max(16, Math.min(w - pw - 16, headX - pw / 2));
    const y = headY - HEAD_GAP - ph;
    panel.style.setProperty('--panel-x', `${x}px`);
    panel.style.setProperty('--panel-y', `${y}px`);
    panel.style.setProperty('--tail-x', `${headX - x}px`);
    state.titleMuted = y - scrollOffset < headerBottom + 16;
    document.documentElement.classList.toggle('encounter-title-muted', state.titleMuted);
    return;
  }

  function render(focus = true) {
    typewriter.cancel();
    if (state.open && focus) {
      dismissScrollY = scrollY;
      clearTimeout(scrollCloseTimeout);
    }
    document.documentElement.dataset.encounterVariant = 'expanded';
    document.documentElement.classList.toggle('encounter-in-conversation', state.open);
    layer.classList.toggle('is-quiet', state.quiet);
    layer.classList.toggle('is-greeted', state.invitation);
    layer.classList.add('is-floating');
    player.hidden = !state.open;
    trigger.setAttribute('aria-label', state.open ? 'End the conversation with Michael' : 'Start a conversation with Michael');
    panel.setAttribute('aria-owns', 'encounter-player');
    panel.dataset.node = state.node;
    trigger.setAttribute('aria-expanded', String(state.open));
    panel.hidden = !state.open;
    if (state.open) {
      const content = tree[state.node];
      panel.innerHTML = renderFloating(content);
      speechPages = expandedSpeechPages(content.spoken);
      speechPage = Math.min(speechPage, speechPages.length - 1);
      const line = panel.querySelector('.floating-speech');
      line.innerHTML = speechPages[speechPage];
      player.dataset.motion = document.documentElement.dataset.encounterInput === 'keyboard' || reducedMotion.matches ? 'off' : 'on';
      player.innerHTML = choices();
      place();
      if (focus) panel.focus({ preventScroll: true });
      animateSpeech(line, focus);
    } else place();
    report();
  }

  function canGreet() {
    if (state.invitation || state.open || state.quiet || !modal.hidden || document.hidden) return false;
    // Don't greet after the visitor has left the waterfront for the biography.
    if (scrollY > hero.clientHeight * .72) return false;
    const rect = trigger.getBoundingClientRect();
    return rect.bottom > 100 && rect.top < innerHeight - 60;
  }

  function revealGreeting(source) {
    if (!canGreet()) return;
    state.invitation = true;
    state.invitationSource = source;
    // Latch the invitation. It must not vanish as the cursor moves toward it.
    layer.classList.add('is-greeted');
    report();
  }

  function pointerIsNear() {
    if (!lastPointer) return false;
    const rect = trigger.getBoundingClientRect();
    const dx = Math.max(rect.left - lastPointer.x, 0, lastPointer.x - rect.right);
    const dy = Math.max(rect.top - lastPointer.y, 0, lastPointer.y - rect.bottom);
    return Math.hypot(dx, dy) <= GREETING_DISTANCE;
  }

  document.addEventListener('pointermove', event => {
    if (!hoverPointer.matches || event.pointerType === 'touch' || !canGreet()) return;
    document.documentElement.dataset.encounterInput = 'pointer';
    lastPointer = { x: event.clientX, y: event.clientY };
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      if (!pointerIsNear()) {
        clearTimeout(proximityTimeout);
        proximityTimeout = null;
      } else if (!proximityTimeout) {
        proximityTimeout = setTimeout(() => {
          proximityTimeout = null;
          if (pointerIsNear()) revealGreeting('proximity');
        }, GREETING_DWELL);
      }
    });
  }, { passive: true });
  document.addEventListener('pointerout', event => {
    if (!event.relatedTarget) {
      lastPointer = null;
      clearTimeout(proximityTimeout);
      proximityTimeout = null;
    }
  });
  trigger.addEventListener('focus', () => {
    if (document.documentElement.dataset.encounterInput === 'keyboard') revealGreeting('keyboard');
  });

  function open() {
    clearTimeout(scrollCloseTimeout);
    clearTimeout(quietTimeout);
    clearTimeout(proximityTimeout);
    quietLine.hidden = true;
    state.node = 'R0';
    speechPage = 0;
    expandedTrail.length = 0;
    state.open = true;
    state.quiet = false;
    state.invitation = true;
    state.invitationSource ||= 'activation';
    render();
  }

  function close({ quiet = false, restoreFocus = true } = {}) {
    clearTimeout(scrollCloseTimeout);
    state.node = quiet ? 'quiet' : 'closed';
    state.open = false;
    state.quiet = quiet;
    state.invitation = !quiet;
    clearTimeout(proximityTimeout);
    proximityTimeout = null;
    render(false);
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }

  function sit(line = 'Of course. Take your time.', endingNode = 'quiet') {
    close({ quiet: true, restoreFocus: false });
    state.node = endingNode;
    // Remove focus without scrolling the page; the character remains a
    // keyboard-accessible way back into the conversation.
    if (panel.contains(document.activeElement) || player.contains(document.activeElement)) document.activeElement.blur();
    quietLine.textContent = line;
    quietLine.hidden = false;
    place();
    animateSpeech(quietLine);
    report();
    clearTimeout(quietTimeout);
    quietTimeout = setTimeout(() => { typewriter.cancel(); quietLine.hidden = true; place(); report(); }, 2400);
  }

  function openInquiry() {
    close();
    state.node = 'inquiry';
    report();
    // The existing modal remembers the character trigger as its focus
    // return point, not a dialogue choice which has just become hidden.
    document.querySelector('#contact [data-open-apply-modal]').click();
  }

  trigger.addEventListener('click', () => state.open ? close() : open());
  function respond(event) {
    const button = event.target.closest('[data-encounter-action]');
    if (!button) return;
    const action = button.dataset.encounterAction;
    if (button.tagName === 'A') event.preventDefault();
    if (action === 'close') close();
    else if (action === 'inquiry') openInquiry();
    else {
      if (action === 'continue') { rememberStep(); speechPage += 1; render(); return; }
      if (action === 'back') {
        const previous = expandedTrail.pop() || { node: 'R0', page: 0 };
        state.node = previous.node;
        speechPage = previous.page;
        render();
        return;
      }
      const next = tree[action];
      if (!next) return;
      if (action === 'R0') expandedTrail.length = 0;
      else if (!next.ending) rememberStep();
      speechPage = 0;
      if (next.ending) sit(next.spoken, action);
      else { state.node = action; render(); }
    }
  }
  panel.addEventListener('click', event => {
    if (typewriter.active) { typewriter.finish(); event.preventDefault(); return; }
    respond(event);
  });
  quietLine.addEventListener('click', () => typewriter.finish());
  player.addEventListener('click', respond);

  function revealKeyboardFocus(node) {
    const rect = node.getBoundingClientRect();
    if (player.contains(node) && player.scrollWidth > player.clientWidth) {
      const row = player.getBoundingClientRect();
      if (rect.left < row.left + 4) player.scrollLeft += rect.left - row.left - 4;
      else if (rect.right > row.right - 4) player.scrollLeft += rect.right - row.right + 4;
    }
    const viewport = hero.clientHeight;
    let delta = 0;
    if (rect.top < 24) delta = rect.top - 24;
    else if (rect.bottom > viewport - 24) {
      delta = rect.height > viewport - 48 ? rect.top - 24 : rect.bottom - viewport + 24;
    }
    if (Math.abs(delta) > 1) {
      window.scrollBy({ top: delta / .8, behavior: 'instant' });
      dismissScrollY = scrollY;
      clearTimeout(scrollCloseTimeout);
    }
  }

  document.addEventListener('pointerdown', event => {
    document.documentElement.dataset.encounterInput = 'pointer';
    if (state.open && (panel.contains(event.target) || player.contains(event.target))) {
      dismissScrollY = scrollY;
      clearTimeout(scrollCloseTimeout);
    }
    if (state.open && !panel.contains(event.target) && !player.contains(event.target) && !trigger.contains(event.target) && !audioToggle.contains(event.target)) close({ restoreFocus: false });
  });
  document.addEventListener('focusin', event => {
    if (event.target !== panel && (panel.contains(event.target) || player.contains(event.target))) typewriter.finish();
    if (state.open && (panel.contains(event.target) || player.contains(event.target))) {
      dismissScrollY = scrollY;
      clearTimeout(scrollCloseTimeout);
    }
    if (state.open && !panel.contains(event.target) && !player.contains(event.target) && !trigger.contains(event.target) && !audioToggle.contains(event.target)) close({ restoreFocus: false });
    if (document.documentElement.dataset.encounterInput === 'keyboard' &&
        ((state.open && (panel.contains(event.target) || player.contains(event.target))) || aboutLayer.contains(event.target))) {
      revealKeyboardFocus(event.target);
    }
  });
  function scrolledAway() {
    if (Math.abs(scrollY - dismissScrollY) <= state.scrollBuffer) return false;
    const h = hero.clientHeight;
    const scale = Math.max(hero.clientWidth / 1800, h / 1125);
    const characterTop = h + (700 - 1125) * scale - scrollY * .8;
    const characterHeight = 385 * scale;
    return characterTop + characterHeight < Math.min(96, characterHeight * .25);
  }
  window.addEventListener('scroll', () => {
    clearTimeout(scrollCloseTimeout);
    if (state.open && !scrollFrame) {
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        if (!state.open) return;
        const muted = state.titleMuted;
        place();
        if (muted !== state.titleMuted) report();
        if (scrolledAway()) {
          scrollCloseTimeout = setTimeout(() => {
            if (state.open && scrolledAway()) close({ restoreFocus: false });
          }, SCROLL_SETTLE);
        }
      });
    }
    if (scrollY >= GREETING_SCROLL) revealGreeting('scroll');
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (hero.clientWidth === layoutWidth && hero.clientHeight === layoutHeight) return;
    layoutWidth = hero.clientWidth;
    layoutHeight = hero.clientHeight;
    speechPage = 0;
    render(false);
  });
  function fontsReady() {
    if (state.open) render(false);
    else { place(); report(); }
  }
  document.fonts.ready.then(fontsReady);
  document.fonts.addEventListener('loadingdone', fontsReady);

  document.addEventListener('keydown', event => {
    document.documentElement.dataset.encounterInput = 'keyboard';
    const finished = typewriter.finish();
    if (finished && (event.key === ' ' || event.key === 'Enter') && event.target === panel) event.preventDefault();
    if (state.open) player.dataset.motion = 'off';
    if (!modal.hidden) {
      if (event.key === 'Tab') {
        const items = [...modal.querySelectorAll('button:not([disabled]), input:not([tabindex="-1"]), textarea')];
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      return;
    }
    if (event.key === 'Tab' && state.open) {
      const items = [...panel.querySelectorAll('a[href]'), ...player.querySelectorAll('button, a')];
      if (!event.shiftKey && document.activeElement === panel) {
        event.preventDefault(); items[0].focus({ preventScroll: true }); return;
      }
      const index = items.indexOf(document.activeElement);
      if (event.shiftKey && index === 0) {
        event.preventDefault(); panel.focus({ preventScroll: true }); return;
      }
      const next = index + (event.shiftKey ? -1 : 1);
      if (index >= 0 && next >= 0 && next < items.length) {
        event.preventDefault(); items[next].focus({ preventScroll: true }); return;
      }
    }
    if (event.key === 'Escape' && state.open) { event.preventDefault(); close(); }
  });

  // Ambience is opt-in. UI synthesis shares this same state.
  window.__audioOn = false;
  audio.muted = true;
  audio.volume = .25;
  audioToggle.addEventListener('click', async () => {
    if (state.audio) {
      audio.pause();
      audio.muted = true;
      state.audio = false;
    } else {
      window.__encounterVoice?.unlock(true);
      window.__encounterVoice?.attachAmbience(audio);
      audio.muted = false;
      try { await audio.play(); state.audio = true; }
      catch { audio.muted = true; state.audio = false; }
    }
    window.__audioOn = state.audio;
    if (state.audio) window.__encounterVoice?.unlock();
    else window.__encounterVoice?.stop();
    audioToggle.setAttribute('aria-pressed', String(state.audio));
    audioToggle.setAttribute('aria-label', `Turn ambience and character sounds ${state.audio ? 'off' : 'on'}`);
    audioToggle.querySelector('use').setAttribute('href', state.audio ? '#ti-volume' : '#ti-volume-off');
    report();
  });

  render(false);
  requestAnimationFrame(() => {
    if (scrollY >= GREETING_SCROLL) revealGreeting('scroll');
  });
  reducedMotion.addEventListener('change', () => render(false));
})();
