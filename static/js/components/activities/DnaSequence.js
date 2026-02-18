/**
 * Scrolling DNA / binary / hex sequence renderer — canvas-based.
 * Server sends lines of characters with highlight regions and annotations.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:       get('--color-surface'),
    accent1:  get('--color-accent-1'),
    accent2:  get('--color-accent-2'),
    accent3:  get('--color-accent-3'),
    textPri:  get('--color-text-primary'),
    textDim:  get('--color-text-dim'),
    border:   get('--color-border'),
    warn:     get('--color-warn'),
  };
}

// Per-strategy base character color
const STRATEGY_COLORS = {
  genome_sequencing: null,  // special: colored per base
  binary_stream:     null,  // use accent1
  protein_folding:   null,  // use accent2
  cryptanalysis:     null,  // use accent1
  virus_signature:   null,  // use accent1
};

// ATCG coloring for genome strategy
const BASE_COLORS = { A: '#4fc3f7', T: '#ef5350', C: '#66bb6a', G: '#ffa726' };

export default {
  name: 'ActivityDnaSequence',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) return;
      const state = props.activity?.state;
      const lines = state?.lines;
      if (!lines || lines.length === 0) { rafId = requestAnimationFrame(draw); return; }

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
      const strategy = state.strategy || 'genome_sequencing';
      const annotation = state.annotation || '';

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      // Determine font size to fit lines
      const padX = 4;
      const padY = 4;
      const annotH = 16;
      const availH = H - padY * 2 - annotH;
      const lineH = Math.max(10, availH / lines.length);
      const fontSize = Math.max(8, Math.min(13, lineH * 0.78));
      ctx.font = `${fontSize}px monospace`;

      const charW = ctx.measureText('M').width;

      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        const text = line.text;
        const highlights = line.highlights || [];
        const y = padY + li * lineH;
        const textY = y + lineH * 0.75;

        // Draw highlight backgrounds first
        for (const hl of highlights) {
          const hx = padX + hl.start * charW;
          const hw = (hl.end - hl.start) * charW;
          ctx.fillStyle = c.accent1 + '22';
          ctx.fillRect(hx, y, hw, lineH);
          // Highlight border
          ctx.strokeStyle = c.accent1 + '66';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(hx, y, hw, lineH);
          // Label above highlight
          if (hl.label) {
            ctx.font = `${Math.max(7, fontSize - 3)}px monospace`;
            ctx.fillStyle = c.accent1;
            ctx.textAlign = 'left';
            ctx.fillText(hl.label, hx + 1, y + Math.max(7, fontSize - 3));
            ctx.font = `${fontSize}px monospace`;
          }
        }

        // Draw each character
        ctx.textAlign = 'left';
        for (let ci = 0; ci < text.length; ci++) {
          const ch = text[ci];
          const cx = padX + ci * charW;
          if (cx > W) break;

          // Check if this char falls in a highlight
          let inHL = false;
          for (const hl of highlights) {
            if (ci >= hl.start && ci < hl.end) { inHL = true; break; }
          }

          // Color
          if (inHL) {
            ctx.fillStyle = c.accent2;
          } else if (strategy === 'genome_sequencing') {
            ctx.fillStyle = BASE_COLORS[ch] || c.textPri;
          } else if (strategy === 'protein_folding') {
            ctx.fillStyle = c.accent2;
          } else {
            ctx.fillStyle = c.accent1;
          }

          // Slight dimming for older lines (top)
          const ageFade = 0.4 + 0.6 * (li / Math.max(1, lines.length - 1));
          ctx.globalAlpha = ageFade;
          ctx.fillText(ch, cx, textY);
          ctx.globalAlpha = 1.0;
        }
      }

      // Annotation bar at bottom
      if (annotation) {
        ctx.fillStyle = c.bg + 'cc';
        ctx.fillRect(0, H - annotH - 2, W, annotH + 2);
        ctx.font = `bold ${Math.max(8, fontSize - 1)}px monospace`;
        ctx.fillStyle = c.warn;
        ctx.textAlign = 'left';
        ctx.fillText(annotation, padX, H - 5);
      }

      // Strategy label bottom-right
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'right';
      ctx.fillText(strategy.toUpperCase().replace(/_/g, ' '), W - 6, H - 5);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
