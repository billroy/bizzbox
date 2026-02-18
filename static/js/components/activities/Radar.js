/**
 * Radar scope sweep — canvas with continuous sweep animation, server-driven blips.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    textDim: get('--color-text-dim'),
    textMain:get('--color-text-primary'),
    warn:    get('--color-warn'),
    error:   get('--color-error'),
    border:  get('--color-border'),
  };
}

export default {
  name: 'ActivityRadar',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;
    let sweepAngle = 0;
    let lastTime = null;

    function draw(ts) {
      const canvas = canvasRef.value;
      if (!canvas) return;
      const state = props.activity?.state;
      if (!state) { rafId = requestAnimationFrame(draw); return; }

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
      const cx = W / 2, cy = H / 2;
      const R = Math.min(cx, cy) - 20;

      // Interpolate sweep angle client-side
      if (lastTime !== null) {
        const dt = (ts - lastTime) / 1000;
        sweepAngle += (state.sweep_speed || 1.5) * dt;
      }
      lastTime = ts;

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      // Phosphor trail (fade effect)
      ctx.fillStyle = c.bg + 'cc';
      ctx.fillRect(0, 0, W, H);

      // Range rings
      const rings = state.range_rings || 4;
      for (let i = 1; i <= rings; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (R * i) / rings, 0, Math.PI * 2);
        ctx.strokeStyle = c.accent1 + '33';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Cross hairs
      ctx.strokeStyle = c.accent1 + '33';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      ctx.setLineDash([]);

      // Sweep gradient
      const sa = sweepAngle % (Math.PI * 2);
      const sweepLen = Math.PI * 0.5;
      const grad = ctx.createConicalGradient
        ? null  // not widely supported; use manual wedge
        : null;

      // Draw sweep wedge manually
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, sa - sweepLen, sa, false);
      ctx.closePath();
      const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      sweepGrad.addColorStop(0, c.accent2 + '00');
      sweepGrad.addColorStop(0.7, c.accent2 + '44');
      sweepGrad.addColorStop(1.0, c.accent2 + '00');
      ctx.fillStyle = sweepGrad;
      ctx.fill();
      ctx.restore();

      // Sweep line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sa) * R, cy + Math.sin(sa) * R);
      ctx.strokeStyle = c.accent2;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Blips
      for (const blip of (state.blips || [])) {
        const fade = Math.max(0, 1 - blip.age / 200);
        if (fade < 0.05) continue;
        const bx = cx + Math.cos(blip.angle) * blip.distance * R;
        const by = cy + Math.sin(blip.angle) * blip.distance * R;
        const alpha = Math.floor(fade * blip.intensity * 255).toString(16).padStart(2, '0');

        // Glow
        ctx.beginPath();
        ctx.arc(bx, by, 10, 0, Math.PI * 2);
        ctx.fillStyle = c.accent2 + '22';
        ctx.fill();

        // Blip dot
        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI * 2);
        ctx.fillStyle = c.accent2 + alpha;
        ctx.fill();

        // Label
        if (fade > 0.5) {
          ctx.font = '9px monospace';
          ctx.fillStyle = c.textMain + alpha;
          ctx.textAlign = 'left';
          ctx.fillText(blip.label, bx + 7, by + 3);
        }
      }

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = c.accent1;
      ctx.fill();

      // Border circle
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = c.accent1 + '66';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
