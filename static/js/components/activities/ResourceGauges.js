/**
 * System resource gauges — arc dial display.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    surface2:get('--color-surface-2'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    warn:    get('--color-warn'),
    error:   get('--color-error'),
    textDim: get('--color-text-dim'),
    textMain:get('--color-text-primary'),
    border:  get('--color-border'),
  };
}

function gaugeColor(value, min, max, warn, crit, c) {
  const pct = (value - min) / (max - min);
  const warnPct = (warn - min) / (max - min);
  const critPct = (crit - min) / (max - min);
  // Handle inverted gauges (warn is low)
  if (warn < (min + max) / 2) {
    if (pct < critPct) return c.error;
    if (pct < warnPct) return c.warn;
    return c.accent2;
  }
  if (pct >= critPct) return c.error;
  if (pct >= warnPct) return c.warn;
  return c.accent2;
}

function drawGauge(ctx, cx, cy, r, gauge, c) {
  const { value, min, max, warn, crit, label, unit } = gauge;
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const startAngle = Math.PI * 0.75;
  const totalAngle = Math.PI * 1.5;
  const endAngle = startAngle + totalAngle * pct;
  const col = gaugeColor(value, min, max, warn, crit, c);

  // Track
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, startAngle + totalAngle);
  ctx.strokeStyle = c.border + '66';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Fill
  if (pct > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.strokeStyle = col;
    ctx.lineWidth = 5;
    ctx.stroke();

    // Glow tip
    const ex = cx + Math.cos(endAngle) * r;
    const ey = cy + Math.sin(endAngle) * r;
    ctx.beginPath();
    ctx.arc(ex, ey, 4, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  }

  // Value text
  let displayVal;
  if (Math.abs(value) >= 1000) {
    displayVal = (value / 1000).toFixed(1) + 'K';
  } else if (Math.abs(value) < 10) {
    displayVal = value.toFixed(2);
  } else {
    displayVal = value.toFixed(1);
  }
  ctx.font = `bold ${Math.max(10, r * 0.45)}px monospace`;
  ctx.fillStyle = col;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(displayVal + (unit || ''), cx, cy + 2);

  // Label
  ctx.font = `${Math.max(8, r * 0.3)}px monospace`;
  ctx.fillStyle = c.textDim;
  ctx.fillText(label, cx, cy + r * 0.65);
  ctx.textBaseline = 'alphabetic';
}

export default {
  name: 'ActivityResourceGauges',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) return;
      const state = props.activity?.state;
      const gauges = state?.gauges;
      if (!gauges || gauges.length === 0) { rafId = requestAnimationFrame(draw); return; }

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

      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const n = gauges.length;
      const cols = n <= 3 ? n : Math.ceil(n / 2);
      const rows = Math.ceil(n / cols);
      const cellW = W / cols;
      const cellH = H / rows;
      const r = Math.min(cellW, cellH) * 0.32;

      for (let i = 0; i < n; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = cellW * col + cellW / 2;
        const cy = cellH * row + cellH / 2;
        drawGauge(ctx, cx, cy, r, gauges[i], c);
      }

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
