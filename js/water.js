// ============================================
// CANVAS WATER RIPPLE EFFECT
// Applies sine-wave displacement to the water texture
// and draws a mirrored reflection of the skyline
// ============================================
(function () {
  const canvas = document.getElementById('water-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Load both water texture and buildings for reflection
  const waterImg = new Image();
  const buildingsImg = new Image();
  let waterReady = false;
  let buildingsReady = false;

  waterImg.onload = function () {
    waterReady = true;
    if (buildingsReady) start();
  };
  buildingsImg.onload = function () {
    buildingsReady = true;
    if (waterReady) start();
  };
  waterImg.src = 'images/bg2-water@2x.png';
  buildingsImg.src = 'images/bg2-buildings@2x.png';

  function start() {
    resize();
    render();
  }

  function resize() {
    const parent = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = parent.clientWidth * dpr;
    canvas.height = parent.clientHeight * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }

  window.addEventListener('resize', () => {
    if (waterReady && buildingsReady) resize();
  });

  const startTime = performance.now();

  const aboutLayerEl = document.getElementById('about-layer');

  function render() {
    if (!waterReady || !buildingsReady) return;

    // Skip per-frame work when the about-layer has fully covered the
    // hero — the water canvas is occluded so there's nothing to draw.
    if (aboutLayerEl && aboutLayerEl.getBoundingClientRect().top <= 0) {
      requestAnimationFrame(render);
      return;
    }

    const t = (performance.now() - startTime) / 1000;
    const dpr = window.devicePixelRatio || 1;
    const pw = canvas.parentElement.clientWidth;
    const ph = canvas.parentElement.clientHeight;

    // Reset transform and clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, pw, ph);

    // Compute object-fit: cover dimensions, anchored bottom-center
    const imgAspect = waterImg.width / waterImg.height;
    const canvasAspect = pw / ph;
    let drawW, drawH, drawX, drawY;

    const oversize = 1.1;
    if (canvasAspect > imgAspect) {
      drawW = pw * oversize;
      drawH = drawW / imgAspect;
    } else {
      drawH = ph * oversize;
      drawW = drawH * imgAspect;
    }
    drawX = (pw - drawW) / 2;
    drawY = ph - drawH; // anchor bottom

    // --- Draw mirrored reflection of buildings ---
    // Flip vertically: save state, translate to reflection origin, scale -1 on Y
    const reflectionY = ph * 0.48; // where reflection starts (matches clip-path 52%)
    ctx.save();
    ctx.globalAlpha = 0.3; // reflection opacity

    // Compute buildings cover dimensions (same aspect ratio)
    const bAspect = buildingsImg.width / buildingsImg.height;
    let bW, bH, bX, bY;
    if (canvasAspect > bAspect) {
      bW = pw;
      bH = pw / bAspect;
    } else {
      bH = ph;
      bW = ph * bAspect;
    }
    bX = (pw - bW) / 2;
    bY = ph - bH; // anchor bottom (same as normal render)

    // Draw flipped: translate to reflection line, flip Y, draw with wave distortion
    ctx.translate(0, reflectionY * 2);
    ctx.scale(1, -1);

    // Draw reflection in slices with wave distortion
    const refSlices = 40;
    const refSliceH = bH / refSlices;
    for (let i = 0; i < refSlices; i++) {
      const srcY = (i / refSlices) * buildingsImg.height;
      const srcH = buildingsImg.height / refSlices;
      const dstY = bY + i * refSliceH;

      const progress = i / refSlices;
      const strength = Math.max(0, (progress - 0.3) / 0.7);
      const amp = pw * 0.01;
      const dx = Math.sin(progress * 6 + t * 0.9) * amp * strength;

      ctx.drawImage(
        buildingsImg,
        0, srcY, buildingsImg.width, srcH + 1,
        bX + dx, dstY, bW, refSliceH + 1
      );
    }

    ctx.restore();

    // --- Draw water texture with wave distortion ---
    const sliceCount = 80;
    const sliceH = drawH / sliceCount;

    for (let i = 0; i < sliceCount; i++) {
      const srcY = (i / sliceCount) * waterImg.height;
      const srcH = waterImg.height / sliceCount;
      const dstY = drawY + i * sliceH;

      const progress = i / sliceCount;
      const strength = Math.max(0, (progress - 0.55) / 0.45);

      const amp = pw * 0.022;
      const wave1 = Math.sin(progress * 8 + t * 1.2) * amp;
      const wave2 = Math.sin(progress * 14 - t * 1.8) * amp * 0.6;
      const wave3 = Math.cos(progress * 5 + t * 0.7) * amp * 0.8;
      const dx = (wave1 + wave2 + wave3) * strength;
      const dy = Math.sin(progress * 6 + t * 0.9) * amp * 0.4 * strength;

      ctx.drawImage(
        waterImg,
        0, srcY, waterImg.width, srcH + 1,
        drawX + dx, dstY + dy, drawW, sliceH + 1
      );
    }

    requestAnimationFrame(render);
  }
})();
