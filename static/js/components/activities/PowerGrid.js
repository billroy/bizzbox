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
    const voltageHistory = [];
    let lastReadings = null;
    let lastTopology = null;

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

    function drawVoltageChart(ctx, readings, w, top, bottom) {
      const voltageKey = Object.hasOwn(readings, 'voltage_kv') ? 'voltage_kv' : 'voltage_v';
      const voltage = readings[voltageKey];
      const unit = voltageKey === 'voltage_kv' ? 'kV' : 'V';
      if (!Number.isFinite(voltage)) return;

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText('VOLTAGE TREND', 10, top + 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#00cc44';
      ctx.fillText(`${voltage.toFixed(1)} ${unit}`, w - 10, top + 2);

      const left = 10;
      const right = w - 10;
      const chartTop = top + 17;
      const chartBottom = bottom - 3;
      if (right <= left || chartBottom <= chartTop) return;

      ctx.strokeStyle = '#303a30';
      ctx.lineWidth = 1;
      for (let row = 0; row <= 2; row++) {
        const y = chartTop + (chartBottom - chartTop) * row / 2;
        ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      }

      const low = Math.min(...voltageHistory);
      const high = Math.max(...voltageHistory);
      const padding = Math.max(unit === 'kV' ? 0.15 : 0.5, (high - low) * 0.25);
      const min = low - padding;
      const range = high - low + padding * 2;
      const pointY = value => chartBottom - (value - min) / range * (chartBottom - chartTop);
      // A fresh window starts with a level line, then fills with live samples.
      ctx.beginPath();
      if (voltageHistory.length === 1) {
        ctx.moveTo(left, pointY(voltage));
        ctx.lineTo(right, pointY(voltage));
      } else {
        voltageHistory.forEach((value, i) => {
          const x = left + i / (voltageHistory.length - 1) * (right - left);
          if (i === 0) ctx.moveTo(x, pointY(value));
          else ctx.lineTo(x, pointY(value));
        });
      }
      ctx.strokeStyle = '#00cc44';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) { raf = requestAnimationFrame(draw); return; }
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (w === 0 || h === 0) { raf = requestAnimationFrame(draw); return; }

      const state = props.activity.state;
      if (!state || !Array.isArray(state.nodes) || !Array.isArray(state.edges) ||
          !state.nodes.every(node => node && node.id != null && node.type &&
            Number.isFinite(node.x) && Number.isFinite(node.y)) ||
          !state.edges.every(edge => edge && edge.from_id != null && edge.to_id != null)) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);

      const nodes = state.nodes;
      const edges = state.edges;
      const flowOffset = state.flow_offset || 0;
      const readings = state.readings || {};

      const topology = nodes.map(node => node.id).join('|');
      if (topology !== lastTopology) {
        voltageHistory.length = 0;
        lastTopology = topology;
        lastReadings = null;
      }
      if (readings !== lastReadings) {
        const voltage = readings.voltage_kv ?? readings.voltage_v;
        if (Number.isFinite(voltage)) {
          voltageHistory.push(voltage);
          if (voltageHistory.length > 64) voltageHistory.shift();
        }
        lastReadings = readings;
      }

      // Keep the network above the trend chart and leave a separate footer.
      const mx = 20;
      const my = 12;
      const gw = Math.max(1, w - mx * 2);
      const chartTop = Math.max(72, Math.round(h * 0.58));
      const chartBottom = h - 27;
      const gh = Math.max(1, chartTop - my - 14);

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
      const nodeRadius = Math.max(5, Math.min(10, gw / 18, gh / 7));
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
        ctx.font = `${Math.max(8, nodeRadius * 0.8)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(node.label, x, y + nodeRadius + 2);
      }

      ctx.globalAlpha = 1;

      drawVoltageChart(ctx, readings, w, chartTop, chartBottom);

      // The two supporting readings have names and units that fit in a small window.
      if (h > 100) {
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#aaaaaa';
        if (Number.isFinite(readings.frequency_hz)) {
          ctx.fillText(`FREQUENCY ${readings.frequency_hz.toFixed(1)} Hz`, 10, h - 5);
        }
        if (Number.isFinite(readings.load_pct) && w >= 230) {
          ctx.textAlign = 'right';
          ctx.fillText(`LOAD ${Math.round(readings.load_pct)}%`, w - 10, h - 5);
        }
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
