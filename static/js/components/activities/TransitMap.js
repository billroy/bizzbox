/**
 * Random transit map with moving vehicles along routes — canvas renderer.
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
  name: 'ActivityTransitMap',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    function lerp(a, b, t) {
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }

    function getPositionOnLine(points, progress) {
      if (!points || points.length < 2) return points?.[0] || { x: 0.5, y: 0.5 };
      const totalSegments = points.length - 1;
      const segFloat = progress * totalSegments;
      const segIdx = Math.min(Math.floor(segFloat), totalSegments - 1);
      const segProgress = segFloat - segIdx;
      return lerp(points[segIdx], points[segIdx + 1], segProgress);
    }

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

      const lines = state.lines || [];
      const stations = state.stations || [];
      const vehicles = state.vehicles || [];

      // Draw route lines
      for (const line of lines) {
        const pts = line.points || [];
        if (pts.length < 2) continue;

        ctx.beginPath();
        ctx.moveTo(pts[0].x * W, pts[0].y * H);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * W, pts[i].y * H);
        }
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // Draw stations
      for (const sta of stations) {
        const sx = sta.x * W;
        const sy = sta.y * H;
        const lineColor = lines[sta.line_idx]?.color || '#ffffff';

        // Station circle
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fillStyle = c.bg;
        ctx.fill();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Station label
        ctx.font = '7px monospace';
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(sta.name, sx + 7, sy);
      }

      // Draw vehicles
      for (const v of vehicles) {
        const line = lines[v.line_idx];
        if (!line) continue;
        const pos = getPositionOnLine(line.points, v.progress);
        const vx = pos.x * W;
        const vy = pos.y * H;

        // Vehicle dot (larger, filled)
        ctx.beginPath();
        ctx.arc(vx, vy, 5, 0, Math.PI * 2);
        ctx.fillStyle = line.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Vehicle label
        ctx.font = '7px monospace';
        ctx.fillStyle = c.textMain;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(v.label, vx, vy - 7);
      }

      // Legend in top-left
      const legendX = 6;
      let legendY = 12;
      ctx.font = '8px monospace';
      for (const line of lines) {
        ctx.fillStyle = line.color;
        ctx.fillRect(legendX, legendY - 4, 10, 3);
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(line.name, legendX + 14, legendY - 2);
        legendY += 10;
      }

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
