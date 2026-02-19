/**
 * CCTV Mosaic — 2x2 surveillance camera grid with procedural scenes,
 * scan lines, timestamps, motion indicators, and status overlays.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    textDim: get('--color-text-dim'),
    textMain:get('--color-text-primary'),
    border:  get('--color-border'),
    error:   get('--color-error'),
    warn:    get('--color-warn'),
  };
}

/* ── Procedural scene drawing helpers ───────────────────────── */

function drawHallway(ctx, x, y, w, h, col) {
  // Perspective lines converging to a central vanishing point
  const cx = x + w / 2;
  const cy = y + h / 2;
  const inset = Math.min(w, h) * 0.25;
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;

  // Inner rectangle (far end of hallway)
  ctx.strokeRect(cx - inset / 2, cy - inset / 2, inset, inset);

  // Four converging lines from corners to inner rectangle
  ctx.beginPath();
  ctx.moveTo(x, y);           ctx.lineTo(cx - inset / 2, cy - inset / 2);
  ctx.moveTo(x + w, y);       ctx.lineTo(cx + inset / 2, cy - inset / 2);
  ctx.moveTo(x, y + h);       ctx.lineTo(cx - inset / 2, cy + inset / 2);
  ctx.moveTo(x + w, y + h);   ctx.lineTo(cx + inset / 2, cy + inset / 2);
  ctx.stroke();

  // Floor line
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.7); ctx.lineTo(x + w, y + h * 0.7);
  ctx.stroke();
}

function drawLot(ctx, x, y, w, h, col) {
  // Grid of parking space rectangles
  ctx.strokeStyle = col;
  ctx.lineWidth = 0.7;
  const cols = 4;
  const rows = 3;
  const pw = w / (cols + 1);
  const ph = h / (rows + 1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sx = x + pw * 0.5 + c * (pw + 2);
      const sy = y + ph * 0.5 + r * (ph + 2);
      ctx.strokeRect(sx, sy, pw * 0.85, ph * 0.7);
    }
  }
  // Horizontal lane lines
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.48); ctx.lineTo(x + w, y + h * 0.48);
  ctx.stroke();
}

function drawRoom(ctx, x, y, w, h, col) {
  // Simple box room outline with furniture rectangles
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  const pad = 6;
  ctx.strokeRect(x + pad, y + pad, w - pad * 2, h - pad * 2);
  // Table
  ctx.strokeRect(x + w * 0.3, y + h * 0.35, w * 0.4, h * 0.25);
  // Chair blobs
  ctx.strokeRect(x + w * 0.15, y + h * 0.4, w * 0.08, h * 0.12);
  ctx.strokeRect(x + w * 0.75, y + h * 0.4, w * 0.08, h * 0.12);
}

function drawCorridor(ctx, x, y, w, h, col) {
  // Long hallway with doors on the sides
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  // Walls
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y); ctx.lineTo(x + w * 0.2, y + h);
  ctx.moveTo(x + w * 0.8, y); ctx.lineTo(x + w * 0.8, y + h);
  ctx.stroke();
  // Doors on left wall
  for (let i = 0; i < 3; i++) {
    const dy = y + h * 0.15 + i * h * 0.28;
    ctx.strokeRect(x + w * 0.2, dy, w * 0.1, h * 0.15);
  }
  // Doors on right wall
  for (let i = 0; i < 3; i++) {
    const dy = y + h * 0.15 + i * h * 0.28;
    ctx.strokeRect(x + w * 0.7, dy, w * 0.1, h * 0.15);
  }
  // Floor line
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + h * 0.95); ctx.lineTo(x + w * 0.8, y + h * 0.95);
  ctx.stroke();
}

function drawEntrance(ctx, x, y, w, h, col) {
  // Archway with floor lines
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  const cx = x + w / 2;
  // Archway
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.25, y + h * 0.85);
  ctx.lineTo(cx - w * 0.25, y + h * 0.3);
  ctx.arc(cx, y + h * 0.3, w * 0.25, Math.PI, 0);
  ctx.lineTo(cx + w * 0.25, y + h * 0.85);
  ctx.stroke();
  // Floor perspective lines
  ctx.beginPath();
  for (let i = -2; i <= 2; i++) {
    ctx.moveTo(cx + i * w * 0.08, y + h * 0.85);
    ctx.lineTo(cx + i * w * 0.02, y + h * 0.55);
  }
  ctx.stroke();
  // Threshold line
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.85); ctx.lineTo(x + w, y + h * 0.85);
  ctx.stroke();
}

function drawStairwell(ctx, x, y, w, h, col) {
  // Zigzag staircase lines
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  const steps = 8;
  const stepW = w * 0.6 / steps;
  const stepH = h * 0.7 / steps;
  const sx = x + w * 0.2;
  const sy = y + h * 0.1;
  ctx.beginPath();
  for (let i = 0; i < steps; i++) {
    const px = sx + i * stepW;
    const py = sy + i * stepH;
    ctx.moveTo(px, py + stepH);
    ctx.lineTo(px + stepW, py + stepH);
    ctx.lineTo(px + stepW, py);
  }
  ctx.stroke();
  // Railing
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + steps * stepW, sy + steps * stepH);
  ctx.stroke();
  // Walls
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
}

function drawElevator(ctx, x, y, w, h, col) {
  // Box with door lines
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  const pad = 8;
  ctx.strokeRect(x + pad, y + pad, w - pad * 2, h - pad * 2);
  // Center door split
  const cx = x + w / 2;
  ctx.beginPath();
  ctx.moveTo(cx, y + h * 0.15);
  ctx.lineTo(cx, y + h * 0.85);
  ctx.stroke();
  // Door frame
  ctx.strokeRect(x + w * 0.2, y + h * 0.15, w * 0.6, h * 0.7);
  // Floor indicator
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.1, 3, 0, Math.PI * 2);
  ctx.stroke();
}

const sceneDrawers = {
  hallway:   drawHallway,
  lot:       drawLot,
  room:      drawRoom,
  corridor:  drawCorridor,
  entrance:  drawEntrance,
  stairwell: drawStairwell,
  elevator:  drawElevator,
};

/* ── Component ──────────────────────────────────────────────── */

export default {
  name: 'ActivityCctvMosaic',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;
    let frameCount = 0;

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) return;
      const state = props.activity?.state;
      const cameras = state?.cameras;
      if (!cameras || cameras.length === 0) { rafId = requestAnimationFrame(draw); return; }

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
      const c = getThemeColors();

      frameCount++;

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      // 2x2 grid with thin border
      const gap = 2;
      const cols = 2;
      const rows = 2;
      const cellW = (W - gap * (cols + 1)) / cols;
      const cellH = (H - gap * (rows + 1)) / rows;

      // Simulated timestamp: advance ~1s every 60 frames
      const totalSecs = Math.floor(frameCount / 60);
      const hh = String(Math.floor(totalSecs / 3600) % 24).padStart(2, '0');
      const mm = String(Math.floor(totalSecs / 60) % 60).padStart(2, '0');
      const ss = String(totalSecs % 60).padStart(2, '0');
      const timestamp = `${hh}:${mm}:${ss}`;

      const fontSize = Math.max(7, Math.min(11, cellW * 0.05));

      for (let idx = 0; idx < 4 && idx < cameras.length; idx++) {
        const cam = cameras[idx];
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const x = gap + col * (cellW + gap);
        const y = gap + row * (cellH + gap);

        // Cell background — black
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, cellW, cellH);

        if (cam.status === 'active') {
          // Dark tinted background based on brightness
          const brightness = cam.brightness || 0.7;
          const base = Math.floor(18 * brightness);
          ctx.fillStyle = `rgb(${base}, ${base + 2}, ${base})`;
          ctx.fillRect(x, y, cellW, cellH);

          // Procedural scene line art
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, cellW, cellH);
          ctx.clip();
          const sceneCol = c.accent1 + '55';
          const drawer = sceneDrawers[cam.scene_type] || drawRoom;
          drawer(ctx, x, y, cellW, cellH, sceneCol);
          ctx.restore();

          // Scan lines (every 3rd pixel, 30% opacity)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          for (let sy = 0; sy < cellH; sy += 3) {
            ctx.fillRect(x, y + sy, cellW, 1);
          }

          // Motion indicator — moving person-shaped rectangle
          if (cam.motion_detected) {
            const mx = x + Math.sin(frameCount * 0.04 + idx * 1.7) * cellW * 0.25 + cellW * 0.5;
            const my = y + Math.cos(frameCount * 0.025 + idx * 2.3) * cellH * 0.15 + cellH * 0.55;
            // Person-shaped: narrow rectangle (torso) + small head
            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.fillRect(mx - 4, my - 16, 8, 20);  // body
            ctx.beginPath();
            ctx.arc(mx, my - 20, 4, 0, Math.PI * 2);
            ctx.fill();
            // Motion label
            ctx.font = `bold ${Math.max(6, fontSize * 0.7)}px monospace`;
            ctx.fillStyle = c.warn;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText('MOTION', x + 4, y + cellH - fontSize - 4);
          }

          // REC indicator — slow pulsing red dot + text
          {
            const recAlpha = 0.5 + 0.5 * Math.sin(frameCount * 0.04);
            const recX = x + cellW - 40;
            const recY = y + cellH - fontSize - 4;
            ctx.globalAlpha = recAlpha;
            ctx.beginPath();
            ctx.arc(recX, recY + fontSize * 0.35, 3, 0, Math.PI * 2);
            ctx.fillStyle = c.error;
            ctx.fill();
            ctx.font = `bold ${Math.max(7, fontSize)}px monospace`;
            ctx.fillStyle = c.error;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText('REC', recX + 6, recY);
            ctx.globalAlpha = 1;
          }

        } else if (cam.status === 'static') {
          // Noise pattern — random grayscale pixels
          const imgData = ctx.createImageData(Math.ceil(cellW), Math.ceil(cellH));
          const data = imgData.data;
          const seed = cam.noise_seed + frameCount;
          for (let i = 0; i < data.length; i += 4) {
            const v = ((seed * 9301 + (i >> 2) * 49297 + frameCount * 233) % 233) & 0xff;
            const gray = v * 0.35;
            data[i]     = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
            data[i + 3] = 255;
          }
          ctx.putImageData(imgData, x, y);

          // STATIC label
          ctx.font = `bold ${Math.max(8, cellW * 0.06)}px monospace`;
          ctx.fillStyle = c.warn;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('STATIC', x + cellW / 2, y + cellH / 2);

        } else {
          // signal_lost — black with gently pulsing NO SIGNAL
          ctx.fillStyle = '#000';
          ctx.fillRect(x, y, cellW, cellH);

          {
            const nsAlpha = 0.4 + 0.6 * Math.sin(frameCount * 0.035);
            ctx.globalAlpha = Math.max(0, nsAlpha);
            ctx.font = `bold ${Math.max(8, cellW * 0.08)}px monospace`;
            ctx.fillStyle = c.error;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('NO SIGNAL', x + cellW / 2, y + cellH / 2);
            ctx.globalAlpha = 1;
          }
        }

        // ── Overlays common to all statuses ───────────────

        // Timestamp — top-left of quadrant
        ctx.font = `${fontSize}px monospace`;
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(timestamp, x + 4, y + 4);

        // Camera label — top-right of quadrant
        ctx.font = `${fontSize}px monospace`;
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(cam.label, x + cellW - 4, y + 4);

        // Thin border around each cell
        ctx.strokeStyle = c.border + '66';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cellW, cellH);
      }

      // Strategy label at very bottom
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const strategy = state.strategy || '';
      ctx.fillText(strategy.toUpperCase().replace(/_/g, ' '), 4, H - 2);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
