/**
 * Color weather radar with line-drawn geography on black background — canvas renderer.
 */

// Weather radar color scale: intensity 0→1 maps green→yellow→orange→red→magenta
function radarColor(intensity, alpha) {
  const a = alpha !== undefined ? alpha : 1.0;
  if (intensity < 0.2) {
    // Green (light rain)
    const t = intensity / 0.2;
    return `rgba(0,${100 + t * 155|0},0,${a})`;
  } else if (intensity < 0.4) {
    // Green → Yellow
    const t = (intensity - 0.2) / 0.2;
    return `rgba(${t * 255|0},255,0,${a})`;
  } else if (intensity < 0.6) {
    // Yellow → Orange
    const t = (intensity - 0.4) / 0.2;
    return `rgba(255,${255 - t * 100|0},0,${a})`;
  } else if (intensity < 0.8) {
    // Orange → Red
    const t = (intensity - 0.6) / 0.2;
    return `rgba(255,${155 - t * 155|0},0,${a})`;
  } else {
    // Red → Magenta
    const t = (intensity - 0.8) / 0.2;
    return `rgba(255,0,${t * 200|0},${a})`;
  }
}

export default {
  name: 'ActivityWeatherRadar',
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

      // Black background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);

      // Draw geography
      for (const feature of (state.geography || [])) {
        const pts = feature.points || [];
        if (pts.length < 2) continue;

        ctx.beginPath();
        ctx.moveTo(pts[0].x * W, pts[0].y * H);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * W, pts[i].y * H);
        }

        if (feature.type === 'coast') {
          ctx.strokeStyle = '#556666';
          ctx.lineWidth = 1.2;
        } else {
          ctx.strokeStyle = '#333344';
          ctx.lineWidth = 0.8;
          ctx.setLineDash([4, 4]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw highways
      for (const hw of (state.highways || [])) {
        const pts = hw.points || [];
        if (pts.length < 2) continue;

        ctx.beginPath();
        ctx.moveTo(pts[0].x * W, pts[0].y * H);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * W, pts[i].y * H);
        }
        ctx.strokeStyle = '#776622';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Highway label at midpoint
        if (hw.label && pts.length >= 2) {
          const mid = pts[Math.floor(pts.length / 2)];
          ctx.font = '7px monospace';
          ctx.fillStyle = '#998833';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(hw.label, mid.x * W, mid.y * H - 6);
        }
      }

      // Draw weather cells as colored radial gradients
      for (const cell of (state.cells || [])) {
        const cx = cell.x * W;
        const cy = cell.y * H;
        const r = cell.radius * Math.max(W, H);
        const intensity = cell.intensity;

        if (intensity < 0.02 || r < 2) continue;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, radarColor(intensity, 0.8));
        grad.addColorStop(0.4, radarColor(intensity * 0.7, 0.5));
        grad.addColorStop(0.7, radarColor(intensity * 0.4, 0.3));
        grad.addColorStop(1, radarColor(intensity * 0.1, 0.0));

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Timestamp overlay
      if (state.timestamp) {
        ctx.font = '9px monospace';
        ctx.fillStyle = '#668888';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(state.timestamp, W - 6, 6);
      }

      // Strategy label
      ctx.font = '8px monospace';
      ctx.fillStyle = '#445555';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText((state.strategy || '').toUpperCase().replace(/_/g, ' '), 6, H - 6);

      // Color scale legend
      const legendX = W - 60;
      const legendY = H - 60;
      const legendW = 12;
      const legendH = 50;
      for (let i = 0; i < legendH; i++) {
        const t = 1 - i / legendH;
        ctx.fillStyle = radarColor(t, 0.9);
        ctx.fillRect(legendX, legendY + i, legendW, 1);
      }
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(legendX, legendY, legendW, legendH);
      ctx.font = '6px monospace';
      ctx.fillStyle = '#666';
      ctx.textAlign = 'left';
      ctx.fillText('HI', legendX + legendW + 3, legendY + 5);
      ctx.fillText('LO', legendX + legendW + 3, legendY + legendH);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
