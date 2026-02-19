/**
 * Seismograph — canvas-based 3-channel waveform display with magnitude badge,
 * threshold lines, and scroll-left rendering.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    textPri: get('--color-text-primary'),
    textDim: get('--color-text-dim'),
    error:   get('--color-error'),
    warn:    get('--color-warn'),
    border:  get('--color-border'),
  };
}

export default {
  name: 'ActivitySeismograph',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) return;
      const state = props.activity?.state;
      if (!state) { rafId = requestAnimationFrame(draw); return; }

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

      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const channels = state.channels || [];
      const nCh = channels.length || 3;
      const pad = 6;
      const labelW = 20;
      // 3 channels each ~30% height with 3% gaps
      const totalH = H - pad * 2;
      const gap = totalH * 0.03;
      const chH = (totalH - gap * (nCh - 1)) * 0.30;
      const THRESHOLD = 0.3;

      channels.forEach((ch, ci) => {
        const chTop = pad + ci * (chH + gap);
        const chMid = chTop + chH / 2;
        const chBot = chTop + chH;
        const waveX = pad + labelW;
        const waveW = W - waveX - pad;

        // Channel background
        ctx.fillStyle = c.border + '22';
        ctx.fillRect(waveX, chTop, waveW, chH);

        // Channel label
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = c.accent1;
        ctx.textAlign = 'center';
        ctx.fillText(ch.name || '', pad + labelW / 2, chMid + 4);

        // Center line (dashed, dim)
        ctx.strokeStyle = c.textDim + '66';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(waveX, chMid);
        ctx.lineTo(waveX + waveW, chMid);
        ctx.stroke();

        // Threshold lines at ±0.3 (dashed, warn)
        const threshY = chH / 2 * THRESHOLD;
        ctx.strokeStyle = c.warn + '88';
        ctx.setLineDash([2, 4]);
        [chMid - threshY, chMid + threshY].forEach(ty => {
          ctx.beginPath();
          ctx.moveTo(waveX, ty);
          ctx.lineTo(waveX + waveW, ty);
          ctx.stroke();
        });
        ctx.setLineDash([]);

        // Waveform polyline
        const samples = ch.samples || [];
        if (samples.length < 2) return;
        const n = samples.length;
        const xStep = waveW / (n - 1);
        const amplitude = chH / 2 - 2;

        ctx.beginPath();
        samples.forEach((s, i) => {
          const px = waveX + i * xStep;
          const py = chMid - s * amplitude;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });

        // Check if any sample exceeds threshold for color choice
        const maxAbs = Math.max(...samples.map(Math.abs));
        ctx.strokeStyle = maxAbs > THRESHOLD ? c.error : c.accent1;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // ── Magnitude badge (upper right) ────────────────────────────────
      const mag = state.magnitude;
      if (mag != null) {
        const badgeX = W - pad - 2;
        const badgeY = pad + 4;
        const magText = 'M ' + Number(mag).toFixed(1);
        ctx.font = 'bold 16px monospace';
        const tw = ctx.measureText(magText).width;

        if (mag > 3) {
          // Error glow
          ctx.shadowColor = c.error;
          ctx.shadowBlur = 12;
          ctx.fillStyle = c.error;
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = c.accent2;
        }
        ctx.textAlign = 'right';
        ctx.fillText(magText, badgeX, badgeY + 14);
        ctx.shadowBlur = 0;

        if (mag != null) {
          ctx.font = '9px monospace';
          ctx.fillStyle = c.textDim;
          ctx.fillText(state.depth_km != null ? state.depth_km + ' km depth' : '', badgeX, badgeY + 26);
        }
      }

      // ── Station name bottom left ─────────────────────────────────────
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.fillText(state.station || '', pad, H - pad);

      // ── Strategy bottom right ────────────────────────────────────────
      ctx.textAlign = 'right';
      ctx.fillText(state.strategy || '', W - pad, H - pad);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
