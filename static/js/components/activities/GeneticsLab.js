/**
 * Genetics Lab — scrolling nucleotide sequence with highlighted edit targets,
 * guide RNA match display, and lab metrics. Canvas RAF loop.
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

const BASE_COLORS = {
  A: '#44cc44',  // green
  C: '#4488ff',  // blue
  G: '#ffaa00',  // amber
  T: '#ee4444',  // red
};

export default {
  name: 'ActivityGeneticsLab',
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

      const seq = state.visible_sequence || '';
      const guideRna = state.guide_rna || '';
      const editSites = state.edit_sites || [];
      const offset = state.scroll_offset || 0;

      // --- Header ---
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`TARGET: ${state.gene_target || '---'}`, 6, 4);

      ctx.fillStyle = c.textDim;
      ctx.font = '8px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`CYCLE ${state.cycle_count || 0}`, W - 6, 4);

      // Phase indicator
      const phase = (state.phase || 'idle').toUpperCase();
      ctx.fillStyle = c.accent2;
      ctx.textAlign = 'center';
      ctx.fillText(phase, W / 2, 4);

      // --- Scrolling sequence display ---
      const seqY = 22;
      const charW = Math.min(12, (W - 12) / Math.max(seq.length, 1));
      const charH = 14;

      // Build set of edit positions relative to visible window
      const editPositions = new Map();
      for (const site of editSites) {
        const relPos = site.position - (offset % 120);  // approximate
        if (relPos >= 0 && relPos < seq.length) {
          editPositions.set(relPos, site);
        }
      }

      // Draw sequence bases
      for (let i = 0; i < seq.length; i++) {
        const base = seq[i];
        const x = 6 + i * charW;
        if (x > W - 6) break;

        const isEdit = editPositions.has(i);
        const site = editPositions.get(i);

        // Highlight edited positions
        if (isEdit) {
          let hlColor;
          switch (site.status) {
            case 'pending':  hlColor = c.warn + '44'; break;
            case 'applied':  hlColor = c.accent1 + '44'; break;
            case 'verified': hlColor = c.accent2 + '44'; break;
            default:         hlColor = c.border + '22';
          }
          ctx.fillStyle = hlColor;
          ctx.fillRect(x - 1, seqY - 1, charW, charH + 2);
        }

        // Base character
        ctx.font = `bold ${Math.min(11, charW * 0.9)}px monospace`;
        ctx.fillStyle = BASE_COLORS[base] || c.textMain;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(base, x + charW / 2, seqY);
      }

      // Position numbers below sequence
      ctx.font = '6px monospace';
      ctx.fillStyle = c.textDim;
      for (let i = 0; i < seq.length; i += 10) {
        const x = 6 + i * charW;
        if (x > W - 6) break;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`${offset + i}`, x + charW / 2, seqY + charH + 2);
      }

      // --- Guide RNA display ---
      const grnaY = seqY + charH + 14;
      ctx.font = '8px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('GUIDE RNA:', 6, grnaY);

      ctx.font = `bold ${Math.min(10, charW * 0.8)}px monospace`;
      for (let i = 0; i < guideRna.length; i++) {
        const base = guideRna[i];
        const x = 72 + i * Math.min(10, charW);
        ctx.fillStyle = BASE_COLORS[base] || c.textMain;
        ctx.fillText(base, x, grnaY);
      }

      // --- Metrics panel ---
      const metY = grnaY + 20;
      const metrics = [
        { label: 'CELL VIABILITY', val: `${state.cell_viability_pct.toFixed(1)}%`, warn: state.cell_viability_pct < 70 },
        { label: 'MATCH SCORE', val: `${state.match_score_pct.toFixed(1)}%` },
        { label: 'OFF-TARGET', val: `${state.off_target_pct.toFixed(2)}%`, warn: state.off_target_pct > 5 },
        { label: 'FOLD CONF', val: `${state.protein_fold_conf.toFixed(1)}%` },
        { label: 'BATCH TEMP', val: `${state.batch_temp_c.toFixed(1)}\u00B0C` },
      ];

      const metColW = W / Math.min(metrics.length, 5);
      metrics.forEach((m, i) => {
        const mx = metColW * i + metColW / 2;
        const my = metY;

        ctx.font = '7px monospace';
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(m.label, mx, my);

        ctx.font = '10px monospace';
        ctx.fillStyle = m.warn ? c.error : c.accent1;
        ctx.fillText(m.val, mx, my + 10);
      });

      // --- Edit sites summary at bottom ---
      const editY = H - 18;
      const pending = editSites.filter(s => s.status === 'pending').length;
      const applied = editSites.filter(s => s.status === 'applied').length;
      const verified = editSites.filter(s => s.status === 'verified').length;

      ctx.font = '8px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = c.warn;
      ctx.fillText(`PENDING:${pending}`, 6, editY);
      ctx.fillStyle = c.accent1;
      ctx.fillText(`APPLIED:${applied}`, 80, editY);
      ctx.fillStyle = c.accent2;
      ctx.fillText(`VERIFIED:${verified}`, 160, editY);

      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'right';
      ctx.fillText(`TOTAL EDITS: ${editSites.length}`, W - 6, editY);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
