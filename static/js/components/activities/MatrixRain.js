/**
 * Matrix-style falling character rain — canvas with local animation.
 * Server provides column data (chars, head_y, drop_speed); client draws
 * columns smoothly with bright leading edges and fading tails.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    textDim: get('--color-text-dim'),
  };
}

export default {
  name: 'ActivityMatrixRain',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) return;
      const state = props.activity?.state;
      const columns = state?.columns;
      if (!columns || columns.length === 0) { rafId = requestAnimationFrame(draw); return; }

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
      const strategy = state.strategy || 'classic_green';

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const colW = W / columns.length;
      const fontSize = Math.max(9, Math.min(14, colW * 0.75));
      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const charH = fontSize * 1.2;

      for (let ci = 0; ci < columns.length; ci++) {
        const col = columns[ci];
        const cx = ci * colW + colW / 2;
        const headY = col.head_y * H;
        const chars = col.chars;
        const len = chars.length;
        const tailLen = len * charH;

        for (let j = 0; j < len; j++) {
          const y = headY - (len - 1 - j) * charH;
          if (y < -charH || y > H + charH) continue;

          // Brightness: head char is brightest, fades toward tail
          const t = j / Math.max(1, len - 1); // 0 = tail, 1 = head
          let alpha;
          if (j === len - 1) {
            alpha = 1.0; // head
          } else {
            alpha = 0.1 + t * 0.6;
          }

          // Color choice based on strategy
          let color;
          if (strategy === 'multicolor') {
            const hue = (ci * 17 + j * 7) % 360;
            color = `hsla(${hue}, 80%, 60%, ${alpha})`;
          } else if (strategy === 'cipher_stream') {
            color = j === len - 1
              ? `rgba(255, 255, 255, ${alpha})`
              : `rgba(0, 200, 255, ${alpha})`;
          } else {
            // classic_green, kanji_mix, binary_rain — use accent1
            color = j === len - 1
              ? `rgba(255, 255, 255, ${alpha})`
              : hexToRgba(c.accent1, alpha);
          }

          ctx.fillStyle = color;
          ctx.fillText(chars[j], cx, y);
        }

        // Glow on head character
        if (len > 0) {
          const hy = headY;
          if (hy >= -charH && hy <= H + charH) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = strategy === 'multicolor'
              ? `hsl(${(ci * 17 + (len - 1) * 7) % 360}, 80%, 60%)`
              : strategy === 'cipher_stream' ? '#00ccff' : c.accent1;
            ctx.fillStyle = '#fff';
            ctx.fillText(chars[len - 1], cx, hy);
            ctx.shadowBlur = 0;
          }
        }
      }

      // Strategy label
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(strategy.toUpperCase().replace(/_/g, ' '), 6, H - 6);

      rafId = requestAnimationFrame(draw);
    }

    function hexToRgba(hex, alpha) {
      // Handle shorthand or full hex, with or without #
      let h = hex.replace('#', '');
      if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      const r = parseInt(h.substring(0, 2), 16) || 0;
      const g = parseInt(h.substring(2, 4), 16) || 0;
      const b = parseInt(h.substring(4, 6), 16) || 0;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
