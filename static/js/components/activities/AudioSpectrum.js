/**
 * Audio frequency spectrum / equalizer — canvas renderer.
 * Server sends band values (0–1); client renders bars, curves, or waveforms
 * depending on strategy.
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
    border:  get('--color-border'),
  };
}

export default {
  name: 'ActivityAudioSpectrum',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    // Smoothed band values for interpolation between server frames
    let smoothBands = null;

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) return;
      const state = props.activity?.state;
      const bands = state?.bands;
      if (!bands || bands.length === 0) { rafId = requestAnimationFrame(draw); return; }

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (W === 0 || H === 0) { rafId = requestAnimationFrame(draw); return; }
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr; canvas.height = H * dpr;
      }

      // Smooth toward target bands
      if (!smoothBands || smoothBands.length !== bands.length) {
        smoothBands = [...bands];
      } else {
        for (let i = 0; i < bands.length; i++) {
          smoothBands[i] += (bands[i] - smoothBands[i]) * 0.25;
        }
      }

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = getThemeColors();
      const strategy = state.strategy || 'eq_bars';

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const pad = 4;
      const areaW = W - pad * 2;
      const areaH = H - pad * 2 - 14; // room for label
      const baseY = pad + areaH;

      if (strategy === 'smooth_curve') {
        drawSmoothCurve(ctx, smoothBands, c, pad, baseY, areaW, areaH);
      } else if (strategy === 'mirrored_spectrum') {
        drawMirrored(ctx, smoothBands, c, pad, W, H, areaW);
      } else if (strategy === 'waveform_peaks') {
        drawBars(ctx, smoothBands, c, pad, baseY, areaW, areaH, true, state.peaks);
      } else {
        // eq_bars, octave_bands
        drawBars(ctx, smoothBands, c, pad, baseY, areaW, areaH, false, null);
      }

      // Strategy label
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(strategy.toUpperCase().replace(/_/g, ' '), 6, H - 4);

      rafId = requestAnimationFrame(draw);
    }

    function drawBars(ctx, bands, c, pad, baseY, areaW, areaH, showPeaks, peaks) {
      const n = bands.length;
      const gap = Math.max(1, Math.min(3, areaW / n * 0.15));
      const barW = (areaW - gap * (n - 1)) / n;

      for (let i = 0; i < n; i++) {
        const x = pad + i * (barW + gap);
        const h = bands[i] * areaH;

        // Gradient fill per bar
        const grad = ctx.createLinearGradient(x, baseY, x, baseY - h);
        grad.addColorStop(0, c.accent1);
        grad.addColorStop(1, c.accent2);
        ctx.fillStyle = grad;
        ctx.fillRect(x, baseY - h, barW, h);

        // Glow on top
        ctx.shadowBlur = 6;
        ctx.shadowColor = c.accent1;
        ctx.fillRect(x, baseY - h, barW, Math.min(2, h));
        ctx.shadowBlur = 0;

        // Peak hold indicator
        if (showPeaks && peaks && peaks[i] !== undefined) {
          const py = baseY - peaks[i] * areaH;
          ctx.fillStyle = c.accent2;
          ctx.fillRect(x, py - 1, barW, 2);
        }
      }
    }

    function drawSmoothCurve(ctx, bands, c, pad, baseY, areaW, areaH) {
      const n = bands.length;
      const step = areaW / (n - 1);

      // Gradient fill under curve
      ctx.beginPath();
      ctx.moveTo(pad, baseY);
      for (let i = 0; i < n; i++) {
        const x = pad + i * step;
        const y = baseY - bands[i] * areaH;
        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          const prevX = pad + (i - 1) * step;
          const cpx = (prevX + x) / 2;
          ctx.bezierCurveTo(cpx, baseY - bands[i - 1] * areaH, cpx, y, x, y);
        }
      }
      ctx.lineTo(pad + areaW, baseY);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, baseY - areaH, 0, baseY);
      grad.addColorStop(0, c.accent1 + '88');
      grad.addColorStop(1, c.accent1 + '11');
      ctx.fillStyle = grad;
      ctx.fill();

      // Stroke the curve
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = pad + i * step;
        const y = baseY - bands[i] * areaH;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevX = pad + (i - 1) * step;
          const cpx = (prevX + x) / 2;
          ctx.bezierCurveTo(cpx, baseY - bands[i - 1] * areaH, cpx, y, x, y);
        }
      }
      ctx.shadowBlur = 6;
      ctx.shadowColor = c.accent2;
      ctx.strokeStyle = c.accent2;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    function drawMirrored(ctx, bands, c, pad, W, H, areaW) {
      const midY = H / 2;
      const halfH = midY - pad - 7;
      const n = bands.length;
      const gap = Math.max(1, Math.min(2, areaW / n * 0.12));
      const barW = (areaW - gap * (n - 1)) / n;

      for (let i = 0; i < n; i++) {
        const x = pad + i * (barW + gap);
        const h = bands[i] * halfH;

        const grad = ctx.createLinearGradient(x, midY - h, x, midY + h);
        grad.addColorStop(0, c.accent2);
        grad.addColorStop(0.5, c.accent1);
        grad.addColorStop(1, c.accent2);
        ctx.fillStyle = grad;

        // Top half
        ctx.fillRect(x, midY - h, barW, h);
        // Bottom half (mirror)
        ctx.fillRect(x, midY, barW, h);
      }

      // Center line
      ctx.strokeStyle = c.accent1 + '44';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pad, midY);
      ctx.lineTo(pad + areaW, midY);
      ctx.stroke();
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
