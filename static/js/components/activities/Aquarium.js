/**
 * Aquarium activity — canvas-rendered fish tank with betta fish
 * featuring glorious flowing fins, bubbles, plants, and rocks.
 */

const PALETTES = {
  tropical_reef:  ['#FF6B35', '#3498DB', '#F1C40F', '#2ECC71', '#9B59B6', '#E91E63'],
  deep_sea:       ['#00FFFF', '#FF00FF', '#00FF88', '#4466FF', '#8800CC', '#00AAFF'],
  koi_pond:       ['#FF6600', '#FFFFFF', '#CC0000', '#FFD700', '#333333', '#FF8844'],
  jellyfish_drift:['#FF69B4', '#87CEEB', '#DDA0DD', '#98FB98', '#FFB6C1', '#E0FFFF'],
  coral_garden:   ['#FF7F50', '#FF4500', '#FFD700', '#00CED1', '#FF69B4', '#32CD32'],
};

const WATER_COLORS = {
  tropical_reef:  { top: '#1a6b8a', bot: '#0d3d50' },
  deep_sea:       { top: '#0a1628', bot: '#050d18' },
  koi_pond:       { top: '#2a7a5a', bot: '#1a4a3a' },
  jellyfish_drift:{ top: '#1a2a5a', bot: '#0d1830' },
  coral_garden:   { top: '#1a6070', bot: '#0d3540' },
};

const SAND_COLORS = {
  tropical_reef:  '#c2a66a',
  deep_sea:       '#2a3040',
  koi_pond:       '#8a7a5a',
  jellyfish_drift:'#2a2a4a',
  coral_garden:   '#b8956a',
};

export default {
  name: 'ActivityAquarium',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;
    let frameCounter = 0;

    // Client-side bubble positions (animated locally)
    let bubblePositions = null;

    function initBubbles(bubbles) {
      bubblePositions = bubbles.map(b => ({
        x: b.x,
        speed: b.speed,
        dots: Array.from({ length: rnd(2, 4) }, () => ({
          y: rnd(0.1, 0.95),
          r: rnd(1.5, 4),
          wobblePhase: rnd(0, Math.PI * 2),
        })),
      }));
    }

    function rnd(min, max) {
      return min + Math.random() * (max - min);
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
        canvas.width = W * dpr;
        canvas.height = H * dpr;
      }

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      frameCounter++;

      const strategy = state.strategy || 'tropical_reef';
      const palette = PALETTES[strategy] || PALETTES.tropical_reef;
      const water = WATER_COLORS[strategy] || WATER_COLORS.tropical_reef;
      const sandColor = SAND_COLORS[strategy] || SAND_COLORS.tropical_reef;

      // --- Background: water gradient ---
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, water.top);
      grad.addColorStop(1, water.bot);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // --- Sand floor ---
      const sandH = H * 0.06;
      ctx.fillStyle = sandColor;
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, H - sandH);
      for (let px = 0; px <= W; px += 8) {
        const sy = H - sandH + Math.sin(px * 0.03 + 1.5) * 3;
        ctx.lineTo(px, sy);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();

      const decorations = state.decorations;

      // --- Rocks ---
      if (decorations?.rocks) {
        for (const rock of decorations.rocks) {
          const rx = rock.x * W;
          const rw = rock.w * W;
          const rh = rock.h * H;
          const ry = H - sandH - rh * 0.5;
          ctx.fillStyle = darken(sandColor, 0.6);
          ctx.beginPath();
          ctx.ellipse(rx, ry, rw / 2, rh, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = darken(sandColor, 0.5);
          ctx.beginPath();
          ctx.ellipse(rx, ry - rh * 0.15, rw / 2 * 0.9, rh * 0.7, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // --- Plants ---
      if (decorations?.plants) {
        for (const plant of decorations.plants) {
          const px = plant.x * W;
          const baseY = H - sandH;
          const ph = plant.height * H;
          const sway = Math.sin(frameCounter * 0.015 + plant.x * 12) * 6;
          const greenShade = plant.type === 0 ? '#2d8a4e' : plant.type === 1 ? '#1a6a3a' : '#3aaa5e';
          ctx.strokeStyle = greenShade;
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          const fronds = 3 + plant.type;
          for (let i = 0; i < fronds; i++) {
            const angle = ((i / (fronds - 1)) - 0.5) * 0.6;
            const tipX = px + sway + angle * 20;
            const tipY = baseY - ph * (0.7 + i * 0.08);
            ctx.beginPath();
            ctx.moveTo(px, baseY);
            ctx.quadraticCurveTo(px + sway * 0.5 + angle * 10, baseY - ph * 0.5, tipX, tipY);
            ctx.stroke();
            ctx.fillStyle = greenShade + 'aa';
            ctx.beginPath();
            ctx.ellipse(tipX, tipY, 4, 7, angle, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // --- Bubbles ---
      if (decorations?.bubbles) {
        if (!bubblePositions) initBubbles(decorations.bubbles);
        ctx.strokeStyle = 'rgba(180, 220, 255, 0.35)';
        ctx.lineWidth = 0.8;
        for (const col of bubblePositions) {
          for (const dot of col.dots) {
            dot.y -= col.speed * 0.4;
            if (dot.y < -0.02) dot.y = 0.98 + Math.random() * 0.05;
            const bx = col.x * W + Math.sin(frameCounter * 0.03 + dot.wobblePhase) * 3;
            const by = dot.y * H;
            ctx.beginPath();
            ctx.arc(bx, by, dot.r, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      // --- Fish ---
      const fish = state.fish || [];
      for (const f of fish) {
        const fx = f.x * W;
        const fy = f.y * H;
        const color = palette[f.color_idx % palette.length];
        const sz = 10 * f.size;

        ctx.save();
        ctx.translate(fx, fy);
        ctx.scale(f.facing, 1);

        if (f.type === 'jellyfish') {
          drawJellyfish(ctx, sz, color, frameCounter, f.phase);
        } else {
          drawBetta(ctx, sz, color, frameCounter, f.phase, f.type);
        }

        ctx.restore();
      }

      rafId = requestAnimationFrame(draw);
    }

    function drawBetta(ctx, sz, color, frame, phase, type) {
      const t = frame * 0.06 + phase;  // animation time
      const bodyW = sz * 1.2;
      const bodyH = sz * 0.55;
      const finColor = color;
      const finColor2 = lighten(color, 0.25);
      const darkFin = darken(color, 0.7);

      // --- Flowing caudal tail (large, layered, wavy) ---
      ctx.globalAlpha = 0.45;
      // Outer tail layer (largest, most transparent)
      drawFlowingFin(ctx, -bodyW * 0.5, 0, sz * 1.8, sz * 1.6, t, 0.7, finColor2, phase);
      ctx.globalAlpha = 0.55;
      // Middle tail layer
      drawFlowingFin(ctx, -bodyW * 0.45, 0, sz * 1.4, sz * 1.3, t * 1.1, 0.6, finColor, phase + 0.5);
      ctx.globalAlpha = 0.7;
      // Inner tail layer (smallest, most opaque)
      drawFlowingFin(ctx, -bodyW * 0.4, 0, sz * 1.0, sz * 0.9, t * 1.2, 0.5, darkFin, phase + 1.0);
      ctx.globalAlpha = 1;

      // --- Dorsal fin (flowing on top) ---
      ctx.globalAlpha = 0.5;
      drawDorsalFin(ctx, sz, finColor, frame, phase);
      ctx.globalAlpha = 1;

      // --- Ventral/anal fin (flowing underneath) ---
      ctx.globalAlpha = 0.45;
      drawVentralFin(ctx, sz, finColor2, frame, phase);
      ctx.globalAlpha = 1;

      // --- Body ---
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, bodyW * 0.55, bodyH, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shimmery highlight on body
      ctx.fillStyle = lighten(color, 0.4) + '44';
      ctx.beginPath();
      ctx.ellipse(bodyW * 0.1, -bodyH * 0.2, bodyW * 0.3, bodyH * 0.35, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Darker underside
      ctx.fillStyle = darken(color, 0.75) + '33';
      ctx.beginPath();
      ctx.ellipse(0, bodyH * 0.3, bodyW * 0.45, bodyH * 0.35, 0, 0, Math.PI);
      ctx.fill();

      // --- Pectoral fins (small, flowing) ---
      ctx.globalAlpha = 0.4;
      const pectPhase = Math.sin(frame * 0.08 + phase) * 0.4;
      ctx.fillStyle = finColor2;
      ctx.beginPath();
      ctx.moveTo(bodyW * 0.05, bodyH * 0.3);
      ctx.quadraticCurveTo(
        bodyW * 0.05 - sz * 0.3, bodyH * 0.3 + sz * 0.5 + pectPhase * sz * 0.3,
        bodyW * 0.05 - sz * 0.15, bodyH * 0.3 + sz * 0.7 + pectPhase * sz * 0.2
      );
      ctx.quadraticCurveTo(
        bodyW * 0.15, bodyH * 0.3 + sz * 0.3,
        bodyW * 0.05, bodyH * 0.3
      );
      ctx.fill();
      ctx.globalAlpha = 1;

      // --- Eye ---
      const eyeX = bodyW * 0.3;
      const eyeY = -bodyH * 0.12;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, sz * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(eyeX + sz * 0.025, eyeY, sz * 0.055, 0, Math.PI * 2);
      ctx.fill();

      // --- Mouth line ---
      ctx.strokeStyle = darken(color, 0.5);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(bodyW * 0.52, bodyH * 0.05);
      ctx.lineTo(bodyW * 0.56, bodyH * 0.1);
      ctx.stroke();
    }

    function drawFlowingFin(ctx, originX, originY, lenX, lenY, t, waveMag, color, phaseOff) {
      // Draw a multi-curve flowing fin trailing behind the fish
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(originX, originY);

      const segments = 6;
      // Top edge of fin — wavy
      for (let i = 1; i <= segments; i++) {
        const frac = i / segments;
        const x = originX - lenX * frac;
        const waveY = Math.sin(t * 1.5 + frac * 4 + phaseOff) * lenY * waveMag * frac;
        const y = originY - lenY * 0.5 * frac + waveY;
        const cx = originX - lenX * (frac - 0.5 / segments);
        const cwaveY = Math.sin(t * 1.5 + (frac - 0.5 / segments) * 4 + phaseOff) * lenY * waveMag * (frac - 0.5 / segments);
        const cy = originY - lenY * 0.3 * (frac - 0.5 / segments) + cwaveY;
        ctx.quadraticCurveTo(cx, cy, x, y);
      }
      // Bottom edge of fin — wavy in opposite direction
      for (let i = segments; i >= 1; i--) {
        const frac = i / segments;
        const x = originX - lenX * frac;
        const waveY = Math.sin(t * 1.5 + frac * 4 + phaseOff + 2) * lenY * waveMag * frac;
        const y = originY + lenY * 0.5 * frac + waveY;
        const cx = originX - lenX * (frac + 0.5 / segments);
        const cwaveY = Math.sin(t * 1.5 + (frac + 0.5 / segments) * 4 + phaseOff + 2) * lenY * waveMag * frac;
        const cy = originY + lenY * 0.3 * (frac + 0.5 / segments) + cwaveY;
        ctx.quadraticCurveTo(cx, cy, x, y);
      }
      ctx.closePath();
      ctx.fill();
    }

    function drawDorsalFin(ctx, sz, color, frame, phase) {
      const t = frame * 0.05 + phase;
      const bodyW = sz * 1.2;
      const bodyH = sz * 0.55;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(bodyW * 0.2, -bodyH * 0.85);

      // Flowing dorsal — extends backward with wave
      const points = 5;
      for (let i = 0; i <= points; i++) {
        const frac = i / points;
        const x = bodyW * 0.2 - bodyW * 0.8 * frac;
        const wave = Math.sin(t * 1.3 + frac * 3 + phase) * sz * 0.25 * frac;
        const y = -bodyH * 0.85 - sz * 0.6 * Math.sin(frac * Math.PI * 0.8) + wave;
        if (i === 0) ctx.lineTo(x, y);
        else ctx.lineTo(x, y);
      }
      // Return along body top
      ctx.lineTo(-bodyW * 0.4, -bodyH * 0.5);
      ctx.lineTo(bodyW * 0.1, -bodyH * 0.8);
      ctx.closePath();
      ctx.fill();
    }

    function drawVentralFin(ctx, sz, color, frame, phase) {
      const t = frame * 0.05 + phase;
      const bodyW = sz * 1.2;
      const bodyH = sz * 0.55;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(bodyW * 0.0, bodyH * 0.7);

      const points = 4;
      for (let i = 0; i <= points; i++) {
        const frac = i / points;
        const x = bodyW * 0.0 - bodyW * 0.6 * frac;
        const wave = Math.sin(t * 1.2 + frac * 3 + phase + 1) * sz * 0.2 * frac;
        const y = bodyH * 0.7 + sz * 0.5 * Math.sin(frac * Math.PI * 0.7) + wave;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(-bodyW * 0.35, bodyH * 0.4);
      ctx.lineTo(bodyW * 0.0, bodyH * 0.6);
      ctx.closePath();
      ctx.fill();
    }

    function drawJellyfish(ctx, sz, color, frame, phase) {
      const domeW = sz * 1.0;
      const domeH = sz * 0.7;
      const pulse = 1 + Math.sin(frame * 0.04 + phase) * 0.08;

      ctx.globalAlpha = 0.55;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, domeW * pulse, domeH * pulse, 0, Math.PI, 0);
      ctx.fill();

      ctx.fillStyle = lighten(color, 0.4) + '44';
      ctx.beginPath();
      ctx.ellipse(0, -domeH * 0.2, domeW * 0.5 * pulse, domeH * 0.4 * pulse, 0, Math.PI, 0);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      const tentacles = 5;
      for (let i = 0; i < tentacles; i++) {
        const tx = ((i / (tentacles - 1)) - 0.5) * domeW * 1.4;
        ctx.beginPath();
        ctx.moveTo(tx, domeH * 0.1);
        const len = sz * (0.8 + Math.sin(frame * 0.02 + i + phase) * 0.3);
        const wobble = Math.sin(frame * 0.05 + i * 1.5 + phase) * sz * 0.3;
        ctx.quadraticCurveTo(tx + wobble, domeH * 0.1 + len * 0.5, tx + wobble * 0.5, domeH * 0.1 + len);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function darken(hex, factor) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
    }

    function lighten(hex, factor) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgb(${Math.min(255, Math.round(r + (255 - r) * factor))},${Math.min(255, Math.round(g + (255 - g) * factor))},${Math.min(255, Math.round(b + (255 - b) * factor))})`;
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
