/**
 * Sonar bearing-time waterfall display with contact tracking.
 * X axis = bearing (0-360), Y axis = time (newest at top, scrolling down).
 * Contacts shown as vertical dashed bearing lines with classification labels.
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
    textMain:get('--color-text-primary'),
    border:  get('--color-border'),
    error:   get('--color-error'),
    warn:    get('--color-warn'),
  };
}

/**
 * Map a 0-255 intensity value to an RGB color string.
 * Gradient: bg (dark) -> deep blue -> green -> yellow -> white.
 */
function intensityToColor(v, bgColor) {
  v = Math.max(0, Math.min(255, v));
  const t = v / 255;
  let r, g, b;
  if (t < 0.15) {
    // Very low: near background -> dark blue
    const f = t / 0.15;
    r = 0;
    g = 0;
    b = Math.round(f * 80);
  } else if (t < 0.35) {
    // Dark blue -> blue-green
    const f = (t - 0.15) / 0.20;
    r = 0;
    g = Math.round(f * 120);
    b = Math.round(80 + f * 80);
  } else if (t < 0.55) {
    // Blue-green -> green
    const f = (t - 0.35) / 0.20;
    r = 0;
    g = Math.round(120 + f * 100);
    b = Math.round(160 - f * 160);
  } else if (t < 0.75) {
    // Green -> yellow
    const f = (t - 0.55) / 0.20;
    r = Math.round(f * 255);
    g = Math.round(220 + f * 35);
    b = 0;
  } else {
    // Yellow -> white
    const f = (t - 0.75) / 0.25;
    r = 255;
    g = 255;
    b = Math.round(f * 255);
  }
  return `rgb(${r},${g},${b})`;
}

export default {
  name: 'ActivitySonar',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;
    let blinkOn = true;
    let blinkTimer = 0;

    function draw(ts) {
      const canvas = canvasRef.value;
      if (!canvas) { rafId = requestAnimationFrame(draw); return; }
      const state = props.activity?.state;
      const waterfall = state?.waterfall;
      if (!waterfall || waterfall.length === 0) { rafId = requestAnimationFrame(draw); return; }

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

      // Blink toggle for torpedo indicators (~500ms)
      blinkTimer += 16;
      if (blinkTimer > 500) {
        blinkOn = !blinkOn;
        blinkTimer = 0;
      }

      // Layout regions
      const AXIS_TOP = 18;     // bearing scale at top
      const TIME_W = 28;       // time scale at left
      const INFO_H = 20;       // bottom info bar
      const plotX = TIME_W;
      const plotY = AXIS_TOP;
      const plotW = W - TIME_W;
      const plotH = H - AXIS_TOP - INFO_H;

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const rows = waterfall.length;
      const cols = waterfall[0].length;
      const cellW = plotW / cols;
      const cellH = plotH / rows;

      // ── Waterfall grid ────────────────────────────────────────
      for (let row = 0; row < rows; row++) {
        const y = plotY + row * cellH;
        const rowData = waterfall[row];
        for (let b = 0; b < cols; b++) {
          ctx.fillStyle = intensityToColor(rowData[b], c.bg);
          ctx.fillRect(plotX + b * cellW, y, Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
        }
      }

      // ── Bearing scale at top ──────────────────────────────────
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, AXIS_TOP);
      ctx.strokeStyle = c.border + 'aa';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(plotX, AXIS_TOP);
      ctx.lineTo(W, AXIS_TOP);
      ctx.stroke();

      ctx.font = '8px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'center';
      const bearingMarks = [0, 45, 90, 135, 180, 225, 270, 315, 360];
      for (const deg of bearingMarks) {
        const x = plotX + (deg / 360) * plotW;
        ctx.fillStyle = c.textDim;
        ctx.fillText(deg + '\u00B0', x, AXIS_TOP - 4);
        ctx.strokeStyle = c.border + '44';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, AXIS_TOP);
        ctx.lineTo(x, AXIS_TOP + 4);
        ctx.stroke();
      }

      // ── Time scale at left ────────────────────────────────────
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, AXIS_TOP, TIME_W, plotH);
      ctx.strokeStyle = c.border + 'aa';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(TIME_W, AXIS_TOP);
      ctx.lineTo(TIME_W, AXIS_TOP + plotH);
      ctx.stroke();

      ctx.font = '7px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'right';
      const timeMarks = 5;
      for (let i = 0; i <= timeMarks; i++) {
        const y = plotY + (plotH / timeMarks) * i;
        const label = i === 0 ? 'NOW' : '-' + i + 's';
        ctx.fillText(label, TIME_W - 3, y + 3);
        if (i > 0) {
          ctx.strokeStyle = c.border + '22';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(TIME_W, y);
          ctx.lineTo(W, y);
          ctx.stroke();
        }
      }

      // ── Sweep indicator (bright vertical line) ────────────────
      if (state.sweep_bearing !== undefined) {
        const sweepX = plotX + (state.sweep_bearing / 360) * plotW;
        ctx.strokeStyle = c.accent1;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(sweepX, plotY);
        ctx.lineTo(sweepX, plotY + plotH);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      // ── Contact bearing lines + labels ────────────────────────
      const contacts = state.contacts || [];
      for (const ct of contacts) {
        const bx = plotX + (ct.bearing / 360) * plotW;

        // Color based on classification
        let lineColor = c.textDim;
        if (ct.classification === 'merchant')   lineColor = c.accent2;
        if (ct.classification === 'submarine')  lineColor = c.error;
        if (ct.classification === 'whale')      lineColor = c.accent3;
        if (ct.classification === 'fishing')    lineColor = c.accent2;
        if (ct.classification === 'torpedo') {
          lineColor = c.error;
          if (!blinkOn) continue; // blink effect for torpedo
        }

        // Dashed vertical bearing line
        ctx.save();
        ctx.strokeStyle = lineColor + 'aa';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(bx, plotY);
        ctx.lineTo(bx, plotY + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Label background
        const labelText = ct.label + ' ' + ct.confidence + '%';
        ctx.font = '8px monospace';
        const tw = ctx.measureText(labelText).width;
        const lx = Math.min(bx + 4, W - tw - 4);
        const ly = plotY + 10;

        ctx.fillStyle = c.bg + 'cc';
        ctx.fillRect(lx - 2, ly - 8, tw + 4, 11);

        ctx.fillStyle = lineColor;
        ctx.textAlign = 'left';
        ctx.fillText(labelText, lx, ly);

        // Classification below label
        ctx.font = '7px monospace';
        ctx.fillStyle = lineColor + 'cc';
        ctx.fillText(ct.classification.toUpperCase(), lx, ly + 9);
      }

      // ── Bottom info bar ───────────────────────────────────────
      const infoY = H - INFO_H;
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, infoY, W, INFO_H);
      ctx.strokeStyle = c.border + 'aa';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, infoY);
      ctx.lineTo(W, infoY);
      ctx.stroke();

      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = c.textDim;
      const noiseStr = 'NOISE: ' + (state.noise_floor !== undefined ? state.noise_floor.toFixed(1) : '--');
      ctx.fillText(noiseStr, 4, infoY + 13);

      ctx.textAlign = 'center';
      ctx.fillStyle = c.accent1;
      ctx.fillText('CONTACTS: ' + contacts.length, W / 2, infoY + 13);

      ctx.textAlign = 'right';
      ctx.fillStyle = c.accent2 + 'cc';
      const stratLabel = (state.strategy || '').toUpperCase().replace(/_/g, ' ');
      ctx.fillText(stratLabel, W - 4, infoY + 13);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
