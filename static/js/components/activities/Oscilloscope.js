/**
 * Signal waveform oscilloscope renderer — canvas with continuous redraw.
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
  };
}

export default {
  name: 'ActivityOscilloscope',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) return;
      const state = props.activity?.state;
      const samples = state?.samples;
      if (!samples || samples.length === 0) { rafId = requestAnimationFrame(draw); return; }

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

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = c.border + '66';
      ctx.lineWidth = 0.5;
      const gridX = 8, gridY = 4;
      for (let i = 0; i <= gridX; i++) {
        const x = (W / gridX) * i;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let i = 0; i <= gridY; i++) {
        const y = (H / gridY) * i;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Waveform
      const midY = H / 2;
      const ampScale = H * 0.38;
      ctx.beginPath();
      ctx.moveTo(0, midY - samples[0] * ampScale);
      const step = W / (samples.length - 1);
      for (let i = 1; i < samples.length; i++) {
        ctx.lineTo(i * step, midY - samples[i] * ampScale);
      }

      // Glow effect — draw thicker dimmer line first
      ctx.shadowBlur = 8;
      ctx.shadowColor = c.accent2;
      ctx.strokeStyle = c.accent2 + '66';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Main line
      ctx.beginPath();
      ctx.moveTo(0, midY - samples[0] * ampScale);
      for (let i = 1; i < samples.length; i++) {
        ctx.lineTo(i * step, midY - samples[i] * ampScale);
      }
      ctx.shadowBlur = 0;
      ctx.strokeStyle = c.accent2;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Strategy label
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.fillText((state.strategy || '').toUpperCase().replace(/_/g, ' '), 6, H - 6);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
