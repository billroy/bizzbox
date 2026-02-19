/**
 * Power Grid — animated electrical/circuit schematic.
 * Canvas RAF loop — schematic-style drawing with animated current flow.
 */
export default {
  name: 'ActivityPowerGrid',
  props: { activity: { type: Object, required: true } },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let raf = null;

    // Node type symbols
    const NODE_SYMBOLS = {
      generator:    drawGenerator,
      transformer:  drawTransformer,
      breaker:      drawBreaker,
      load:         drawLoad,
      bus:          drawBus,
    };

    function statusColor(status) {
      switch (status) {
        case 'online':  return '#00cc44';
        case 'fault':   return '#ee3333';
        case 'offline': return '#666666';
        default:        return '#888888';
      }
    }

    function drawGenerator(ctx, x, y, r, color) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // G label
      ctx.fillStyle = color;
      ctx.font = `${Math.max(8, r * 0.8)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('G', x, y);
    }

    function drawTransformer(ctx, x, y, r, color) {
      // Two overlapping circles
      ctx.beginPath();
      ctx.arc(x - r * 0.35, y, r * 0.6, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + r * 0.35, y, r * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }

    function drawBreaker(ctx, x, y, r, color) {
      // X in a box
      const s = r * 0.8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - s, y - s, s * 2, s * 2);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.6, y - s * 0.6);
      ctx.lineTo(x + s * 0.6, y + s * 0.6);
      ctx.moveTo(x + s * 0.6, y - s * 0.6);
      ctx.lineTo(x - s * 0.6, y + s * 0.6);
      ctx.stroke();
    }

    function drawLoad(ctx, x, y, r, color) {
      // Square
      const s = r * 0.85;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - s, y - s, s * 2, s * 2);
      // Arrow down
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.5);
      ctx.lineTo(x, y + s * 0.5);
      ctx.moveTo(x - s * 0.3, y + s * 0.2);
      ctx.lineTo(x, y + s * 0.5);
      ctx.lineTo(x + s * 0.3, y + s * 0.2);
      ctx.stroke();
    }

    function drawBus(ctx, x, y, r, color) {
      // Thick horizontal bar
      const w = r * 1.5;
      const h = r * 0.4;
      ctx.fillStyle = color;
      ctx.fillRect(x - w, y - h, w * 2, h * 2);
    }

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width = canvas.offsetWidth;
      const h = canvas.height = canvas.offsetHeight;
      if (w === 0 || h === 0) return;

      ctx.clearRect(0, 0, w, h);

      const state = props.activity.state;
      if (!state || !state.nodes || !state.edges) return;

      const nodes = state.nodes;
      const edges = state.edges;
      const flowOffset = state.flow_offset || 0;
      const readings = state.readings || {};

      // Margin for labels
      const mx = 30;
      const my = 30;
      const gw = Math.max(1, w - mx * 2);
      const gh = Math.max(1, h - my * 2 - 30); // leave room for readings

      // Build node position map
      const nodeMap = {};
      for (const node of nodes) {
        nodeMap[node.id] = node;
      }

      // Draw edges with animated dash flow
      ctx.setLineDash([6, 4]);
      for (const edge of edges) {
        const n1 = nodeMap[edge.from_id];
        const n2 = nodeMap[edge.to_id];
        if (!n1 || !n2) continue;
        const x1 = mx + n1.x * gw;
        const y1 = my + n1.y * gh;
        const x2 = mx + n2.x * gw;
        const y2 = my + n2.y * gh;

        const flow = edge.flow || 0;
        const color = flow > 0 ? '#00cc44' : '#444444';

        ctx.lineDashOffset = -flowOffset * 60;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.globalAlpha = 1;

      // Draw nodes
      const nodeRadius = Math.max(1, Math.min(12, Math.min(gw, gh) / (nodes.length + 2)));
      const now = Date.now();

      for (const node of nodes) {
        const x = mx + node.x * gw;
        const y = my + node.y * gh;
        let color = statusColor(node.status);

        // Pulsing for fault nodes
        if (node.status === 'fault') {
          const pulse = Math.sin(now / 200) * 0.5 + 0.5;
          ctx.globalAlpha = 0.5 + pulse * 0.5;
        } else {
          ctx.globalAlpha = 1;
        }

        const drawFn = NODE_SYMBOLS[node.type] || drawLoad;
        drawFn(ctx, x, y, nodeRadius, color);

        // Label below
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = color;
        ctx.font = `${Math.max(7, nodeRadius * 0.6)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(node.label, x, y + nodeRadius + 2);
      }

      ctx.globalAlpha = 1;

      // Draw readings at bottom
      const readingEntries = Object.entries(readings);
      if (readingEntries.length > 0) {
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        const readingY = h - 4;
        const colW = Math.min(140, w / readingEntries.length);
        readingEntries.forEach(([key, val], i) => {
          const label = key.replace(/_/g, ' ').toUpperCase();
          const display = typeof val === 'number' ? val.toFixed(1) : val;
          ctx.fillStyle = '#888888';
          ctx.fillText(`${label}: `, mx + i * colW, readingY);
          ctx.fillStyle = '#00cc44';
          ctx.fillText(`${display}`, mx + i * colW + ctx.measureText(`${label}: `).width, readingY);
        });
      }

      raf = requestAnimationFrame(draw);
    }

    onMounted(() => {
      raf = requestAnimationFrame(draw);
    });

    onUnmounted(() => {
      if (raf) cancelAnimationFrame(raf);
    });

    return { canvasRef };
  },
  template: `
    <div class="activity-content">
      <canvas ref="canvasRef" class="activity-canvas"></canvas>
    </div>
  `,
};
