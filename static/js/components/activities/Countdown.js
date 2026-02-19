/**
 * Countdown timer — canvas renderer with LCD-style digits and progress ring.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    warn:    get('--color-warn'),
    error:   get('--color-error'),
    textDim: get('--color-text-dim'),
    border:  get('--color-border'),
  };
}

// 7-segment active map per digit char
const SEG_MAP = {
  '0': [1,1,1,1,1,1,0], '1': [0,1,1,0,0,0,0], '2': [1,1,0,1,1,0,1],
  '3': [1,1,1,1,0,0,1], '4': [0,1,1,0,0,1,1], '5': [1,0,1,1,0,1,1],
  '6': [1,0,1,1,1,1,1], '7': [1,1,1,0,0,0,0], '8': [1,1,1,1,1,1,1],
  '9': [1,1,1,1,0,1,1],
};

function drawSegmentDigit(ctx, char, x, y, w, h, color, dimColor) {
  if (char === ':') {
    const r = w * 0.18;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.33, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.67, r, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (char === '.') {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x + w / 2, y + h - w * 0.25, w * 0.18, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const segs = SEG_MAP[char];
  if (!segs) return;

  const t = h * 0.065;
  const p = w * 0.1;
  const mw = w - p * 2;
  const mh = (h - p * 2) / 2;
  const sx = x + p;
  const sy = y + p;

  const defs = [
    [sx, sy, mw, t],                         // 0 top
    [sx + mw - t, sy, t, mh],                // 1 top-right
    [sx + mw - t, sy + mh, t, mh],           // 2 bot-right
    [sx, sy + mh * 2 - t, mw, t],            // 3 bottom
    [sx, sy + mh, t, mh],                    // 4 bot-left
    [sx, sy, t, mh],                         // 5 top-left
    [sx, sy + mh - t / 2, mw, t],            // 6 middle
  ];

  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = segs[i] ? color : dimColor;
    ctx.fillRect(defs[i][0], defs[i][1], defs[i][2], defs[i][3]);
  }
}

export default {
  name: 'ActivityCountdown',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;
    let lastSec = -1;
    let tickPulse = 0;

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

      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const display = state.display || '00:00:00.000';
      const phaseStyle = state.phase_style || 'normal';
      const phaseLabel = state.phase_label || 'COUNTDOWN';
      const remaining = state.remaining_ms || 0;
      const strategy = (state.strategy || '').toUpperCase().replace(/_/g, ' ');

      // Color based on phase
      let mainColor = c.accent1;
      if (phaseStyle === 'warn') mainColor = c.warn;
      if (phaseStyle === 'critical') mainColor = c.error;
      const dimSeg = c.border + '25';

      // Tick pulse (flashes on each second change)
      const curSec = Math.floor(remaining / 1000);
      if (curSec !== lastSec) { lastSec = curSec; tickPulse = 1.0; }
      tickPulse = Math.max(0, tickPulse - 0.03);

      const cx = W / 2;
      const cy = H / 2;
      const ringR = Math.min(W, H) * 0.38;

      // ── Progress ring ──
      const phases = state.phases || [];
      let phaseFrac = 0;
      if (phases.length > 0) {
        for (let i = 0; i < phases.length; i++) {
          if (remaining >= phases[i].threshold_ms) {
            const phaseStart = phases[i].threshold_ms;
            const phaseEnd = (i > 0) ? phases[i - 1].threshold_ms : phaseStart + 120000;
            phaseFrac = Math.max(0, Math.min(1, 1 - (remaining - phaseStart) / Math.max(1, phaseEnd - phaseStart)));
            break;
          }
        }
      }

      // Background ring
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = c.border + '40';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Progress arc
      const sa = -Math.PI / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, sa, sa + Math.PI * 2 * phaseFrac);
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 4;
      ctx.shadowBlur = 6 + tickPulse * 12;
      ctx.shadowColor = mainColor;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Tick marks
      for (let i = 0; i < 60; i++) {
        const a = sa + (Math.PI * 2 * i) / 60;
        const len = (i % 5 === 0) ? 7 : 3;
        const r1 = ringR + 5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * (r1 + len), cy + Math.sin(a) * (r1 + len));
        const on = (i / 60) <= phaseFrac;
        ctx.strokeStyle = on ? mainColor : (c.border + '30');
        ctx.lineWidth = (i % 5 === 0) ? 2 : 1;
        ctx.globalAlpha = on ? (0.7 + tickPulse * 0.3) : 0.25;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // ── Phase label ──
      ctx.font = `bold ${Math.max(9, H * 0.055)}px monospace`;
      ctx.fillStyle = mainColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.8 + tickPulse * 0.2;
      ctx.fillText(phaseLabel, cx, cy - ringR * 0.58);
      ctx.globalAlpha = 1;

      // ── LCD digits ──
      const chars = display.split('');
      const digitW = Math.min(W * 0.06, H * 0.13);
      const digitH = digitW * 1.65;
      const colonW = digitW * 0.45;
      const gap = digitW * 0.06;
      let totalW = 0;
      for (const ch of chars) totalW += (ch === ':' || ch === '.') ? colonW : digitW;
      totalW += gap * (chars.length - 1);

      let dx = cx - totalW / 2;
      const dy = cy - digitH / 2;
      for (const ch of chars) {
        const cw = (ch === ':' || ch === '.') ? colonW : digitW;
        drawSegmentDigit(ctx, ch, dx, dy, cw, digitH, mainColor, dimSeg);
        dx += cw + gap;
      }

      // ── T-MINUS ──
      ctx.font = `${Math.max(8, H * 0.045)}px monospace`;
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'center';
      ctx.fillText('T-MINUS', cx, cy + ringR * 0.55);

      // ── Strategy ──
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(strategy, 6, H - 4);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
