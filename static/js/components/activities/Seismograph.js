/** Three-axis rolling seismic display. Samples arrive in eight-point deltas. */
function themeColors() {
  const style = getComputedStyle(document.documentElement);
  const color = name => style.getPropertyValue(name).trim();
  return {
    bg: color('--color-surface'),
    surface: color('--color-surface-2'),
    accent: color('--color-accent-1'),
    secondary: color('--color-accent-2'),
    text: color('--color-text-primary'),
    dim: color('--color-text-dim'),
    border: color('--color-border'),
    warn: color('--color-warn'),
    error: color('--color-error'),
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
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (!state || !W || !H) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = themeColors();
      const channels = state.channels || [];
      const compact = H < 120 || W < 170;
      const pad = 7;
      const headerH = compact ? 17 : 25;
      const footerH = compact ? 13 : 20;
      const plotTop = headerH + 2;
      const plotBottom = H - footerH - 2;
      const plotH = Math.max(0, plotBottom - plotTop);
      const labelW = compact ? 17 : 26;
      const plotX = pad + labelW;
      const plotW = Math.max(0, W - plotX - pad);
      const event = state.magnitude != null;
      const peak = Math.max(0, Number(state.peak) || 0);
      const active = event || peak > 0.3;

      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = c.surface;
      ctx.fillRect(0, 0, W, headerH);
      ctx.fillRect(0, H - footerH, W, footerH);
      ctx.strokeStyle = c.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, headerH + 0.5);
      ctx.lineTo(W, headerH + 0.5);
      ctx.moveTo(0, H - footerH + 0.5);
      ctx.lineTo(W, H - footerH + 0.5);
      ctx.stroke();

      // The status lamp and readout remain visible even in small grid cells.
      ctx.beginPath();
      ctx.arc(pad + 3, headerH / 2, 3, 0, Math.PI * 2);
      ctx.fillStyle = active ? c.error : c.accent;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = active ? 10 : 4;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = 'bold ' + (compact ? 9 : 10) + 'px monospace';
      ctx.fillStyle = active ? c.error : c.text;
      ctx.fillText(active ? 'EVENT' : 'MONITORING', pad + 13, headerH / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = event ? c.error : c.secondary;
      ctx.font = 'bold ' + (compact ? 10 : 14) + 'px monospace';
      ctx.fillText(event ? 'M ' + Number(state.magnitude).toFixed(1) : 'LIVE', W - pad, headerH / 2);

      if (channels.length && plotW > 4 && plotH > 4) {
        const gap = compact ? 2 : 4;
        const chH = (plotH - gap * (channels.length - 1)) / channels.length;
        channels.forEach((ch, ci) => {
          const top = plotTop + ci * (chH + gap);
          const mid = top + chH / 2;
          const samples = ch.samples || [];
          const amplitude = Math.max(1, chH * 0.43);
          const maxAbs = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
          const hot = maxAbs > 0.3;

          ctx.fillStyle = c.surface;
          ctx.fillRect(plotX, top, plotW, chH);
          ctx.strokeStyle = c.border;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          for (let i = 0; i <= 6; i++) {
            const x = plotX + i * plotW / 6;
            ctx.moveTo(x, top);
            ctx.lineTo(x, top + chH);
          }
          ctx.moveTo(plotX, mid);
          ctx.lineTo(plotX + plotW, mid);
          ctx.stroke();

          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold ' + (compact ? 9 : 11) + 'px monospace';
          ctx.fillStyle = hot ? c.error : c.accent;
          ctx.fillText(ch.name || '', pad, mid);

          if (samples.length < 2) return;
          ctx.save();
          ctx.beginPath();
          ctx.rect(plotX, top, plotW, chH);
          ctx.clip();
          ctx.beginPath();
          samples.forEach((sample, i) => {
            const x = plotX + i * plotW / (samples.length - 1);
            const y = mid - Math.max(-1, Math.min(1, sample)) * amplitude;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.strokeStyle = hot ? c.error : (ci === 1 ? c.secondary : c.accent);
          ctx.lineWidth = hot ? 1.8 : 1.3;
          ctx.shadowColor = ctx.strokeStyle;
          ctx.shadowBlur = hot ? 8 : 3;
          ctx.stroke();
          ctx.restore();
        });
      }

      ctx.textBaseline = 'middle';
      ctx.font = (compact ? 8 : 9) + 'px monospace';
      ctx.fillStyle = c.dim;
      ctx.textAlign = 'left';
      ctx.fillText(state.station || 'STATION', pad, H - footerH / 2);
      ctx.textAlign = 'right';
      const detail = event && !compact && state.depth_km != null
        ? state.depth_km + ' KM DEPTH'
        : 'PEAK ' + peak.toFixed(2);
      ctx.fillStyle = active ? c.warn : c.dim;
      ctx.fillText(detail, W - pad, H - footerH / 2);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId !== null) cancelAnimationFrame(rafId); });
    return { canvasRef };
  },
  template: '<canvas ref="canvasRef" class="activity-canvas"></canvas>',
};
