// ============================================
// HERO TUNER PANEL
// ============================================
// Floating control panel for live-tweaking the hero animations and tint.
// Hidden unless the URL has ?tune (e.g. http://localhost:8080/?tune).
// Reads/writes:
//   window.__hero  — breathing + head-tilt state used by main.js
//   .hero-tint     — inline style for color, alpha, mix-blend-mode
// The "Copy settings" button serializes the current values to the clipboard
// in a plain-text format that's easy to paste back into a chat.
(function () {
  if (!new URLSearchParams(location.search).has('tune')) return;

  // ---- State (must match the defaults in main.js) -----------------------
  const heroState = window.__hero || (window.__hero = {
    breath: { amp: 5, period: 3000 },
  });

  // Tint state — initialize from whatever the CSS currently sets.
  const tintEl = document.querySelector('.hero-tint');
  const tintState = parseTintFromCSS(tintEl);

  function parseTintFromCSS(el) {
    if (!el) return { color: '#5028a0', alpha: 0.35, blendMode: 'soft-light' };
    const s = getComputedStyle(el);
    const m = s.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    let color = '#5028a0';
    let alpha = 0.35;
    if (m) {
      const r = parseInt(m[1], 10), g = parseInt(m[2], 10), b = parseInt(m[3], 10);
      color = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
      alpha = m[4] !== undefined ? parseFloat(m[4]) : 1;
    }
    return { color, alpha, blendMode: s.mixBlendMode || 'soft-light' };
  }

  function applyTint() {
    if (!tintEl) return;
    const { color, alpha, blendMode } = tintState;
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    tintEl.style.background = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    tintEl.style.mixBlendMode = blendMode;
  }

  // Snapshot the defaults for the Reset button.
  const defaults = {
    breath: { ...heroState.breath },
    tint:   { ...tintState },
  };

  // ---- Styles ------------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = `
    .tune-panel {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 99999;
      width: 290px;
      max-height: calc(100vh - 32px);
      overflow-y: auto;
      padding: 14px 16px 16px;
      background: rgba(20, 20, 22, 0.88);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      color: #e8e8e8;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      line-height: 1.4;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      user-select: none;
    }
    .tune-panel * { box-sizing: border-box; }
    .tune-panel h2 {
      margin: 0 0 10px;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #fff;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .tune-panel h2 button {
      background: transparent;
      border: 0;
      color: #aaa;
      font-size: 14px;
      cursor: pointer;
      padding: 0 4px;
    }
    .tune-panel h2 button:hover { color: #fff; }
    .tune-group {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
    .tune-group:first-of-type { border-top: 0; padding-top: 0; margin-top: 0; }
    .tune-group-label {
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .tune-group-label button {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #e8e8e8;
      font: inherit;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 4px;
      cursor: pointer;
      text-transform: none;
      letter-spacing: 0;
    }
    .tune-group-label button:hover { background: rgba(255, 255, 255, 0.16); }
    .tune-row {
      display: grid;
      grid-template-columns: 78px 1fr 50px;
      align-items: center;
      gap: 8px;
      margin: 4px 0;
    }
    .tune-row label { color: #d0d0d0; }
    .tune-row input[type="range"] { width: 100%; }
    .tune-row input[type="color"] {
      width: 100%;
      height: 22px;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: transparent;
      cursor: pointer;
    }
    .tune-row select {
      grid-column: 2 / span 2;
      width: 100%;
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      padding: 3px 6px;
      font: inherit;
      cursor: pointer;
    }
    .tune-row .val {
      text-align: right;
      color: #ffd081;
      font-variant-numeric: tabular-nums;
    }
    .tune-actions {
      margin-top: 12px;
      display: flex;
      gap: 6px;
    }
    .tune-btn {
      flex: 1;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #fff;
      padding: 7px 8px;
      border-radius: 5px;
      font: inherit;
      cursor: pointer;
      transition: background 0.15s;
    }
    .tune-btn:hover { background: rgba(255, 255, 255, 0.18); }
    .tune-btn.primary { background: #ef4723; border-color: #ef4723; }
    .tune-btn.primary:hover { background: #d83c1a; }
    .tune-toast {
      margin-top: 8px;
      text-align: center;
      color: #8efb8e;
      font-size: 10px;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
      height: 14px;
    }
    .tune-toast.show { opacity: 1; }
    .tune-panel.collapsed .tune-group,
    .tune-panel.collapsed .tune-actions,
    .tune-panel.collapsed .tune-toast { display: none; }
  `;
  document.head.appendChild(style);

  // ---- Markup ------------------------------------------------------------
  const blendModes = [
    'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
    'color-dodge', 'color-burn', 'hard-light', 'soft-light',
    'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
  ];

  const panel = document.createElement('div');
  panel.className = 'tune-panel';
  panel.innerHTML = `
    <h2>
      <span>Hero tuner</span>
      <button type="button" data-toggle aria-label="Collapse">–</button>
    </h2>

    <div class="tune-group">
      <div class="tune-group-label"><span>Breathing (shoulders)</span></div>
      <div class="tune-row">
        <label for="t-breath-amp">Amplitude</label>
        <input id="t-breath-amp" type="range" min="0" max="20" step="1" />
        <span class="val" data-out="breath-amp"></span>
      </div>
      <div class="tune-row">
        <label for="t-breath-period">Period</label>
        <input id="t-breath-period" type="range" min="1000" max="12000" step="100" />
        <span class="val" data-out="breath-period"></span>
      </div>
    </div>

    <div class="tune-group">
      <div class="tune-group-label"><span>Tint</span></div>
      <div class="tune-row">
        <label for="t-tint-color">Color</label>
        <input id="t-tint-color" type="color" />
        <span class="val" data-out="tint-color"></span>
      </div>
      <div class="tune-row">
        <label for="t-tint-alpha">Alpha</label>
        <input id="t-tint-alpha" type="range" min="0" max="1" step="0.01" />
        <span class="val" data-out="tint-alpha"></span>
      </div>
      <div class="tune-row">
        <label for="t-tint-blend">Mode</label>
        <select id="t-tint-blend">
          ${blendModes.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="tune-actions">
      <button class="tune-btn" type="button" data-reset>Reset</button>
      <button class="tune-btn primary" type="button" data-copy>Copy settings</button>
    </div>
    <div class="tune-toast">Copied to clipboard</div>
  `;
  document.body.appendChild(panel);

  // ---- Wire up -----------------------------------------------------------
  const $ = (sel) => panel.querySelector(sel);
  const setOut = (key, val) => panel.querySelector(`[data-out="${key}"]`).textContent = val;

  function readUI() {
    heroState.breath.amp    = +$('#t-breath-amp').value;
    heroState.breath.period = +$('#t-breath-period').value;
    tintState.color         = $('#t-tint-color').value;
    tintState.alpha         = +$('#t-tint-alpha').value;
    tintState.blendMode     = $('#t-tint-blend').value;

    setOut('breath-amp',    heroState.breath.amp + ' px');
    setOut('breath-period', heroState.breath.period + ' ms');
    setOut('tint-color',    tintState.color);
    setOut('tint-alpha',    tintState.alpha.toFixed(2));
    applyTint();
  }

  function writeUI() {
    $('#t-breath-amp').value    = heroState.breath.amp;
    $('#t-breath-period').value = heroState.breath.period;
    $('#t-tint-color').value    = tintState.color;
    $('#t-tint-alpha').value    = tintState.alpha;
    $('#t-tint-blend').value    = tintState.blendMode;
    readUI();
  }

  panel.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', readUI);
  });

  $('[data-reset]').addEventListener('click', () => {
    heroState.breath = { ...defaults.breath };
    Object.assign(tintState, defaults.tint);
    writeUI();
  });

  $('[data-toggle]').addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    $('[data-toggle]').textContent = panel.classList.contains('collapsed') ? '+' : '–';
  });

  $('[data-copy]').addEventListener('click', async () => {
    const text = formatSettings();
    try {
      await navigator.clipboard.writeText(text);
      const toast = $('.tune-toast');
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 1400);
    } catch (e) {
      window.prompt('Copy these settings:', text);
    }
  });

  function formatSettings() {
    const c = tintState.color;
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    return [
      '// js/main.js — breathing IIFE',
      `state.breath = { amp: ${heroState.breath.amp}, period: ${heroState.breath.period} };`,
      '',
      '// css/styles.css — .hero-tint',
      `background: rgba(${r}, ${g}, ${b}, ${tintState.alpha});`,
      `mix-blend-mode: ${tintState.blendMode};`,
    ].join('\n');
  }

  writeUI();
})();
