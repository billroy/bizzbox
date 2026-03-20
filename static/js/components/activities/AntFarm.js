/**
 * Ant Farm activity — canvas-rendered cross-section of an ant colony
 * with tunnels, chambers, and animated ants navigating the network.
 */

const SOIL_PALETTES = {
  sandy_farm:    { layers: ['#D2B48C', '#C4A67A', '#B8956A', '#A0825A'], tunnel: '#8B7355', surface: '#87CEEB', grass: '#6B8E23' },
  forest_floor:  { layers: ['#654321', '#5C3D1E', '#4A3218', '#3E2914'], tunnel: '#2C1E0F', surface: '#5A8A4A', grass: '#3A6A2A' },
  desert_colony: { layers: ['#EDC9AF', '#DEB887', '#D2A679', '#C49466'], tunnel: '#A0825A', surface: '#E8B850', grass: '#9A8A3A' },
  crystal_caves: { layers: ['#4A4A6A', '#3E3E5C', '#32324E', '#282840'], tunnel: '#1E1E34', surface: '#2A2A5A', grass: '#4A5A8A' },
  volcanic_soil: { layers: ['#4A4040', '#3E3434', '#322828', '#2A2020'], tunnel: '#1E1414', surface: '#5A3030', grass: '#4A3A2A' },
};

const CARGO_COLORS = {
  food: '#4CAF50',
  dirt: '#8B6914',
  egg:  '#F5F5DC',
};

export default {
  name: 'ActivityAntFarm',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;
    let frameCounter = 0;

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
        canvas.width = W * dpr;
        canvas.height = H * dpr;
      }

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      frameCounter++;

      const strategy = state.strategy || 'sandy_farm';
      const pal = SOIL_PALETTES[strategy] || SOIL_PALETTES.sandy_farm;
      const nodes = state.nodes || [];
      const segments = state.segments || [];
      const ants = state.ants || [];
      const surfaceY = H * 0.08;

      // --- Sky ---
      ctx.fillStyle = pal.surface;
      ctx.fillRect(0, 0, W, surfaceY);

      // --- Soil layers ---
      const soilH = H - surfaceY;
      const layerH = soilH / pal.layers.length;
      for (let i = 0; i < pal.layers.length; i++) {
        ctx.fillStyle = pal.layers[i];
        ctx.fillRect(0, surfaceY + i * layerH, W, layerH + 1);
      }

      // --- Surface grass/texture ---
      ctx.strokeStyle = pal.grass;
      ctx.lineWidth = 1.5;
      for (let gx = 5; gx < W; gx += 12 + Math.sin(gx * 0.1) * 4) {
        const gh = 4 + Math.sin(gx * 0.3) * 3;
        ctx.beginPath();
        ctx.moveTo(gx, surfaceY);
        ctx.lineTo(gx + 1, surfaceY - gh);
        ctx.stroke();
      }

      // --- Tunnels ---
      const tunnelWidth = Math.max(10, Math.min(18, W * 0.025));

      // Draw tunnel fills (darker soil = void)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const seg of segments) {
        const from = nodes[seg.from];
        const to = nodes[seg.to];
        if (!from || !to) continue;
        ctx.strokeStyle = pal.tunnel;
        ctx.lineWidth = tunnelWidth;
        ctx.beginPath();
        ctx.moveTo(from.x * W, from.y * H);
        ctx.lineTo(to.x * W, to.y * H);
        ctx.stroke();
      }

      // --- Chambers (larger circles) and brood chamber ---
      for (const node of nodes) {
        if (node.type === 'brood') {
          // Big brood chamber
          const cr = tunnelWidth * 2.5;
          ctx.fillStyle = pal.tunnel;
          ctx.beginPath();
          ctx.ellipse(node.x * W, node.y * H, cr * 1.2, cr * 0.9, 0, 0, Math.PI * 2);
          ctx.fill();
          // Inner highlight
          ctx.fillStyle = lighten(pal.tunnel, 0.12) + '44';
          ctx.beginPath();
          ctx.ellipse(node.x * W, node.y * H - cr * 0.1, cr * 0.8, cr * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          // Egg clusters in brood chamber
          ctx.fillStyle = '#F5F5DC88';
          for (let ei = 0; ei < 5; ei++) {
            const ex = node.x * W + (ei - 2) * cr * 0.3;
            const ey = node.y * H + cr * 0.2;
            ctx.beginPath();
            ctx.ellipse(ex, ey, 2.5, 2, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (node.type === 'chamber') {
          const cr = tunnelWidth * 1.4;
          ctx.fillStyle = pal.tunnel;
          ctx.beginPath();
          ctx.arc(node.x * W, node.y * H, cr, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = lighten(pal.tunnel, 0.1) + '33';
          ctx.beginPath();
          ctx.arc(node.x * W, node.y * H - cr * 0.15, cr * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else if (node.type === 'entrance') {
          // Entrance arch
          const ex = node.x * W;
          ctx.fillStyle = pal.tunnel;
          ctx.beginPath();
          ctx.arc(ex, surfaceY, tunnelWidth * 0.7, Math.PI, 0);
          ctx.fill();
          ctx.fillRect(ex - tunnelWidth * 0.7, surfaceY, tunnelWidth * 1.4, tunnelWidth * 0.3);
        }
      }

      // --- Tunnel borders (subtle depth) ---
      for (const seg of segments) {
        const from = nodes[seg.from];
        const to = nodes[seg.to];
        if (!from || !to) continue;
        ctx.strokeStyle = darken(pal.tunnel, 0.7) + '44';
        ctx.lineWidth = tunnelWidth + 2;
        ctx.beginPath();
        ctx.moveTo(from.x * W, from.y * H);
        ctx.lineTo(to.x * W, to.y * H);
        ctx.stroke();
      }

      // Re-draw tunnel fills on top of borders
      for (const seg of segments) {
        const from = nodes[seg.from];
        const to = nodes[seg.to];
        if (!from || !to) continue;
        ctx.strokeStyle = pal.tunnel;
        ctx.lineWidth = tunnelWidth - 2;
        ctx.beginPath();
        ctx.moveTo(from.x * W, from.y * H);
        ctx.lineTo(to.x * W, to.y * H);
        ctx.stroke();
      }

      // --- Small roots poking into tunnels ---
      ctx.strokeStyle = darken(pal.layers[0], 0.7) + '55';
      ctx.lineWidth = 1;
      for (let i = 0; i < segments.length; i += 3) {
        const seg = segments[i];
        const from = nodes[seg.from];
        const to = nodes[seg.to];
        if (!from || !to) continue;
        const mx = (from.x + to.x) * 0.5 * W;
        const my = (from.y + to.y) * 0.5 * H;
        const rootLen = 4 + Math.sin(i * 2.7) * 3;
        ctx.beginPath();
        ctx.moveTo(mx - tunnelWidth * 0.4, my);
        ctx.lineTo(mx - tunnelWidth * 0.4 - rootLen, my + rootLen * 0.5);
        ctx.stroke();
      }

      // --- Ants ---
      for (const ant of ants) {
        if (ant.segment_idx >= segments.length) continue;
        const seg = segments[ant.segment_idx];
        const from = nodes[seg.from];
        const to = nodes[seg.to];
        if (!from || !to) continue;

        // Interpolate position
        const px = (from.x + (to.x - from.x) * ant.t) * W;
        const py = (from.y + (to.y - from.y) * ant.t) * H;

        // Angle along segment — ant faces the direction it's moving
        const dx = (to.x - from.x) * W;
        const dy = (to.y - from.y) * H;
        const segAngle = Math.atan2(dy, dx);
        // direction=1 means moving from->to, direction=-1 means to->from
        const angle = ant.direction >= 0 ? segAngle : segAngle + Math.PI;

        const sz = 3.5 * ant.size;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);

        drawAnt(ctx, sz, ant, frameCounter);

        ctx.restore();
      }

      rafId = requestAnimationFrame(draw);
    }

    function drawAnt(ctx, sz, ant, frame) {
      const isQueen = ant.type === 'queen';
      const isSoldier = ant.type === 'soldier';
      const bodyColor = isQueen ? '#3A2010' : '#2A1A0A';
      const legColor = '#3A2A1A';

      // Abdomen
      const abdR = sz * (isQueen ? 1.3 : 0.9);
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(-sz * 1.6, 0, abdR, abdR * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();

      // Thorax
      ctx.beginPath();
      ctx.ellipse(0, 0, sz * 0.6, sz * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head
      const headR = sz * (isSoldier ? 0.65 : 0.5);
      ctx.beginPath();
      ctx.ellipse(sz * 1.1, 0, headR, headR * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Mandibles (soldier has bigger ones)
      if (isSoldier) {
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sz * 1.6, -sz * 0.2);
        ctx.lineTo(sz * 2.2, -sz * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sz * 1.6, sz * 0.2);
        ctx.lineTo(sz * 2.2, sz * 0.5);
        ctx.stroke();
      }

      // Antennae
      ctx.strokeStyle = legColor;
      ctx.lineWidth = 0.8;
      const antWobble = Math.sin(frame * 0.08) * 0.2;
      ctx.beginPath();
      ctx.moveTo(sz * 1.4, -sz * 0.3);
      ctx.quadraticCurveTo(sz * 1.8, -sz * 0.9 + antWobble * sz, sz * 2.1, -sz * 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sz * 1.4, sz * 0.3);
      ctx.quadraticCurveTo(sz * 1.8, sz * 0.9 - antWobble * sz, sz * 2.1, sz * 0.7);
      ctx.stroke();

      // Legs — 3 pairs with tripod gait
      ctx.strokeStyle = legColor;
      ctx.lineWidth = 0.9;
      const legPhase = frame * 0.25;
      for (let pair = 0; pair < 3; pair++) {
        const lx = sz * (0.3 - pair * 0.5);
        // Tripod gait: pairs 0,2 in phase, pair 1 opposite
        const phase = (pair === 1) ? legPhase + Math.PI : legPhase;
        const swing = Math.sin(phase) * sz * 0.4;

        // Top leg
        const footY1 = -sz * 1.1 - swing * 0.3;
        ctx.beginPath();
        ctx.moveTo(lx, -sz * 0.3);
        ctx.lineTo(lx + swing * 0.3, -sz * 0.7);
        ctx.lineTo(lx + swing * 0.5, footY1);
        ctx.stroke();

        // Bottom leg
        const footY2 = sz * 1.1 + swing * 0.3;
        ctx.beginPath();
        ctx.moveTo(lx, sz * 0.3);
        ctx.lineTo(lx - swing * 0.3, sz * 0.7);
        ctx.lineTo(lx - swing * 0.5, footY2);
        ctx.stroke();
      }

      // Cargo indicator
      if (ant.carrying) {
        const cargoColor = CARGO_COLORS[ant.carrying] || '#888';
        ctx.fillStyle = cargoColor;
        ctx.beginPath();
        ctx.arc(sz * 0.3, -sz * 0.9, sz * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function darken(hex, factor) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return '#' + [r, g, b].map(c => Math.round(c * factor).toString(16).padStart(2, '0')).join('');
    }

    function lighten(hex, factor) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return '#' + [r, g, b].map(c => Math.min(255, Math.round(c + (255 - c) * factor)).toString(16).padStart(2, '0')).join('');
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
