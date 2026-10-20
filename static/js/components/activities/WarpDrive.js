/** Animated warp reactor schematic driven by server coil health and telemetry. */
function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  const get = name => style.getPropertyValue(name).trim();
  return {
    bg: get('--color-surface'), border: get('--color-border'),
    accent1: get('--color-accent-1'), accent2: get('--color-accent-2'),
    accent3: get('--color-accent-3'), text: get('--color-text-primary'),
    dim: get('--color-text-dim'), warn: get('--color-warn'),
    error: get('--color-error'),
  };
}

const TAU = Math.PI * 2;

function strokeLine(ctx, x1, y1, x2, y2, color, width = 1, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function strokeEllipse(ctx, x, y, rx, ry, color, width, alpha) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawDiagnostic(ctx, x, y, width, height, label, value, maximum, color, dim, border, t) {
  const level = Math.max(0, Math.min(1, value / maximum));
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '8px monospace';
  ctx.fillStyle = dim;
  ctx.fillText(label, x + 5, y + 10, width - 10);
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = color;
  ctx.fillText(value.toFixed(1), x + 5, y + 25, width - 10);

  const barX = x + 5;
  const barY = y + height - 12;
  const barW = width - 10;
  ctx.fillStyle = border;
  ctx.fillRect(barX, barY, barW, 4);
  ctx.fillStyle = color;
  ctx.fillRect(barX, barY, barW * level, 4);
  // A moving trace makes the rate and current reading visible at a glance.
  ctx.beginPath();
  const traceTop = y + 34;
  const traceH = Math.max(4, barY - traceTop - 5);
  for (let i = 0; i <= 20; i++) {
    const px = barX + barW * i / 20;
    const wave = Math.sin(i * 0.82 - t * (1.4 + level * 3)) * Math.sin(i * 0.23 + t * 0.4);
    const py = traceTop + traceH * (0.5 - wave * (0.12 + level * 0.3));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.75;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export default {
  name: 'ActivityWarpDrive',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    function draw(ts) {
      const canvas = canvasRef.value;
      const state = props.activity?.state;
      if (!canvas || !state) { rafId = requestAnimationFrame(draw); return; }
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (!W || !H) { rafId = requestAnimationFrame(draw); return; }
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = getThemeColors();
      const readings = state.readings || {};
      const rings = state.rings || [];
      const alert = state.alert;
      const compact = W < 175 || H < 125;
      const header = compact ? 15 : 22;
      const footer = compact ? 19 : 35;
      const cx = W / 2;
      const cy = header + (H - header - footer) / 2;
      let R = Math.max(10, Math.min(W * 0.31, (H - header - footer) * 0.45));
      if (W >= 270 && H >= 170) R = Math.min(R, (cx - 64) / 1.36);
      const t = ts * 0.001;
      const phase = (state.phase || 0) + t * 0.35;

      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);
      const grid = Math.max(15, Math.round(W / 14));
      for (let x = grid / 2; x < W; x += grid) strokeLine(ctx, x, header, x, H - footer, c.accent2, 0.5, 0.11);
      for (let y = header; y < H - footer; y += grid) strokeLine(ctx, 0, y, W, y, c.accent2, 0.5, 0.11);
      const halo = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * 1.55);
      halo.addColorStop(0, c.accent2);
      halo.addColorStop(1, c.bg);
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = halo;
      ctx.fillRect(0, header, W, H - header - footer);
      ctx.globalAlpha = 1;

      // Two animated plasma feeds converge at the reaction chamber.
      const feedHalf = Math.max(3, R * 0.09);
      for (const side of [-1, 1]) {
        const y1 = side < 0 ? header + 3 : cy + R * 0.34;
        const y2 = side < 0 ? cy - R * 0.34 : H - footer - 3;
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = c.accent1;
        ctx.fillRect(cx - feedHalf * 2.2, y1, feedHalf * 4.4, y2 - y1);
        ctx.globalAlpha = 1;
        strokeLine(ctx, cx - feedHalf * 2, y1, cx - feedHalf * 2, y2, c.accent2, 1, 0.65);
        strokeLine(ctx, cx + feedHalf * 2, y1, cx + feedHalf * 2, y2, c.accent2, 1, 0.65);
        for (let i = 0; i < 3; i++) {
          const y = y1 + (y2 - y1) * (i + 0.5) / 3;
          strokeLine(ctx, cx - feedHalf * 2.5, y, cx + feedHalf * 2.5, y, c.accent3, 2, 0.55);
        }
        const beam = ctx.createLinearGradient(cx - feedHalf, 0, cx + feedHalf, 0);
        beam.addColorStop(0, c.accent2);
        beam.addColorStop(0.5, c.text);
        beam.addColorStop(1, c.accent1);
        ctx.globalAlpha = 0.5 + Math.sin(t * 4 + side) * 0.14;
        ctx.fillStyle = beam;
        ctx.fillRect(cx - feedHalf, y1, feedHalf * 2, y2 - y1);
        ctx.globalAlpha = 1;
        for (let i = 0; i < 5; i++) {
          const travel = (t * (0.5 + i * 0.07) + i * 0.27) % 1;
          const y = side < 0 ? y1 + (y2 - y1) * travel : y2 - (y2 - y1) * travel;
          strokeLine(ctx, cx - feedHalf * 0.7, y, cx + feedHalf * 0.7, y, c.text, 2, 0.7);
        }
      }

      strokeEllipse(ctx, cx, cy, R * 1.11, R * 0.89, c.border, 1, 0.8);
      strokeEllipse(ctx, cx, cy, R * 1.03, R * 0.81, c.accent2, 1, 0.4);
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12;
        strokeLine(ctx, cx + Math.cos(a) * R * 1.05, cy + Math.sin(a) * R * 0.83,
          cx + Math.cos(a) * R * 1.18, cy + Math.sin(a) * R * 0.94, c.accent3, 1, 0.55);
      }
      rings.forEach((ring, i) => {
        const rx = R * (0.35 + (ring.radius_frac || 0) * 0.95);
        const ry = rx * 0.78;
        const color = ring.status === 'unstable' ? c.error : ring.status === 'flicker' ? c.warn : i % 2 ? c.accent2 : c.accent1;
        const intensity = Math.max(0.2, Math.min(1, ring.intensity ?? 0.7));
        const flicker = ring.status === 'flicker' ? 0.55 + 0.45 * Math.sin(t * 19 + i) ** 2 : 1;
        strokeEllipse(ctx, cx, cy, rx, ry, color, 1, 0.2 + intensity * 0.2);
        const rotation = phase * (ring.pulse_speed || 0.4) * (i % 2 ? -1 : 1);
        for (let segment = 0; segment < 4; segment++) {
          const start = rotation + segment * TAU / 4;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, start, start + TAU / 9);
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(1.5, R * 0.022);
          ctx.globalAlpha = (0.45 + intensity * 0.48) * flicker;
          ctx.stroke();
          const a = start + TAU / 9;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, Math.max(1, R * 0.025), 0, TAU);
          ctx.fillStyle = color;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      });

      // Reaction pulses cross the chamber in time with the live flow reading.
      const flow = Math.max(0, Math.min(1, (readings.antimatter_flow || 0) / 100));
      const pulseRate = 0.35 + flow * 1.3;
      for (const side of [-1, 1]) {
        const conduitEnd = cx + side * R * 1.36;
        const conduitStart = cx + side * R * 0.25;
        strokeLine(ctx, conduitStart, cy, conduitEnd, cy, c.accent2, 2, 0.28);
        for (let i = 0; i < 3; i++) {
          const progress = (t * pulseRate + i / 3) % 1;
          const x = conduitEnd + (conduitStart - conduitEnd) * progress;
          ctx.beginPath();
          ctx.arc(x, cy, Math.max(1.5, R * 0.025), 0, TAU);
          ctx.fillStyle = i === 0 ? c.text : c.accent1;
          ctx.globalAlpha = 0.35 + progress * 0.6;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Large windows have room for instruments that respond to actual telemetry.
      const sideRoom = cx - R * 1.36;
      if (W >= 270 && H >= 170 && sideRoom >= 64) {
        const panelW = Math.min(70, sideRoom - 16);
        const panelH = Math.min(88, Math.max(55, H - header - footer - 18));
        const panelY = cy - panelH / 2;
        const containment = Number(readings.containment_pct) || 0;
        const containmentColor = containment < 88 ? c.error : containment < 92 ? c.warn : c.accent2;
        drawDiagnostic(ctx, 8, panelY, panelW, panelH, 'INJECTION', Number(readings.antimatter_flow) || 0,
          100, c.accent1, c.dim, c.border, t);
        drawDiagnostic(ctx, W - panelW - 8, panelY, panelW, panelH, 'FIELD %', containment,
          100, containmentColor, c.dim, c.border, t);
        strokeLine(ctx, 8 + panelW, cy, cx - R * 1.35, cy, c.accent1, 1, 0.38);
        strokeLine(ctx, cx + R * 1.35, cy, W - panelW - 8, cy, containmentColor, 1, 0.38);
      }

      // Faceted core and filaments make the center the focus of the schematic.
      for (let i = 0; i < 6; i++) {
        const a = t * (i % 2 ? -0.65 : 0.7) + i * TAU / 6;
        strokeLine(ctx, cx + Math.cos(a) * R * 0.72, cy + Math.sin(a) * R * 0.55,
          cx, cy, i % 2 ? c.accent2 : c.accent3, 1, 0.16 + 0.12 * Math.sin(t * 3 + i) ** 2);
      }
      const crystalR = R * 0.28 * (1 + Math.sin(t * 3 + phase) * 0.07);
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, crystalR * 2.4);
      glow.addColorStop(0, c.text);
      glow.addColorStop(0.28, c.accent1);
      glow.addColorStop(1, c.bg);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, crystalR * 2.4, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - crystalR * 1.35);
      ctx.lineTo(cx + crystalR * 0.85, cy);
      ctx.lineTo(cx, cy + crystalR * 1.35);
      ctx.lineTo(cx - crystalR * 0.85, cy);
      ctx.closePath();
      ctx.fillStyle = c.accent2;
      ctx.fill();
      ctx.strokeStyle = c.text;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      strokeLine(ctx, cx, cy - crystalR * 1.35, cx, cy + crystalR * 1.35, c.text, 1, 0.7);
      strokeLine(ctx, cx - crystalR * 0.85, cy, cx + crystalR * 0.85, cy, c.text, 1, 0.7);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2, crystalR * 0.2), 0, TAU);
      ctx.fillStyle = c.text;
      ctx.fill();

      strokeLine(ctx, 0, header - 1, W, header - 1, c.border, 1, 0.75);
      strokeLine(ctx, 0, H - footer, W, H - footer, c.border, 1, 0.75);
      ctx.font = `${compact ? 8 : 9}px monospace`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = alert ? alert.includes('WARNING') ? c.error : c.warn : c.accent1;
      ctx.fillText(alert || 'CORE STABLE', 7, header / 2, W >= 250 ? W * 0.65 : W - 14);
      if (W >= 250) {
        ctx.textAlign = 'right';
        ctx.fillStyle = c.dim;
        ctx.fillText('FTL // ONLINE', W - 7, header / 2, W * 0.34);
      }

      const metrics = [
        ['WARP', readings.warp_factor, ''],
        ['CONTAIN', readings.containment_pct, '%'],
        ['PLASMA', readings.plasma_temp_mk, 'MK'],
        ['FLOW', readings.antimatter_flow, ''],
      ].filter(([, value]) => typeof value === 'number');
      const visible = compact ? metrics.slice(0, 2) : metrics;
      const colW = W / Math.max(1, visible.length);
      visible.forEach(([label, value, unit], i) => {
        const x = (i + 0.5) * colW;
        if (i) strokeLine(ctx, i * colW, H - footer + 4, i * colW, H - 4, c.border, 1, 0.45);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (!compact) {
          ctx.font = '8px monospace';
          ctx.fillStyle = c.dim;
          ctx.fillText(label, x, H - 24, colW - 5);
        }
        ctx.font = `bold ${compact ? 10 : 12}px monospace`;
        ctx.fillStyle = label === 'CONTAIN' && value < 92 ? value < 88 ? c.error : c.warn : c.accent1;
        ctx.fillText(`${value.toFixed(1)}${unit}`, x, H - (compact ? 9 : 11), colW - 5);
      });

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId !== null) cancelAnimationFrame(rafId); });
    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
