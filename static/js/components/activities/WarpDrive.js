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
      const R = Math.max(10, Math.min(W * 0.31, (H - header - footer) * 0.45));
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
