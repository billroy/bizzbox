/**
 * SDR spectrum waterfall renderer — scrolling heatmap with frequency axis.
 * Each row is the most recent spectrum snapshot; rows scroll downward over time.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    textDim: get('--color-text-dim'),
    border:  get('--color-border'),
    text:    get('--color-text-primary'),
  };
}

/** Map a 0–1 power value to an RGBA colour using a thermal palette. */
function powerToColor(v, ctx) {
  // Thermal: black → deep blue → cyan → yellow → white
  v = Math.max(0, Math.min(1, v));
  let r, g, b;
  if (v < 0.2) {
    const t = v / 0.2;
    r = 0; g = 0; b = Math.round(t * 180);
  } else if (v < 0.45) {
    const t = (v - 0.2) / 0.25;
    r = 0; g = Math.round(t * 220); b = Math.round(180 + t * 50);
  } else if (v < 0.70) {
    const t = (v - 0.45) / 0.25;
    r = Math.round(t * 255); g = 220; b = Math.round(230 - t * 230);
  } else {
    const t = (v - 0.70) / 0.30;
    r = 255; g = Math.round(220 + t * 35); b = Math.round(t * 255);
  }
  return `rgb(${r},${g},${b})`;
}

export default {
  name: 'ActivitySdrWaterfall',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) { rafId = requestAnimationFrame(draw); return; }
      const state = props.activity?.state;
      const waterfall = state?.waterfall;
      if (!waterfall || waterfall.length === 0) { rafId = requestAnimationFrame(draw); return; }

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (W === 0 || H === 0) { rafId = requestAnimationFrame(draw); return; }

      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr;
        canvas.height = H * dpr;
      }

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = getThemeColors();

      const AXIS_H = 18;   // frequency axis height at bottom
      const LABEL_W = 0;   // no left label area
      const plotW = W - LABEL_W;
      const plotH = H - AXIS_H;

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const rows = waterfall.length;
      const bins = waterfall[0].length;
      const rowH = plotH / rows;
      const binW = plotW / bins;

      // Draw waterfall rows top-to-bottom (index 0 = newest at top)
      for (let row = 0; row < rows; row++) {
        const y = row * rowH;
        const rowData = waterfall[row];
        for (let b = 0; b < bins; b++) {
          ctx.fillStyle = powerToColor(rowData[b]);
          ctx.fillRect(LABEL_W + b * binW, y, Math.ceil(binW) + 1, Math.ceil(rowH) + 1);
        }
      }

      // Frequency axis
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, plotH, W, AXIS_H);
      ctx.strokeStyle = c.border + 'aa';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, plotH); ctx.lineTo(W, plotH);
      ctx.stroke();

      // Tick marks + labels
      ctx.font = '8px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'center';
      const freqStart = parseFloat(state.freq_start);
      const freqEnd   = parseFloat(state.freq_end);
      const ticks = 5;
      for (let i = 0; i <= ticks; i++) {
        const x = LABEL_W + (plotW / ticks) * i;
        const freq = freqStart + (freqEnd - freqStart) * (i / ticks);
        ctx.fillStyle = c.textDim;
        ctx.fillText(freq.toFixed(1), x, H - 3);
        ctx.strokeStyle = c.border + '55';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, plotH); ctx.lineTo(x, plotH + 4);
        ctx.stroke();
      }

      // Unit label
      ctx.fillStyle = c.accent1;
      ctx.font = '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(state.freq_unit || 'MHz', W - 2, H - 3);

      // Strategy overlay
      ctx.font = '9px monospace';
      ctx.fillStyle = c.accent2 + 'cc';
      ctx.textAlign = 'left';
      ctx.fillText((state.strategy || '').toUpperCase().replace(/_/g, ' '), 4, 12);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
