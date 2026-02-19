/**
 * Mission Control — rocket launch countdown with T-minus clock, GO/NO-GO polling,
 * telemetry streams, and event log. Canvas RAF loop.
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

export default {
  name: 'ActivityMissionControl',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;
    let frameCount = 0;

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) { rafId = requestAnimationFrame(draw); return; }
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
      frameCount++;

      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const tMinus = state.t_minus || 0;
      const counting = state.counting;
      const hold = state.hold;
      const stations = state.stations || [];
      const telemetry = state.telemetry || {};
      const events = state.events_log || [];
      const vehicle = state.vehicle || 'VEHICLE';
      const abortMode = state.abort_mode || 'NOMINAL';

      // --- T-minus clock ---
      const min = Math.floor(tMinus / 60);
      const sec = tMinus % 60;
      const tStr = counting ? `T-${min}:${sec.toString().padStart(2, '0')}` : `T+${min}:${sec.toString().padStart(2, '0')}`;

      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      if (hold) {
        // Blinking HOLD
        ctx.fillStyle = Math.floor(frameCount / 10) % 2 === 0 ? c.error : c.bg;
        ctx.fillText('HOLD', W / 2, 4);
      } else {
        ctx.fillStyle = counting ? c.accent1 : c.accent2;
        ctx.fillText(tStr, W / 2, 4);
      }

      // Vehicle name
      ctx.font = '8px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.fillText(vehicle, 6, 6);

      // Abort mode
      ctx.textAlign = 'right';
      ctx.fillStyle = abortMode === 'NOMINAL' ? c.accent2 : c.warn;
      ctx.fillText(abortMode, W - 6, 6);

      // --- GO/NO-GO grid ---
      const pollY = 26;
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'left';
      ctx.fillText('GO/NO-GO POLL', 6, pollY);

      const cols = Math.min(4, Math.floor(W / 90));
      const colW = (W - 12) / cols;
      const rowH = 12;

      stations.forEach((st, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const sx = 6 + col * colW;
        const sy = pollY + 12 + row * rowH;

        if (sy > H * 0.4) return;

        // Status dot
        let dotColor;
        if (st.status === 'GO') dotColor = c.accent2;
        else if (st.status === 'STANDBY') dotColor = c.warn;
        else dotColor = c.error;

        ctx.beginPath();
        ctx.arc(sx + 4, sy + 4, 3, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        if (st.status === 'NO-GO' && Math.floor(frameCount / 8) % 2 === 0) {
          ctx.globalAlpha = 0.4;
        }
        ctx.fill();
        ctx.globalAlpha = 1;

        // Station name
        ctx.font = '7px monospace';
        ctx.fillStyle = dotColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(st.name, sx + 10, sy + 4);
      });

      // --- Telemetry (post-launch) ---
      const telY = H * 0.42;
      if (!counting || tMinus <= 0) {
        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = c.accent1;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('TELEMETRY', 6, telY);

        const telItems = [
          { label: 'ALT', val: `${telemetry.altitude_km.toFixed(1)} km` },
          { label: 'VEL', val: `${telemetry.velocity_ms.toFixed(0)} m/s` },
          { label: 'DOWNRANGE', val: `${telemetry.downrange_km.toFixed(1)} km` },
          { label: 'ACCEL', val: `${telemetry.acceleration_g.toFixed(2)} G` },
          { label: 'Q', val: `${telemetry.dynamic_pressure_kpa.toFixed(1)} kPa` },
          { label: 'PROP', val: `${telemetry.propellant_pct.toFixed(1)}%` },
          { label: 'STAGE', val: `${telemetry.stage}/${state.max_stages || 3}` },
        ];

        const tCols = Math.min(telItems.length, Math.floor(W / 70));
        const tColW = (W - 12) / tCols;

        telItems.forEach((ti, i) => {
          const col = i % tCols;
          const row = Math.floor(i / tCols);
          const tx = 6 + col * tColW;
          const ty = telY + 12 + row * 22;
          if (ty > H * 0.7) return;

          ctx.font = '7px monospace';
          ctx.fillStyle = c.textDim;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(ti.label, tx, ty);

          ctx.font = '9px monospace';
          ctx.fillStyle = c.accent1;
          ctx.fillText(ti.val, tx, ty + 9);
        });
      }

      // --- Events log at bottom ---
      const logY = H * 0.72;
      ctx.strokeStyle = c.border + '44';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(4, logY);
      ctx.lineTo(W - 4, logY);
      ctx.stroke();

      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('EVENTS', 6, logY + 2);

      const logStartY = logY + 14;
      const lineH = 10;
      const maxLines = Math.floor((H - logStartY - 4) / lineH);

      events.slice(-maxLines).forEach((entry, i) => {
        const ly = logStartY + i * lineH;
        ctx.font = '7px monospace';
        const isImportant = entry.includes('**') || entry.includes('LIFTOFF') || entry.includes('HOLD');
        ctx.fillStyle = isImportant ? c.warn : entry.includes('SEPARATION') ? c.accent2 : c.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const maxChars = Math.floor((W - 12) / 4.2);
        const display = entry.length > maxChars ? entry.slice(0, maxChars - 2) + '..' : entry;
        ctx.fillText(display, 6, ly);
      });

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
