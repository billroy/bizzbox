/**
 * Submarine Helm — depth gauge, circular sonar display, ballast indicators,
 * heading compass, and contact tracking. Canvas RAF loop.
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
  name: 'ActivitySubmarineHelm',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    function draw(ts) {
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

      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const contacts = state.contacts || [];

      // --- Sonar circle (left half) ---
      const sonarCx = W * 0.3;
      const sonarCy = H * 0.42;
      const sonarR = Math.min(W * 0.25, H * 0.35);

      // Range rings
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(sonarCx, sonarCy, sonarR * (i / 3), 0, Math.PI * 2);
        ctx.strokeStyle = c.border + '44';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Cross hairs
      ctx.strokeStyle = c.border + '33';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(sonarCx - sonarR, sonarCy);
      ctx.lineTo(sonarCx + sonarR, sonarCy);
      ctx.moveTo(sonarCx, sonarCy - sonarR);
      ctx.lineTo(sonarCx, sonarCy + sonarR);
      ctx.stroke();

      // Bearing labels
      ctx.font = '7px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('000', sonarCx, sonarCy - sonarR - 2);
      ctx.textBaseline = 'top';
      ctx.fillText('180', sonarCx, sonarCy + sonarR + 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('270', sonarCx - sonarR - 3, sonarCy);
      ctx.textAlign = 'left';
      ctx.fillText('090', sonarCx + sonarR + 3, sonarCy);

      // Sweep line
      const sweepRad = (state.sweep_angle || 0) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(sonarCx, sonarCy);
      ctx.lineTo(
        sonarCx + Math.sin(sweepRad) * sonarR,
        sonarCy - Math.cos(sweepRad) * sonarR
      );
      ctx.strokeStyle = c.accent1;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.8;
      ctx.stroke();

      // Sweep fade trail
      ctx.beginPath();
      ctx.moveTo(sonarCx, sonarCy);
      ctx.arc(sonarCx, sonarCy, sonarR, -Math.PI / 2 + sweepRad - 0.5, -Math.PI / 2 + sweepRad);
      ctx.closePath();
      ctx.fillStyle = c.accent1 + '11';
      ctx.fill();
      ctx.globalAlpha = 1;

      // Contacts on sonar
      for (const ct of contacts) {
        const bearing = ct.bearing * Math.PI / 180;
        const rangeFrac = Math.min(1.0, ct.range_m / 15000);
        const cx2 = sonarCx + Math.sin(bearing) * sonarR * rangeFrac;
        const cy2 = sonarCy - Math.cos(bearing) * sonarR * rangeFrac;

        let dotColor = c.accent2;
        if (ct.type === 'torpedo' || ct.type === 'mine') dotColor = c.error;
        if (ct.type === 'whale' || ct.type === 'creature') dotColor = c.accent3 || c.accent2;
        if (ct.type === 'unknown') dotColor = c.textDim;

        const dotR = 2 + ct.confidence * 0.02;
        ctx.beginPath();
        ctx.arc(cx2, cy2, dotR, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();

        // Contact label
        ctx.font = '6px monospace';
        ctx.fillStyle = dotColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(ct.id, cx2 + 4, cy2 - 2);
      }

      // --- Right panel: Depth gauge, heading, systems ---
      const rpX = W * 0.6;

      // Depth
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('DEPTH', rpX, 4);

      const depthFrac = state.depth_m / state.max_depth_m;
      const depthBarX = rpX;
      const depthBarW = W - rpX - 8;
      const depthBarH = 10;
      const depthBarY = 16;

      ctx.fillStyle = c.border + '33';
      ctx.fillRect(depthBarX, depthBarY, depthBarW, depthBarH);
      ctx.fillStyle = depthFrac > 0.85 ? c.error : depthFrac > 0.7 ? c.warn : c.accent1;
      ctx.fillRect(depthBarX, depthBarY, depthBarW * depthFrac, depthBarH);

      ctx.font = '8px monospace';
      ctx.fillStyle = c.textMain;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${state.depth_m.toFixed(0)}m`, rpX + depthBarW / 2, depthBarY + depthBarH / 2);

      // Speed / Heading / Trim
      const statsY = depthBarY + depthBarH + 8;
      const stats = [
        { label: 'SPD', val: `${state.speed_knots.toFixed(1)} kt` },
        { label: 'HDG', val: `${state.heading_deg}\u00B0` },
        { label: 'TRIM', val: `${state.trim_deg > 0 ? '+' : ''}${state.trim_deg.toFixed(1)}\u00B0` },
      ];

      stats.forEach((s, i) => {
        const sx = rpX + i * 50;
        ctx.font = '7px monospace';
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(s.label, sx, statsY);
        ctx.fillStyle = c.textMain;
        ctx.fillText(s.val, sx, statsY + 10);
      });

      // Ballast
      const ballY = statsY + 28;
      ctx.font = '7px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('BALLAST FWD', rpX, ballY);
      ctx.fillText('BALLAST AFT', rpX, ballY + 16);

      const miniBarW = W - rpX - 40;
      [state.ballast_fwd_pct, state.ballast_aft_pct].forEach((val, i) => {
        const by = ballY + i * 16 + 1;
        ctx.fillStyle = c.border + '33';
        ctx.fillRect(rpX + 70, by, miniBarW, 5);
        ctx.fillStyle = c.accent1;
        ctx.fillRect(rpX + 70, by, miniBarW * (val / 100), 5);
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'right';
        ctx.fillText(`${val.toFixed(0)}%`, W - 8, by);
      });

      // Hull pressure / Reactor / O2
      const sysY = ballY + 40;
      const sysItems = [
        { label: 'HULL', val: state.hull_pressure_pct, warn: 80, crit: 90 },
        { label: 'REACTOR', val: state.reactor_output_pct },
        { label: 'O2', val: state.o2_pct, unit: '%', warn: 18, crit: 17, isO2: true },
      ];

      sysItems.forEach((si, i) => {
        const sy = sysY + i * 14;
        if (sy > H - 30) return;
        ctx.font = '7px monospace';
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(si.label, rpX, sy);

        let valColor = c.accent2;
        if (si.isO2) {
          if (si.val < si.crit) valColor = c.error;
          else if (si.val < si.warn) valColor = c.warn;
        } else if (si.warn) {
          if (si.val > si.crit) valColor = c.error;
          else if (si.val > si.warn) valColor = c.warn;
        }
        ctx.fillStyle = valColor;
        ctx.fillText(`${si.val.toFixed(1)}%`, rpX + 55, sy);
      });

      // --- Contact list at bottom ---
      const clY = H - 24;
      ctx.font = '7px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      const ctStr = contacts.map(ct =>
        `${ct.id}:${ct.bearing}\u00B0/${(ct.range_m / 1000).toFixed(1)}km`
      ).join('  ');
      ctx.fillText(ctStr, 4, clY);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
