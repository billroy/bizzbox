/**
 * Binary/hex dump — canvas renderer with grid layout and change highlighting.
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
    border:  get('--color-border'),
  };
}

export default {
  name: 'ActivityHexDump',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;
    // Track previous hex bytes per row for change highlighting
    let prevHex = [];     // array of hex strings per row
    let changeMap = [];   // array of arrays: age per byte (0 = no change, >0 = frames since change)

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) return;
      const state = props.activity?.state;
      const rows = state?.rows;
      if (!rows || rows.length === 0) { rafId = requestAnimationFrame(draw); return; }

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

      // Detect changes
      const newHex = rows.map(r => r.hex);
      if (changeMap.length !== rows.length) {
        changeMap = rows.map(() => new Array(16).fill(0));
      }
      for (let r = 0; r < rows.length; r++) {
        if (prevHex[r] && prevHex[r] !== newHex[r]) {
          // Compare individual bytes
          const oldBytes = prevHex[r].split(' ');
          const newBytes = newHex[r].split(' ');
          for (let b = 0; b < 16; b++) {
            if (oldBytes[b] !== newBytes[b]) {
              changeMap[r][b] = 60; // highlight for ~60 frames (~1s)
            }
          }
        }
        // Decay change highlights
        for (let b = 0; b < 16; b++) {
          if (changeMap[r][b] > 0) changeMap[r][b]--;
        }
      }
      prevHex = newHex;

      // Layout constants
      const fontSize = Math.max(9, Math.min(12, W / 55));
      ctx.font = `${fontSize}px monospace`;
      const charW = ctx.measureText('0').width;
      const rowH = fontSize * 1.6;
      const padL = 4;
      const padT = rowH + 4; // header row
      const offsetW = charW * 10;   // "0x00000000  "
      const byteW = charW * 3;      // "FF "
      const hexBlockW = byteW * 16;
      const asciiX = padL + offsetW + hexBlockW + charW;

      // Header row
      ctx.fillStyle = c.textDim;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText('OFFSET', padL, 4);
      for (let b = 0; b < 16; b++) {
        ctx.fillText(b.toString(16).toUpperCase().padStart(2, '0'), padL + offsetW + b * byteW, 4);
      }
      ctx.fillText('ASCII', asciiX, 4);

      // Separator line
      ctx.strokeStyle = c.border + '60';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(padL, padT - 2);
      ctx.lineTo(W - 4, padT - 2);
      ctx.stroke();

      // Visible rows
      const maxRows = Math.floor((H - padT) / rowH);
      const startRow = Math.max(0, rows.length - maxRows);

      for (let ri = startRow; ri < rows.length; ri++) {
        const row = rows[ri];
        const y = padT + (ri - startRow) * rowH;
        if (y + rowH > H + 2) break;

        // Offset column
        ctx.fillStyle = c.accent1;
        ctx.fillText(row.offset, padL, y);

        // Hex bytes
        const bytes = row.hex.split(' ');
        const cmRow = changeMap[ri] || [];
        for (let b = 0; b < bytes.length; b++) {
          const bx = padL + offsetW + b * byteW;
          // Change highlight background
          if (cmRow[b] > 0) {
            const alpha = Math.min(1, cmRow[b] / 30) * 0.35;
            ctx.fillStyle = c.accent2;
            ctx.globalAlpha = alpha;
            ctx.fillRect(bx - 1, y - 1, byteW - 2, rowH - 2);
            ctx.globalAlpha = 1;
          }
          ctx.fillStyle = cmRow[b] > 0 ? c.accent2 : c.textPri;
          ctx.fillText(bytes[b], bx, y);
        }

        // ASCII column
        const ascii = row.ascii || '';
        for (let a = 0; a < ascii.length; a++) {
          const ch = ascii[a];
          const isPrintable = ch !== '.';
          ctx.fillStyle = isPrintable ? c.textPri : (c.textDim + '60');
          ctx.fillText(isPrintable ? ch : '\u00B7', asciiX + a * charW, y);
        }

        // Subtle grid lines
        if (ri > startRow) {
          ctx.strokeStyle = c.border + '18';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(padL, y - 1);
          ctx.lineTo(W - 4, y - 1);
          ctx.stroke();
        }
      }

      // Strategy label
      const strategy = (state.strategy || '').toUpperCase().replace(/_/g, ' ');
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(strategy, W - 6, H - 4);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
