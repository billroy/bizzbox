/**
 * Warp Drive Core — concentric pulsing rings with containment field visualization.
 * Canvas RAF loop with radial animations and telemetry readout.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    accent3: get('--color-accent-3'),
    textDim: get('--color-text-dim'),
    textMain:get('--color-text-primary'),
    border:  get('--color-border'),
    error:   get('--color-error'),
    warn:    get('--color-warn'),
  };
}

export default {
  name: 'ActivityWarpDrive',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    function draw(ts) {
      const canvas = canvasRef.value;
      if (!canvas) { rafId = requestAnimationFrame(draw); return; }
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

      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const rings = state.rings || [];
      const phase = state.phase || 0;
      const readings = state.readings || {};
      const alert = state.alert;

      const cx = W * 0.5;
      const cy = H * 0.42;
      const maxR = Math.min(W, H * 0.75) * 0.48;

      // Draw rings from outer to inner
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        const baseR = ring.radius_frac * maxR;
        const pulse = Math.sin(phase * ring.pulse_speed + i * 1.2) * maxR * 0.03;
        const r = Math.max(1, baseR + pulse);

        let color;
        if (ring.status === 'unstable') {
          color = c.error;
        } else if (ring.status === 'flicker') {
          color = (Math.sin(ts / 100 + i) > 0) ? c.accent1 : c.warn;
        } else {
          color = c.accent1;
        }

        // Ring glow
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = ring.intensity * 0.4;
        ctx.stroke();

        // Brighter inner line
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = ring.intensity * 0.9;
        ctx.stroke();

        // Pulsing particles along ring
        const numParticles = 6 + i * 2;
        for (let p = 0; p < numParticles; p++) {
          const angle = (phase * ring.pulse_speed * 0.5) + (p / numParticles) * Math.PI * 2;
          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;
          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = ring.intensity * 0.7;
          ctx.fill();
        }

        // Ring label
        ctx.globalAlpha = 0.4;
        ctx.font = '7px monospace';
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(ring.label, cx + r + 4, cy);
      }

      ctx.globalAlpha = 1;

      // Core center glow
      const coreGlow = Math.sin(phase * 2) * 0.3 + 0.7;
      const coreR = maxR * 0.08;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3);
      grad.addColorStop(0, c.accent1 + 'cc');
      grad.addColorStop(0.5, c.accent1 + '33');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.globalAlpha = coreGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Core dot
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fillStyle = c.accent1;
      ctx.fill();

      // Alert banner
      if (alert) {
        const alertColor = alert.includes('WARNING') ? c.error : c.warn;
        const blink = Math.sin(ts / 200) > 0;
        if (blink) {
          ctx.font = 'bold 11px monospace';
          ctx.fillStyle = alertColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(alert, W / 2, 6);
        }
      }

      // Readings at bottom
      const entries = Object.entries(readings);
      if (entries.length > 0) {
        const readingY = H - 6;
        ctx.font = '8px monospace';
        ctx.textBaseline = 'bottom';

        // Calculate column width
        const maxCols = Math.min(entries.length, 6);
        const colW = W / maxCols;

        entries.slice(0, maxCols).forEach(([key, val], i) => {
          const label = key.replace(/_/g, ' ').toUpperCase();
          const display = typeof val === 'number' ? val.toFixed(1) : val;
          ctx.textAlign = 'center';
          ctx.fillStyle = c.textDim;
          ctx.fillText(label, colW * i + colW / 2, readingY - 10);
          ctx.fillStyle = c.accent1;
          ctx.fillText(display, colW * i + colW / 2, readingY);
        });
      }

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
