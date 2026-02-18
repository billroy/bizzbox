/**
 * 256-QAM (and other QAM orders) constellation diagram renderer.
 * Canvas-based, draws received IQ symbols as scatter plot over ideal grid.
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
    error:   get('--color-error') || '#ff4444',
  };
}

/** Ideal grid points for 256-QAM (16×16). */
function idealPoints256() {
  const pts = [];
  const levels = [-15,-13,-11,-9,-7,-5,-3,-1,1,3,5,7,9,11,13,15];
  const scale = 1.0 / 15.0;
  for (const i of levels) for (const q of levels) pts.push([i * scale, q * scale]);
  return pts;
}

/** Ideal grid points for 64-QAM. */
function idealPoints64() {
  const pts = [];
  const levels = [-7,-5,-3,-1,1,3,5,7];
  const scale = 1.0 / 7.0;
  for (const i of levels) for (const q of levels) pts.push([i * scale, q * scale]);
  return pts;
}

/** Ideal grid points for 16-QAM. */
function idealPoints16() {
  const pts = [];
  const levels = [-3,-1,1,3];
  const scale = 1.0 / 3.0;
  for (const i of levels) for (const q of levels) pts.push([i * scale, q * scale]);
  return pts;
}

function idealPointsBpskQpsk() {
  return [[-1,0],[1,0],[-0.5,-0.5],[-0.5,0.5],[0.5,-0.5],[0.5,0.5]];
}

function getIdealPoints(strategy) {
  if (strategy === '256qam_clean' || strategy === '256qam_noisy') return idealPoints256();
  if (strategy === '64qam') return idealPoints64();
  if (strategy === '16qam') return idealPoints16();
  return idealPointsBpskQpsk();
}

export default {
  name: 'ActivityQamConstellation',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) { rafId = requestAnimationFrame(draw); return; }
      const state = props.activity?.state;
      const points = state?.points;
      if (!points) { rafId = requestAnimationFrame(draw); return; }

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

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const MARGIN = 18;
      const plotW = W - 2 * MARGIN;
      const plotH = H - 2 * MARGIN;
      const cx = MARGIN + plotW / 2;
      const cy = MARGIN + plotH / 2;
      // IQ range: -1.2 to 1.2
      const RANGE = 1.2;
      const toX = (i) => cx + (i / RANGE) * (plotW / 2);
      const toY = (q) => cy - (q / RANGE) * (plotH / 2);  // q up = y down

      // Grid lines at 0
      ctx.strokeStyle = c.border + '66';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(MARGIN, cy); ctx.lineTo(MARGIN + plotW, cy);
      ctx.moveTo(cx, MARGIN); ctx.lineTo(cx, MARGIN + plotH);
      ctx.stroke();

      // Outer boundary box
      ctx.strokeStyle = c.border + '44';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(MARGIN, MARGIN, plotW, plotH);

      // Axis labels
      ctx.font = '8px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'center';
      ctx.fillText('I', W - 5, cy + 3);
      ctx.textAlign = 'left';
      ctx.fillText('Q', cx + 3, MARGIN + 9);

      // Ideal grid dots (very dim)
      const strategy = state.strategy || '';
      const ideal = getIdealPoints(strategy);
      const idealR = strategy.includes('256') ? 1.0 : strategy.includes('64') ? 1.5 : 2.5;
      ctx.fillStyle = c.border + 'aa';
      for (const [i, q] of ideal) {
        ctx.beginPath();
        ctx.arc(toX(i), toY(q), idealR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Received symbols — colour by distance from nearest ideal (EVM visualisation)
      const evm = state.evm || 4;
      const dotR = strategy.includes('256') ? 1.2 : strategy.includes('64') ? 1.5 : 2.0;
      ctx.globalAlpha = 0.75;
      for (const [i, q] of points) {
        // Find nearest ideal point (fast: skip for 256 since grid is regular)
        // Use accent2 for points; shift hue toward error colour for high-EVM outliers
        ctx.fillStyle = c.accent2;
        ctx.beginPath();
        ctx.arc(toX(i), toY(q), dotR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // EVM readout
      ctx.font = '9px monospace';
      ctx.fillStyle = evm > 8 ? c.error : c.accent1;
      ctx.textAlign = 'left';
      ctx.fillText(`EVM ${evm.toFixed(1)}%`, 4, H - 4);

      // Strategy label
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'right';
      ctx.fillText(strategy.toUpperCase().replace(/_/g, ' '), W - 4, H - 4);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
