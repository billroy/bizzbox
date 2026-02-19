/**
 * Blockchain Explorer — canvas-based transaction feed with block height and mempool.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    textDim: get('--color-text-dim'),
    textMain:get('--color-text-primary'),
    border:  get('--color-border'),
    error:   get('--color-error'),
    warn:    get('--color-warn'),
  };
}

export default {
  name: 'ActivityBlockchain',
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
        canvas.width = W * dpr; canvas.height = H * dpr;
      }

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = getThemeColors();

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const transactions = state.transactions || [];
      const blockHeight = state.block_height || 0;
      const mempoolDepth = state.mempool_depth || 0;
      const tps = state.tps || 0;
      const strategy = state.strategy || '';

      // Layout
      const pad = 6;
      const titleH = Math.max(20, H * 0.09);
      const mempoolBarH = 6;
      const mempoolTop = titleH + 2;
      const listTop = mempoolTop + mempoolBarH + 4;
      const listH = H - listTop - 18; // leave room for strategy label at bottom

      // ── Title bar ──
      const titleSize = Math.min(14, Math.max(9, W * 0.045)) | 0;
      ctx.font = `bold ${titleSize}px monospace`;
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`BLOCK #${blockHeight}`, pad, titleH / 2);

      // TPS badge on right
      const tpsBadgeText = `${tps} TPS`;
      const tpsBadgeSize = Math.min(11, Math.max(7, W * 0.035)) | 0;
      ctx.font = `bold ${tpsBadgeSize}px monospace`;
      const tpsBadgeW = ctx.measureText(tpsBadgeText).width + 10;
      const tpsBadgeX = W - pad - tpsBadgeW;
      const tpsBadgeY = titleH / 2 - tpsBadgeSize / 2 - 2;
      ctx.fillStyle = c.accent1 + '22';
      ctx.fillRect(tpsBadgeX, tpsBadgeY, tpsBadgeW, tpsBadgeSize + 4);
      ctx.strokeStyle = c.accent1 + '66';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(tpsBadgeX, tpsBadgeY, tpsBadgeW, tpsBadgeSize + 4);
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'center';
      ctx.fillText(tpsBadgeText, tpsBadgeX + tpsBadgeW / 2, titleH / 2);

      // ── Mempool depth bar ──
      const mempoolMax = 20000;
      const mempoolFrac = Math.min(1, mempoolDepth / mempoolMax);
      ctx.fillStyle = c.border;
      ctx.fillRect(pad, mempoolTop, W - pad * 2, mempoolBarH);
      // Fill portion
      const barColor = mempoolFrac > 0.7 ? c.warn : c.accent1;
      ctx.fillStyle = barColor + '88';
      ctx.fillRect(pad, mempoolTop, (W - pad * 2) * mempoolFrac, mempoolBarH);
      // Mempool label
      const mpLabelSize = Math.min(8, Math.max(5, W * 0.025)) | 0;
      ctx.font = `${mpLabelSize}px monospace`;
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`MEMPOOL: ${mempoolDepth}`, pad + 2, mempoolTop - mpLabelSize - 1);

      // ── Transaction list ──
      const rowH = Math.min(22, Math.max(14, H * 0.045));
      const maxVisible = Math.floor(listH / rowH);
      const visibleTxns = transactions.slice(-maxVisible);
      const fontSize = Math.min(11, Math.max(7, W * 0.032)) | 0;
      const smallFont = Math.min(9, Math.max(6, W * 0.025)) | 0;

      for (let i = 0; i < visibleTxns.length; i++) {
        const tx = visibleTxns[i];
        const y = listTop + i * rowH;

        // Alternate row background
        if (i % 2 === 0) {
          ctx.fillStyle = c.border + '18';
          ctx.fillRect(pad, y, W - pad * 2, rowH);
        }

        const rowMid = y + rowH / 2;

        // Status color
        let statusColor;
        if (tx.status === 'pending') statusColor = c.accent1;
        else if (tx.status === 'confirmed') statusColor = c.accent2;
        else statusColor = c.error;

        // Status indicator dot
        ctx.beginPath();
        ctx.arc(pad + 5, rowMid, 3, 0, Math.PI * 2);
        ctx.fillStyle = statusColor;
        ctx.fill();

        // Hash (truncated)
        ctx.font = `${fontSize}px monospace`;
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const hashTrunc = tx.hash ? tx.hash.substring(0, 8) + '..' : '??';
        ctx.fillText(hashTrunc, pad + 14, rowMid);

        // From -> To addresses
        const addrX = pad + 14 + Math.min(80, W * 0.2);
        const fromTrunc = tx.from_addr ? tx.from_addr.substring(0, 6) : '??';
        const toTrunc = tx.to_addr ? tx.to_addr.substring(0, 6) : '??';
        ctx.font = `${smallFont}px monospace`;
        ctx.fillStyle = c.textDim;

        // Only show addresses if there's room
        if (W > 200) {
          ctx.fillText(`${fromTrunc}\u2192${toTrunc}`, addrX, rowMid);
        }

        // Amount (right-aligned area)
        const amountStr = tx.amount != null ? tx.amount.toFixed(4) : '0';
        const amtX = W - pad - 8;
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.fillStyle = c.textMain;
        ctx.textAlign = 'right';
        ctx.fillText(amountStr, amtX, rowMid);

        // Status badge
        if (W > 280) {
          const badgeX = amtX - ctx.measureText(amountStr).width - 8;
          ctx.font = `${smallFont}px monospace`;
          ctx.textAlign = 'right';
          if (tx.status === 'confirmed' && tx.confirmations > 0) {
            ctx.fillStyle = statusColor;
            ctx.fillText(`\u2713${tx.confirmations}`, badgeX, rowMid);
          } else if (tx.status === 'pending') {
            ctx.fillStyle = statusColor + 'aa';
            ctx.fillText('PEND', badgeX, rowMid);
          } else if (tx.status === 'failed') {
            ctx.fillStyle = statusColor;
            ctx.fillText('FAIL', badgeX, rowMid);
          }
        }
      }

      // ── Separator line above strategy label ──
      ctx.strokeStyle = c.border;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pad, H - 16);
      ctx.lineTo(W - pad, H - 16);
      ctx.stroke();

      // ── Strategy label bottom-right ──
      const stratLabel = strategy.toUpperCase().replace(/_/g, ' ');
      const stratSize = Math.min(9, Math.max(6, W * 0.025)) | 0;
      ctx.font = `${stratSize}px monospace`;
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(stratLabel, W - pad, H - 4);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
