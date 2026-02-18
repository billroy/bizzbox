/**
 * Network topology diagram — canvas-based animated nodes and edges.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:       get('--color-surface'),
    border:   get('--color-border'),
    accent1:  get('--color-accent-1'),
    accent2:  get('--color-accent-2'),
    accent3:  get('--color-accent-3'),
    textDim:  get('--color-text-dim'),
    textMain: get('--color-text-primary'),
    warn:     get('--color-warn'),
    error:    get('--color-error'),
  };
}

function draw(canvas, state) {
  if (!canvas || !state) return;
  const { nodes, edges } = state;
  if (!nodes || !edges) return;

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  if (W === 0 || H === 0) return;

  if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
  }

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const c = getThemeColors();

  // Background
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);

  // Grid dots
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid-dot-color').trim();
  for (let x = 20; x < W; x += 30) {
    for (let y = 20; y < H; y += 30) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Edges
  for (const edge of edges) {
    const from = nodes.find(n => n.id === edge.from);
    const to   = nodes.find(n => n.id === edge.to);
    if (!from || !to) continue;
    const x1 = from.x * W, y1 = from.y * H;
    const x2 = to.x   * W, y2 = to.y   * H;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = edge.pulse ? 2 : 1;
    ctx.strokeStyle = edge.active
      ? (edge.pulse ? c.accent2 : c.accent1 + '88')
      : (c.textDim + '44');
    ctx.stroke();

    // Pulse dot traveling along edge
    if (edge.pulse && edge.active) {
      const t = (Date.now() / 800) % 1;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = c.accent2;
      ctx.fill();
    }
  }

  // Nodes
  for (const node of nodes) {
    const x = node.x * W;
    const y = node.y * H;
    const r = node.highlight ? 9 : 7;

    if (node.highlight || node.active) {
      ctx.beginPath();
      ctx.arc(x, y, r + 6, 0, Math.PI * 2);
      ctx.fillStyle = (node.highlight ? c.accent3 : c.accent1) + '22';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = node.highlight ? c.accent3 : (node.active ? c.accent1 : c.textDim + '66');
    ctx.fill();

    // Label
    ctx.font = `10px monospace`;
    ctx.fillStyle = node.active ? c.textMain : c.textDim;
    ctx.textAlign = 'center';
    ctx.fillText(node.label, x, y + r + 12);
  }
}

export default {
  name: 'ActivityNetworkTopology',
  props: { activity: Object },
  setup(props) {
    const { ref, watch, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    function render() {
      draw(canvasRef.value, props.activity?.state);
      rafId = requestAnimationFrame(render);
    }

    onMounted(() => { rafId = requestAnimationFrame(render); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
