/**
 * Simulated multi-camera security feed — canvas renderer.
 * Server sends grid of camera statuses; client renders sub-grid
 * with noise texture, labels, and status indicators.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    textDim: get('--color-text-dim'),
    textPri: get('--color-text-primary'),
    error:   get('--color-error'),
    warn:    get('--color-warn'),
    info:    get('--color-info'),
    border:  get('--color-border'),
  };
}

export default {
  name: 'ActivityCameraFeed',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;
    let frameCount = 0;

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) return;
      const state = props.activity?.state;
      const cameras = state?.cameras;
      if (!cameras || cameras.length === 0) { rafId = requestAnimationFrame(draw); return; }

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (W === 0 || H === 0) { rafId = requestAnimationFrame(draw); return; }
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr; canvas.height = H * dpr;
      }

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = getThemeColors();
      const rows = state.grid_rows || 2;
      const cols = state.grid_cols || 2;

      frameCount++;

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const gap = 2;
      const cellW = (W - gap * (cols + 1)) / cols;
      const cellH = (H - gap * (rows + 1)) / rows;

      for (let idx = 0; idx < cameras.length; idx++) {
        const cam = cameras[idx];
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const x = gap + col * (cellW + gap);
        const y = gap + row * (cellH + gap);

        // Cell background
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, cellW, cellH);

        if (cam.status === 'active') {
          // Simulated "video" — dark gradient with slight variation
          const brightness = cam.brightness || 0.7;
          const motion = cam.motion_level || 0;

          // Dark scene with occasional lighter areas
          const baseGray = Math.floor(20 * brightness);
          ctx.fillStyle = `rgb(${baseGray}, ${baseGray + 2}, ${baseGray})`;
          ctx.fillRect(x, y, cellW, cellH);

          // Scanlines
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
          for (let sy = 0; sy < cellH; sy += 3) {
            ctx.fillRect(x, y + sy, cellW, 1);
          }

          // Motion indicator — subtle block movement
          if (motion > 0.5) {
            const mx = x + Math.sin(frameCount * 0.05 + idx) * cellW * 0.2 + cellW * 0.5;
            const my = y + Math.cos(frameCount * 0.03 + idx) * cellH * 0.15 + cellH * 0.5;
            ctx.fillStyle = `rgba(255, 255, 255, ${motion * 0.04})`;
            ctx.fillRect(mx - 15, my - 10, 30, 20);
          }

          // Status dot — green
          ctx.beginPath();
          ctx.arc(x + cellW - 8, y + 8, 3, 0, Math.PI * 2);
          ctx.fillStyle = c.info;
          ctx.fill();

        } else if (cam.status === 'static') {
          // Static noise
          const imgData = ctx.createImageData(Math.ceil(cellW), Math.ceil(cellH));
          const data = imgData.data;
          const seed = cam.noise_seed + frameCount;
          for (let i = 0; i < data.length; i += 4) {
            const v = ((seed * 9301 + (i >> 2) * 49297 + frameCount * 233) % 233) & 0xff;
            const gray = v * 0.3;
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
            data[i + 3] = 255;
          }
          ctx.putImageData(imgData, x, y);

          // Status dot — yellow
          ctx.beginPath();
          ctx.arc(x + cellW - 8, y + 8, 3, 0, Math.PI * 2);
          ctx.fillStyle = c.warn;
          ctx.fill();

        } else {
          // Signal lost
          ctx.fillStyle = '#000';
          ctx.fillRect(x, y, cellW, cellH);

          // "NO SIGNAL" text
          ctx.font = `bold ${Math.max(8, cellW * 0.08)}px monospace`;
          ctx.fillStyle = c.error;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // Blink effect
          if (Math.floor(frameCount / 30) % 2 === 0) {
            ctx.fillText('NO SIGNAL', x + cellW / 2, y + cellH / 2);
          }

          // Status dot — red
          ctx.beginPath();
          ctx.arc(x + cellW - 8, y + 8, 3, 0, Math.PI * 2);
          ctx.fillStyle = c.error;
          ctx.fill();
        }

        // Camera label
        ctx.font = `${Math.max(7, Math.min(10, cellW * 0.055))}px monospace`;
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(cam.label, x + 4, y + 4);

        // Timestamp overlay
        const now = new Date();
        const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        ctx.textAlign = 'right';
        ctx.fillText(ts, x + cellW - 14, y + cellH - 10);

        // Border
        ctx.strokeStyle = c.border + '44';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cellW, cellH);
      }

      // Strategy label
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const strategy = state.strategy || '';
      ctx.fillText(strategy.toUpperCase().replace(/_/g, ' '), 4, H - 2);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
