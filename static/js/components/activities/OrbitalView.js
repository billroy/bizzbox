/**
 * Orbital satellite view — canvas with orthographic Earth projection
 * and satellite positions. Server sends 3D coordinates; client projects
 * and renders the globe, orbits, and satellite markers.
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
    border:  get('--color-border'),
    warn:    get('--color-warn'),
  };
}

const ORBIT_COLORS = {
  leo: null,  // accent1
  meo: null,  // accent2
  geo: null,  // accent3/warn
};

export default {
  name: 'ActivityOrbitalView',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) return;
      const state = props.activity?.state;
      const satellites = state?.satellites;
      if (!satellites) { rafId = requestAnimationFrame(draw); return; }

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
      const strategy = state.strategy || '';

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(cx, cy) - 30; // Earth radius in pixels

      // Earth circle
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = c.bg;
      ctx.fill();
      ctx.strokeStyle = c.accent1 + '55';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Latitude/longitude grid on Earth
      ctx.strokeStyle = c.border + '33';
      ctx.lineWidth = 0.5;
      const rotation = state.rotation || 0;
      // Draw latitude lines
      for (let lat = -60; lat <= 60; lat += 30) {
        const latRad = lat * Math.PI / 180;
        const ry = R * Math.sin(latRad);
        const rx = R * Math.cos(latRad);
        ctx.beginPath();
        ctx.ellipse(cx, cy - ry, rx, Math.abs(rx * 0.15), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Draw longitude lines
      for (let lon = 0; lon < 180; lon += 30) {
        const lonRad = (lon * Math.PI / 180) + rotation;
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * Math.abs(Math.cos(lonRad)), R, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Sort satellites by z for depth ordering (back to front)
      const sorted = [...satellites].sort((a, b) => a.z - b.z);

      // Draw satellites
      for (const sat of sorted) {
        // Orthographic projection: x, y directly, z for depth
        const sx = cx + sat.x * R;
        const sy = cy - sat.z * R; // z maps to screen Y
        const depth = sat.y; // y is into/out of screen

        // Behind the globe? Reduce visibility
        const dist = Math.sqrt(sat.x * sat.x + sat.z * sat.z);
        const isBehind = depth < 0 && dist < 1.0;
        const alpha = isBehind ? 0.2 : 0.85;

        // Color by orbit type
        let color;
        if (sat.orbit_type === 'geo') {
          color = c.warn;
        } else if (sat.orbit_type === 'meo') {
          color = c.accent2;
        } else {
          color = c.accent1;
        }

        // Satellite dot
        const dotR = sat.orbit_type === 'geo' ? 3.5 : 2.5;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Glow
        if (!isBehind) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = color;
          ctx.beginPath();
          ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Label (only for visible, nearby satellites)
        if (!isBehind && alpha > 0.5) {
          ctx.font = '8px monospace';
          ctx.fillStyle = color;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(sat.label, sx + 5, sy - 3);
        }
        ctx.globalAlpha = 1.0;
      }

      // Legend
      ctx.font = '8px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const legendY = H - 36;
      const items = [
        { label: 'LEO', color: c.accent1 },
        { label: 'MEO', color: c.accent2 },
        { label: 'GEO', color: c.warn },
      ];
      items.forEach((item, i) => {
        const lx = 8 + i * 44;
        ctx.fillStyle = item.color;
        ctx.fillRect(lx, legendY, 6, 6);
        ctx.fillText(item.label, lx + 9, legendY - 1);
      });

      // Satellite count
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'right';
      ctx.fillText(`${satellites.length} SATS`, W - 8, legendY - 1);

      // Strategy label
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(strategy.toUpperCase().replace(/_/g, ' '), 8, H - 4);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
