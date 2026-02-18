/**
 * Conway's Game of Life — canvas-based cellular automaton renderer.
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

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default {
  name: 'ActivityGameOfLife',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;
    let prevCells = null;  // track previous frame for birth glow

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) { rafId = requestAnimationFrame(draw); return; }

      const state = props.activity?.state;
      if (!state) { rafId = requestAnimationFrame(draw); return; }

      const cells = state.cells;        // sparse [[r,c], ...] array
      const gridCols = state.cols || 80;
      const gridRows = state.rows || 60;

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr;
        canvas.height = H * dpr;
      }

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const colors = getThemeColors();

      // ── Background ──
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, W, H);

      // ── Grid sizing ──
      const cellW = W / gridCols;
      const cellH = H / gridRows;

      // Build a Set of current live cell keys for fast lookup
      const liveSet = new Set();
      if (cells) {
        for (const pair of cells) {
          liveSet.add(pair[0] * gridCols + pair[1]);
        }
      }

      // Build set of previous-frame live cells for birth detection
      const prevSet = prevCells || new Set();

      // ── Draw subtle grid lines ──
      ctx.strokeStyle = colors.border + '18';
      ctx.lineWidth = 0.5;
      for (let c = 1; c < gridCols; c++) {
        const x = c * cellW;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let r = 1; r < gridRows; r++) {
        const y = r * cellH;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // ── Draw live cells ──
      const pad = 0.5;  // small padding between cells
      for (const pair of (cells || [])) {
        const r = pair[0];
        const c = pair[1];
        const key = r * gridCols + c;
        const isBirth = !prevSet.has(key);

        const x = c * cellW + pad;
        const y = r * cellH + pad;
        const w = cellW - pad * 2;
        const h = cellH - pad * 2;

        if (isBirth) {
          // Newly born cell — bright glow
          ctx.fillStyle = colors.accent2 || colors.accent1;
          ctx.shadowBlur = 6;
          ctx.shadowColor = colors.accent2 || colors.accent1;
        } else {
          ctx.fillStyle = colors.accent1;
          ctx.shadowBlur = 0;
        }

        ctx.fillRect(x, y, w, h);
      }
      ctx.shadowBlur = 0;

      // Store current cells as previous for next frame
      prevCells = liveSet;

      // ── HUD: generation + population ──
      const strategy = (state.strategy || '').toUpperCase().replace(/_/g, ' ');
      const gen = state.generation || 0;
      const pop = state.population || 0;

      ctx.font = '9px monospace';
      ctx.textBaseline = 'bottom';

      // Bottom-left: strategy
      ctx.textAlign = 'left';
      ctx.fillStyle = colors.textDim;
      ctx.fillText(strategy, 6, H - 6);

      // Bottom-right: generation + population
      ctx.textAlign = 'right';
      ctx.fillStyle = colors.textDim;
      ctx.fillText(`GEN ${gen}  POP ${pop}`, W - 6, H - 6);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
