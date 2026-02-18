/**
 * Real-time scrolling line graph — canvas renderer.
 * Server sends array of data points and y-range; client draws
 * a smooth line graph with grid, current value, and gradient fill.
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
    border:  get('--color-border'),
  };
}

export default {
  name: 'ActivityGraph',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) return;
      const state = props.activity?.state;
      const points = state?.points;
      if (!points || points.length < 2) { rafId = requestAnimationFrame(draw); return; }

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
      const yRange = state.y_range || [0, 100];
      const yMin = yRange[0];
      const yMax = yRange[1];
      const strategy = state.strategy || '';

      // Margins
      const mLeft = 50, mRight = 12, mTop = 10, mBottom = 24;
      const gW = W - mLeft - mRight;
      const gH = H - mTop - mBottom;

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      const gridY = 5;
      ctx.strokeStyle = c.border + '44';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 4]);
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= gridY; i++) {
        const y = mTop + (gH / gridY) * i;
        ctx.beginPath(); ctx.moveTo(mLeft, y); ctx.lineTo(mLeft + gW, y); ctx.stroke();
        const val = yMax - (yMax - yMin) * (i / gridY);
        ctx.fillText(val.toFixed(yMax - yMin > 10 ? 0 : 1), mLeft - 6, y);
      }
      ctx.setLineDash([]);

      // Y-axis label
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(10, mTop + gH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(state.y_label || '', 0, 0);
      ctx.restore();

      // Map value to Y coordinate
      function valToY(v) {
        const t = (v - yMin) / (yMax - yMin);
        return mTop + gH * (1 - t);
      }

      // Build path
      const step = gW / (points.length - 1);
      ctx.beginPath();
      ctx.moveTo(mLeft, valToY(points[0]));
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(mLeft + i * step, valToY(points[i]));
      }

      // Gradient fill under line
      const fillPath = new Path2D();
      fillPath.moveTo(mLeft, valToY(points[0]));
      for (let i = 1; i < points.length; i++) {
        fillPath.lineTo(mLeft + i * step, valToY(points[i]));
      }
      fillPath.lineTo(mLeft + (points.length - 1) * step, mTop + gH);
      fillPath.lineTo(mLeft, mTop + gH);
      fillPath.closePath();

      const grad = ctx.createLinearGradient(0, mTop, 0, mTop + gH);
      grad.addColorStop(0, c.accent1 + '44');
      grad.addColorStop(1, c.accent1 + '05');
      ctx.fillStyle = grad;
      ctx.fill(fillPath);

      // Line stroke with glow
      ctx.shadowBlur = 6;
      ctx.shadowColor = c.accent2;
      ctx.strokeStyle = c.accent2;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Current value dot
      const lastX = mLeft + (points.length - 1) * step;
      const lastY = valToY(points[points.length - 1]);
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fillStyle = c.accent2;
      ctx.fill();

      // Current value label
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = c.accent2;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      const cur = state.current ?? points[points.length - 1];
      const fmt = state.format || '{:.2f}';
      const formatted = fmt.replace('{:.2f}', cur.toFixed(2))
        .replace('{:.1f}', cur.toFixed(1))
        .replace('{:.0f}', Math.round(cur).toString())
        .replace('{:.3f}', cur.toFixed(3));
      ctx.fillText(formatted, lastX - 6, lastY - 4);

      // Strategy label
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(strategy.toUpperCase().replace(/_/g, ' '), mLeft, H - 4);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
