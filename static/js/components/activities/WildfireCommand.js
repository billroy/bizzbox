/**
 * Wildfire Command — incident command post with zone status grid,
 * crew deployment, weather data, and containment progress.
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

function zoneColor(status, c) {
  switch (status) {
    case 'active':     return c.error;
    case 'contained':  return c.accent2;
    case 'threatened': return c.warn;
    case 'spotting':   return c.warn;
    case 'cleared':    return c.accent1;
    default:           return c.textDim;
  }
}

export default {
  name: 'ActivityWildfireCommand',
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

      const zones = state.zones || [];
      const crews = state.crews || [];
      const tankers = state.air_tankers || [];
      const evac = state.evac_zones || [];

      // --- Header: Fire name + containment ---
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = c.error;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(state.fire_name || 'FIRE', 6, 4);

      ctx.font = '9px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'right';
      ctx.fillText(`${(state.containment_pct || 0).toFixed(1)}% CONTAINED`, W - 6, 4);

      // Containment bar
      const cBarY = 16;
      const cBarW = W - 12;
      ctx.fillStyle = c.border + '33';
      ctx.fillRect(6, cBarY, cBarW, 5);
      ctx.fillStyle = c.accent2;
      ctx.fillRect(6, cBarY, cBarW * ((state.containment_pct || 0) / 100), 5);

      // Acres
      ctx.font = '7px monospace';
      ctx.fillStyle = c.warn;
      ctx.textAlign = 'left';
      ctx.fillText(`${(state.acres_burned || 0).toLocaleString()} ACRES`, 6, cBarY + 8);

      // --- Weather block ---
      const wxY = cBarY + 20;
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = c.accent1;
      ctx.fillText('WEATHER', 6, wxY);

      ctx.font = '7px monospace';
      ctx.fillStyle = c.textDim;
      const windDir = state.wind_dir_deg || 0;
      ctx.fillText(`WIND ${(state.wind_speed_mph || 0).toFixed(0)} MPH @ ${windDir}\u00B0`, 6, wxY + 12);
      ctx.fillText(`HUMIDITY ${(state.humidity_pct || 0).toFixed(0)}%  FUEL MOIST ${(state.fuel_moisture_pct || 0).toFixed(0)}%`, 6, wxY + 22);

      // Wind direction arrow
      const arrowCx = W - 30;
      const arrowCy = wxY + 14;
      const arrowR = 10;
      const wRad = windDir * Math.PI / 180;
      ctx.beginPath();
      ctx.arc(arrowCx, arrowCy, arrowR, 0, Math.PI * 2);
      ctx.strokeStyle = c.border + '66';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(arrowCx, arrowCy);
      ctx.lineTo(arrowCx + Math.sin(wRad) * arrowR, arrowCy - Math.cos(wRad) * arrowR);
      ctx.strokeStyle = c.error;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // --- Zones ---
      const zonesY = wxY + 36;
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'left';
      ctx.fillText('ZONES', 6, zonesY);

      zones.forEach((z, i) => {
        const y = zonesY + 12 + i * 14;
        if (y > H * 0.55) return;
        const zc = zoneColor(z.status, c);

        // Status dot (blink for active)
        if (z.status === 'active' && Math.floor(frameCount / 10) % 2 === 0) {
          ctx.globalAlpha = 0.4;
        }
        ctx.beginPath();
        ctx.arc(12, y + 4, 3, 0, Math.PI * 2);
        ctx.fillStyle = zc;
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.font = '7px monospace';
        ctx.fillStyle = zc;
        ctx.textAlign = 'left';
        ctx.fillText(z.id, 20, y);
        ctx.fillStyle = c.textDim;
        ctx.fillText(z.status.toUpperCase(), 42, y);
        ctx.fillText(`${z.spread_rate_ch_hr.toFixed(1)} ch/hr`, 100, y);
        ctx.fillText(`${z.flame_length_ft.toFixed(0)}ft`, 155, y);
      });

      // --- Crews (right column) ---
      const crewX = W * 0.52;
      const crewY = wxY + 36;
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'left';
      ctx.fillText('CREWS', crewX, crewY);

      crews.forEach((cr, i) => {
        const y = crewY + 12 + i * 12;
        if (y > H * 0.6) return;

        let crColor = c.accent2;
        if (cr.status === 'en_route') crColor = c.warn;
        if (cr.status === 'resting') crColor = c.textDim;

        ctx.font = '7px monospace';
        ctx.fillStyle = crColor;
        ctx.fillText(cr.id, crewX, y);
        ctx.fillStyle = c.textDim;
        ctx.fillText(cr.zone, crewX + 80, y);
        ctx.fillText(cr.status.toUpperCase(), crewX + 105, y);
      });

      // --- Air tankers ---
      const tankY = H * 0.62;
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'left';
      ctx.fillText('AIR TANKERS', 6, tankY);

      tankers.forEach((t, i) => {
        const y = tankY + 12 + i * 12;
        ctx.font = '7px monospace';
        ctx.fillStyle = t.status === 'dropping' ? c.warn : c.textDim;
        ctx.fillText(`${t.id}  ${t.status.toUpperCase()}  ETA:${t.eta_min}min  ${t.payload_gal}gal`, 6, y);
      });

      // --- Evacuation zones at bottom ---
      const evacY = H - 8 - evac.length * 11;
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = c.accent1;
      ctx.fillText('EVACUATION', 6, evacY - 12);

      evac.forEach((ez, i) => {
        const y = evacY + i * 11;
        let eColor = c.accent2;
        if (ez.status === 'warning') eColor = c.warn;
        if (ez.status === 'mandatory') eColor = c.error;
        if (ez.status === 'cleared') eColor = c.textDim;

        ctx.font = '7px monospace';
        ctx.fillStyle = eColor;
        ctx.textAlign = 'left';
        ctx.fillText(`${ez.name}  ${ez.status.toUpperCase()}  POP:${ez.population}`, 6, y);
      });

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
