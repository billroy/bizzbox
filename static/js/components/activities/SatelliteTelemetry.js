/**
 * Satellite Telemetry — canvas-based dashboard with orbital arc, readout grid,
 * signal bar graph, LOS flash, and attitude (roll/pitch/yaw) display.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    textPri: get('--color-text-primary'),
    textDim: get('--color-text-dim'),
    error:   get('--color-error'),
    warn:    get('--color-warn'),
    border:  get('--color-border'),
  };
}

export default {
  name: 'ActivitySatelliteTelemetry',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;
    let losFlash = 0;

    function drawOrbitalArc(ctx, cx, cy, r, c) {
      // Small partial ellipse representing orbit, dot for satellite
      ctx.save();
      ctx.strokeStyle = c.accent1 + '88';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.45, -Math.PI / 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Satellite dot at ~45deg on orbit
      const angle = -Math.PI / 4;
      const sx = cx + Math.cos(angle) * r;
      const sy = cy + Math.sin(angle) * (r * 0.45);
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fillStyle = c.accent2;
      ctx.fill();

      // Solar panel lines
      ctx.strokeStyle = c.accent2 + 'cc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx - 6, sy);
      ctx.lineTo(sx + 6, sy);
      ctx.stroke();
      ctx.restore();
    }

    function drawSignalBar(ctx, x, y, w, h, pct, c) {
      ctx.fillStyle = c.border + '66';
      ctx.fillRect(x, y, w, h);
      const barW = w * Math.max(0, Math.min(1, pct / 100));
      const barColor = pct < 30 ? c.error : pct < 60 ? c.warn : c.accent1;
      ctx.fillStyle = barColor;
      ctx.fillRect(x, y, barW, h);
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
      const c = getThemeColors();

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const pad = 8;
      const topBarH = 22;

      // ── Top bar ─────────────────────────────────────────────────────
      // Satellite name (bold, accent1)
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'left';
      ctx.fillText(state.sat_name || 'UNKNOWN', pad, pad + 12);

      // Designator (dim)
      const nameW = ctx.measureText(state.sat_name || 'UNKNOWN').width;
      ctx.font = '10px monospace';
      ctx.fillStyle = c.textDim;
      ctx.fillText(state.designator || '', pad + nameW + 6, pad + 12);

      // Strategy label on right
      ctx.textAlign = 'right';
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.fillText(state.strategy || '', W - pad, pad + 12);
      ctx.textAlign = 'left';

      // Top bar separator line
      ctx.strokeStyle = c.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, pad + topBarH);
      ctx.lineTo(W - pad, pad + topBarH);
      ctx.stroke();

      // ── Orbital arc (upper right) ────────────────────────────────────
      const arcR = 28;
      const arcCx = W - pad - arcR - 4;
      const arcCy = pad + topBarH + arcR + 6;
      drawOrbitalArc(ctx, arcCx, arcCy, arcR, c);

      // ── Readout grid ─────────────────────────────────────────────────
      const gridTop = pad + topBarH + 8;
      const gridBot = H - pad;
      const gridH = gridBot - gridTop;

      // Reserve right side for orbital arc at top
      const leftColW = (W - pad * 2) * 0.5;
      const rightColX = pad + leftColW + 6;
      const rightColW = W - pad - rightColX;

      const readouts = [
        { label: 'ALT', value: state.orbit_alt_km != null ? state.orbit_alt_km + ' km' : '--' },
        { label: 'VEL', value: state.velocity_kms != null ? state.velocity_kms + ' km/s' : '--' },
        { label: 'SIG', value: state.signal_strength != null ? state.signal_strength + '%' : '--', bar: state.signal_strength },
        { label: 'UL',  value: state.uplink_kbps != null ? state.uplink_kbps + ' kbps' : '--' },
        { label: 'DL',  value: state.downlink_kbps != null ? state.downlink_kbps + ' kbps' : '--' },
        { label: 'BAT', value: state.battery_pct != null ? state.battery_pct + '%' : '--' },
        { label: 'SOL', value: state.solar_angle != null ? state.solar_angle + ' deg' : '--' },
        { label: 'R/P/Y', value: [state.roll, state.pitch, state.yaw].map(v => v != null ? v.toFixed(1) : '--').join('/') },
        { label: 'LAT', value: state.lat != null ? state.lat.toFixed(2) + '\u00b0' : '--' },
        { label: 'LON', value: state.lon != null ? state.lon.toFixed(2) + '\u00b0' : '--' },
        { label: 'PASS', value: state.next_pass || '--' },
        { label: 'LINK', value: state.link_margin_db != null ? state.link_margin_db + ' dB' : '--' },
      ];

      const colReadouts = [
        readouts.filter((_, i) => i % 2 === 0),
        readouts.filter((_, i) => i % 2 === 1),
      ];

      const labelH = 9;
      const valueH = 12;
      const rowH = labelH + valueH + 6;
      const colXs = [pad, rightColX];
      const colWs = [leftColW, rightColW];

      colReadouts.forEach((col, ci) => {
        col.forEach((item, ri) => {
          // Skip area used by orbital arc in col 1 for first 2 rows
          let rowOffsetY = gridTop + ri * rowH;
          if (ci === 1 && ri < 3) rowOffsetY = gridTop + (arcR * 2 + 16) + (ri * rowH);

          const x = colXs[ci];

          // Label
          ctx.font = '9px monospace';
          ctx.fillStyle = c.textDim;
          ctx.textAlign = 'left';
          ctx.fillText(item.label, x, rowOffsetY + labelH);

          // Value
          ctx.font = 'bold 11px monospace';
          ctx.fillStyle = c.textPri;
          ctx.fillText(item.value, x, rowOffsetY + labelH + valueH);

          // Signal bar if applicable
          if (item.bar != null) {
            const barY = rowOffsetY + labelH + valueH + 2;
            drawSignalBar(ctx, x, barY, colWs[ci] - 4, 3, item.bar, c);
          }
        });
      });

      // ── LOS flash ────────────────────────────────────────────────────
      if (state.los) {
        losFlash = (losFlash + 0.08) % (Math.PI * 2);
        const alpha = 0.5 + 0.5 * Math.sin(losFlash * 3);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = c.error;
        ctx.textAlign = 'center';
        ctx.fillText('LOSS OF SIGNAL', W / 2, H / 2);
        ctx.globalAlpha = 1;
        ctx.restore();
      } else {
        losFlash = 0;
      }

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
