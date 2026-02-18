/**
 * Rotating wireframe globe with animated connection arcs — canvas renderer.
 * Server sends node positions (3D) and arc data; client projects and renders.
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

export default {
  name: 'ActivityGlobeArcs',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) return;
      const state = props.activity?.state;
      const nodes = state?.nodes;
      if (!nodes || nodes.length === 0) { rafId = requestAnimationFrame(draw); return; }

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
      const arcs = state.arcs || [];

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(cx, cy) - 24;

      // Globe wireframe — latitude circles
      ctx.strokeStyle = c.border + '22';
      ctx.lineWidth = 0.5;
      for (let lat = -60; lat <= 60; lat += 30) {
        const latRad = lat * Math.PI / 180;
        const ry = R * Math.sin(latRad);
        const rx = R * Math.cos(latRad);
        ctx.beginPath();
        ctx.ellipse(cx, cy - ry, rx, Math.abs(rx * 0.12), 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Longitude lines
      const rotation = state.rotation || 0;
      for (let lon = 0; lon < 180; lon += 30) {
        const lonRad = (lon * Math.PI / 180) + rotation;
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * Math.abs(Math.cos(lonRad)), R, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Globe outline
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = c.accent1 + '33';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Project node to screen
      function project(node) {
        // Orthographic: x → screen x, z → screen y, y → depth
        return {
          sx: cx + node.x * R,
          sy: cy - node.z * R,
          depth: node.y,
          visible: node.y > -0.15, // slightly behind is still partially visible
        };
      }

      // Draw arcs
      for (const arc of arcs) {
        if (arc.src >= nodes.length || arc.dst >= nodes.length) continue;
        const srcN = nodes[arc.src];
        const dstN = nodes[arc.dst];
        const p1 = project(srcN);
        const p2 = project(dstN);

        // Fade based on age
        const maxAge = 40;
        const fade = Math.max(0, 1 - arc.age / maxAge);
        if (fade < 0.05) continue;

        // Only draw if at least one endpoint is visible
        if (!p1.visible && !p2.visible) continue;

        // Arc as a quadratic curve with midpoint lifted above the globe surface
        const midX = (p1.sx + p2.sx) / 2;
        const midY = (p1.sy + p2.sy) / 2;
        const dx = p2.sx - p1.sx;
        const dy = p2.sy - p1.sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const lift = Math.min(R * 0.4, dist * 0.35);
        // Perpendicular direction for lift
        const nx = -dy / (dist || 1);
        const ny = dx / (dist || 1);
        const cpx = midX + nx * lift;
        const cpy = midY + ny * lift;

        // Draw the arc up to progress
        const progress = arc.progress;
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);

        // Approximate partial bezier with small steps
        const steps = 20;
        const maxStep = Math.floor(steps * progress);
        for (let s = 1; s <= maxStep; s++) {
          const t = s / steps;
          const px = (1 - t) * (1 - t) * p1.sx + 2 * (1 - t) * t * cpx + t * t * p2.sx;
          const py = (1 - t) * (1 - t) * p1.sy + 2 * (1 - t) * t * cpy + t * t * p2.sy;
          ctx.lineTo(px, py);
        }

        ctx.strokeStyle = c.accent2;
        ctx.globalAlpha = fade * 0.8;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 4;
        ctx.shadowColor = c.accent2;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;

        // Animated dot at arc head
        if (progress < 1.0) {
          const t = progress;
          const hx = (1 - t) * (1 - t) * p1.sx + 2 * (1 - t) * t * cpx + t * t * p2.sx;
          const hy = (1 - t) * (1 - t) * p1.sy + 2 * (1 - t) * t * cpy + t * t * p2.sy;
          ctx.beginPath();
          ctx.arc(hx, hy, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = c.accent2;
          ctx.globalAlpha = fade;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const p = project(node);
        const alpha = p.visible ? 0.9 : 0.2;

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, 3, 0, Math.PI * 2);
        ctx.fillStyle = c.accent1;
        ctx.fill();

        // Node label
        if (p.visible) {
          ctx.font = '8px monospace';
          ctx.fillStyle = c.accent1;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(node.name, p.sx + 5, p.sy - 2);
        }
        ctx.globalAlpha = 1.0;
      }

      // Strategy label
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(strategy.toUpperCase().replace(/_/g, ' '), 6, H - 4);

      // Arc count
      ctx.textAlign = 'right';
      const activeArcs = arcs.filter(a => a.age < 40).length;
      ctx.fillText(`${activeArcs} LINKS`, W - 6, H - 4);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
