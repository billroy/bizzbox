/**
 * Geographic map with moving markers — canvas renderer.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    surface2:get('--color-surface-2'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    accent3: get('--color-accent-3'),
    textDim: get('--color-text-dim'),
    textMain:get('--color-text-primary'),
    border:  get('--color-border'),
    warn:    get('--color-warn'),
  };
}

export default {
  name: 'ActivityGeoMap',
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

      // Grid lines (lat/lon simulation)
      ctx.strokeStyle = c.border + '44';
      ctx.lineWidth = 0.5;
      const gridSpacing = Math.min(W, H) / 6;
      for (let x = 0; x < W; x += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Land masses (simplified polygons)
      ctx.fillStyle = c.surface2 + 'cc';
      ctx.strokeStyle = c.accent1 + '44';
      ctx.lineWidth = 1;
      for (const land of (state.land_masses || [])) {
        if (land.length < 4) continue;
        ctx.beginPath();
        ctx.moveTo(land[0] * W, land[1] * H);
        for (let i = 2; i < land.length; i += 2) {
          ctx.lineTo(land[i] * W, land[i+1] * H);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Marker trails
      for (const marker of (state.markers || [])) {
        if (marker.trail && marker.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(marker.trail[0].x * W, marker.trail[0].y * H);
          for (const pt of marker.trail.slice(1)) {
            ctx.lineTo(pt.x * W, pt.y * H);
          }
          ctx.strokeStyle = c.accent2 + '44';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Markers
      for (const marker of (state.markers || [])) {
        const mx = marker.x * W;
        const my = marker.y * H;
        const strategy = state.strategy;

        if (strategy === 'pandemic_spread') {
          // Growing circle
          ctx.beginPath();
          ctx.arc(mx, my, (marker.size || 1) * 12, 0, Math.PI * 2);
          ctx.fillStyle = c.warn + '33';
          ctx.fill();
          ctx.strokeStyle = c.warn + '88';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          // Arrow/dot marker
          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(marker.angle || 0);
          ctx.beginPath();
          ctx.moveTo(0, -8);
          ctx.lineTo(5, 5);
          ctx.lineTo(0, 2);
          ctx.lineTo(-5, 5);
          ctx.closePath();
          ctx.fillStyle = c.accent1;
          ctx.fill();
          ctx.restore();
        }

        // Label
        ctx.font = '9px monospace';
        ctx.fillStyle = c.textMain;
        ctx.textAlign = 'left';
        ctx.fillText(marker.label, mx + 8, my + 3);
      }

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
