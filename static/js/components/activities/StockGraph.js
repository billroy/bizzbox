/**
 * Stock price chart — canvas area chart with price line and filled area.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    textDim: get('--color-text-dim'),
    textMain:get('--color-text-primary'),
    border:  get('--color-border'),
  };
}

export default {
  name: 'ActivityStockGraph',
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

      // Background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, W, H);

      const prices = state.prices || [];
      if (prices.length < 2) { rafId = requestAnimationFrame(draw); return; }

      const gaining = state.gaining;
      const lineColor = gaining ? '#00cc44' : '#ee3333';
      const fillColor = gaining ? 'rgba(0,204,68,0.15)' : 'rgba(238,51,51,0.15)';

      // Chart area with padding
      const padTop = 38;
      const padBottom = 20;
      const padLeft = 8;
      const padRight = 8;
      const chartW = W - padLeft - padRight;
      const chartH = H - padTop - padBottom;

      const minP = Math.min(...prices);
      const maxP = Math.max(...prices);
      const range = maxP - minP || 1;

      // Map price to y
      function py(price) {
        return padTop + chartH - ((price - minP) / range) * chartH;
      }
      function px(i) {
        return padLeft + (i / (prices.length - 1)) * chartW;
      }

      // Grid lines
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 0.5;
      const gridRows = 4;
      for (let g = 0; g <= gridRows; g++) {
        const gy = padTop + (g / gridRows) * chartH;
        ctx.beginPath(); ctx.moveTo(padLeft, gy); ctx.lineTo(W - padRight, gy); ctx.stroke();
      }

      // Filled area
      ctx.beginPath();
      ctx.moveTo(px(0), py(prices[0]));
      for (let i = 1; i < prices.length; i++) {
        ctx.lineTo(px(i), py(prices[i]));
      }
      ctx.lineTo(px(prices.length - 1), padTop + chartH);
      ctx.lineTo(px(0), padTop + chartH);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();

      // Line with glow
      ctx.beginPath();
      ctx.moveTo(px(0), py(prices[0]));
      for (let i = 1; i < prices.length; i++) {
        ctx.lineTo(px(i), py(prices[i]));
      }
      ctx.shadowBlur = 6;
      ctx.shadowColor = lineColor;
      ctx.strokeStyle = lineColor + '88';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Crisp line on top
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(px(0), py(prices[0]));
      for (let i = 1; i < prices.length; i++) {
        ctx.lineTo(px(i), py(prices[i]));
      }
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Current price dot
      const lastX = px(prices.length - 1);
      const lastY = py(prices[prices.length - 1]);
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();

      // ── Header text ──
      const ticker = state.ticker || '???';
      const current = state.current_price || 0;
      const change = state.change || 0;
      const changePct = state.change_pct || 0;
      const sign = change >= 0 ? '+' : '';

      // Ticker
      const tickerSize = Math.min(18, Math.max(10, W * 0.06)) | 0;
      ctx.font = `bold ${tickerSize}px monospace`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(ticker, padLeft + 2, 4);

      // Price
      const priceSize = Math.min(16, Math.max(9, W * 0.05)) | 0;
      const tickerWidth = ctx.measureText(ticker).width;
      ctx.font = `bold ${priceSize}px monospace`;
      ctx.fillText(current.toFixed(2), padLeft + tickerWidth + 12, 5);

      // Change
      const changeStr = `${sign}${change.toFixed(2)} (${sign}${changePct.toFixed(2)}%)`;
      const changeSize = Math.min(12, Math.max(8, W * 0.035)) | 0;
      ctx.font = `${changeSize}px monospace`;
      ctx.fillStyle = lineColor;
      ctx.fillText(changeStr, padLeft + 2, 6 + tickerSize);

      // Strategy label (top right)
      const stratLabel = (state.strategy || '').toUpperCase().replace(/_/g, ' ');
      ctx.font = `${Math.min(10, Math.max(7, W * 0.03))|0}px monospace`;
      ctx.fillStyle = '#555555';
      ctx.textAlign = 'right';
      ctx.fillText(stratLabel, W - padRight - 2, 6);

      // Price scale labels
      ctx.font = `${Math.min(9, Math.max(6, W * 0.025))|0}px monospace`;
      ctx.fillStyle = '#444444';
      ctx.textAlign = 'right';
      for (let g = 0; g <= gridRows; g++) {
        const price = maxP - (g / gridRows) * range;
        const gy = padTop + (g / gridRows) * chartH;
        ctx.fillText(price.toFixed(2), W - padRight - 2, gy - 2);
      }

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
