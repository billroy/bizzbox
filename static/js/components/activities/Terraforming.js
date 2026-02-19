/**
 * Terraforming Console — atmosphere composition bars, temperature zones, progress.
 * Canvas RAF with bar charts, zone status grid, and slow-moving progress indicators.
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
  name: 'ActivityTerraforming',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

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

      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const gases = state.gases || [];
      const zones = state.zones || [];
      const progress = state.progress_pct || 0;

      // --- Atmosphere composition (left column) ---
      const gasX = 8;
      const gasY = 20;
      const gasW = W * 0.45;
      const gasH = H * 0.45;

      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('ATMOSPHERE', gasX, 4);

      const barH = Math.min(14, gasH / (gases.length + 1));
      gases.forEach((gas, i) => {
        const y = gasY + i * (barH + 4);
        const maxVal = Math.max(gas.current_pct, gas.target_pct, 1);
        const scale = (gasW - 40) / Math.max(maxVal, 100);

        // Label
        ctx.font = '8px monospace';
        ctx.fillStyle = c.textMain;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(gas.name, gasX, y + barH / 2);

        // Bar background
        const barX = gasX + 32;
        const barWidth = gasW - 40;
        ctx.fillStyle = c.border + '22';
        ctx.fillRect(barX, y, barWidth, barH);

        // Current value bar
        const curW = Math.min(barWidth, (gas.current_pct / 100) * barWidth);
        ctx.fillStyle = c.accent1 + '88';
        ctx.fillRect(barX, y, curW, barH);

        // Target marker
        const targetX = barX + Math.min(barWidth, (gas.target_pct / 100) * barWidth);
        ctx.strokeStyle = c.accent2;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(targetX, y);
        ctx.lineTo(targetX, y + barH);
        ctx.stroke();

        // Value text
        ctx.font = '7px monospace';
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'right';
        ctx.fillText(`${gas.current_pct.toFixed(1)}%`, gasX + gasW, y + barH / 2);
      });

      // --- Temperature zones (right column) ---
      const zoneX = W * 0.52;
      const zoneY = 20;

      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('ZONES', zoneX, 4);

      zones.forEach((zone, i) => {
        const y = zoneY + i * 18;
        if (y > H * 0.5) return;

        let sColor;
        switch (zone.status) {
          case 'processing': sColor = c.accent1; break;
          case 'stable':     sColor = c.accent2; break;
          case 'warning':    sColor = c.warn; break;
          case 'offline':    sColor = c.error; break;
          default:           sColor = c.textDim;
        }

        // Status dot
        ctx.beginPath();
        ctx.arc(zoneX + 4, y + 6, 3, 0, Math.PI * 2);
        ctx.fillStyle = sColor;
        ctx.fill();

        ctx.font = '8px monospace';
        ctx.fillStyle = c.textMain;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(zone.name, zoneX + 12, y);

        ctx.fillStyle = c.textDim;
        ctx.fillText(`${zone.temp.toFixed(1)}\u00B0C`, zoneX + 52, y);

        ctx.font = '7px monospace';
        ctx.fillStyle = sColor;
        ctx.fillText(zone.status.toUpperCase(), zoneX + 100, y);
      });

      // --- Bottom metrics ---
      const metY = H * 0.58;
      const metrics = [
        { label: 'SURFACE TEMP', val: `${state.surface_temp.toFixed(1)}\u00B0C`, target: `\u2192 ${state.target_temp.toFixed(1)}\u00B0C` },
        { label: 'ICE CAP', val: `${state.ice_cap_pct.toFixed(1)}%` },
        { label: 'SEISMIC', val: state.seismic_level.toFixed(2), warn: state.seismic_level > 4.0 },
        { label: 'MIRROR ALIGN', val: `${state.mirror_alignment.toFixed(1)}%` },
      ];

      const metColW = W / metrics.length;
      metrics.forEach((m, i) => {
        const mx = metColW * i + metColW / 2;
        ctx.font = '7px monospace';
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(m.label, mx, metY);

        ctx.font = '10px monospace';
        ctx.fillStyle = m.warn ? c.error : c.accent1;
        ctx.fillText(m.val, mx, metY + 12);

        if (m.target) {
          ctx.font = '7px monospace';
          ctx.fillStyle = c.accent2;
          ctx.fillText(m.target, mx, metY + 24);
        }
      });

      // --- Overall progress bar at bottom ---
      const progY = H - 16;
      const progX = 8;
      const progW = W - 16;
      const progH = 6;

      ctx.fillStyle = c.border + '33';
      ctx.fillRect(progX, progY, progW, progH);
      ctx.fillStyle = c.accent1;
      ctx.fillRect(progX, progY, progW * (progress / 100), progH);

      ctx.font = '8px monospace';
      ctx.fillStyle = c.textMain;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`TERRAFORMING: ${progress.toFixed(2)}%`, W / 2, progY - 2);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
