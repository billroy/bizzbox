/**
 * Space Elevator — vertical tether track with climber positions, cable tension,
 * and anchor status. Canvas RAF loop.
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
  name: 'ActivitySpaceElevator',
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

      const climbers = state.climbers || [];
      const anchors = state.anchors || [];
      const maxAlt = state.max_alt_km || 35786;

      // Tether track layout
      const trackX = W * 0.22;
      const trackTop = 20;
      const trackBot = H - 28;
      const trackH = trackBot - trackTop;

      // Draw altitude scale
      ctx.font = '7px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const marks = 6;
      for (let i = 0; i <= marks; i++) {
        const frac = i / marks;
        const y = trackBot - frac * trackH;
        const alt = (frac * maxAlt).toFixed(0);
        ctx.fillText(`${alt} km`, trackX - 8, y);

        ctx.strokeStyle = c.border + '33';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(trackX - 3, y);
        ctx.lineTo(trackX + 3, y);
        ctx.stroke();
      }

      // Tether cable
      ctx.strokeStyle = c.border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(trackX, trackTop);
      ctx.lineTo(trackX, trackBot);
      ctx.stroke();

      // Animated dashes on cable
      ctx.setLineDash([3, 5]);
      ctx.lineDashOffset = -(ts * 0.02);
      ctx.strokeStyle = c.accent1 + '44';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(trackX, trackTop);
      ctx.lineTo(trackX, trackBot);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      // Ground marker
      ctx.fillStyle = c.accent2;
      ctx.fillRect(trackX - 10, trackBot, 20, 3);
      ctx.font = '7px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('GROUND', trackX, trackBot + 5);

      // GEO marker
      ctx.fillStyle = c.accent1;
      ctx.fillRect(trackX - 10, trackTop - 1, 20, 2);
      ctx.textBaseline = 'bottom';
      ctx.fillText('GEO', trackX, trackTop - 3);

      // Counterweight
      const cwY = trackBot - (state.counterweight_pos || 0.9) * trackH;
      ctx.fillStyle = c.accent3 || c.accent2;
      ctx.fillRect(trackX - 6, cwY - 3, 12, 6);
      ctx.font = '6px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('CW', trackX + 10, cwY);

      // Draw climbers
      climbers.forEach((clm) => {
        const y = trackBot - clm.altitude_frac * trackH;
        const clmW = 14;
        const clmH = 8;

        // Climber box
        let clmColor = c.accent1;
        if (clm.status === 'caution') clmColor = c.warn;
        if (clm.status === 'brake_test') clmColor = c.error;

        ctx.fillStyle = clmColor + '44';
        ctx.fillRect(trackX - clmW / 2, y - clmH / 2, clmW, clmH);
        ctx.strokeStyle = clmColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(trackX - clmW / 2, y - clmH / 2, clmW, clmH);

        // Direction arrow
        ctx.fillStyle = clmColor;
        if (clm.direction === 'ascending') {
          ctx.beginPath();
          ctx.moveTo(trackX, y - clmH / 2 - 4);
          ctx.lineTo(trackX - 3, y - clmH / 2);
          ctx.lineTo(trackX + 3, y - clmH / 2);
          ctx.fill();
        } else if (clm.direction === 'descending') {
          ctx.beginPath();
          ctx.moveTo(trackX, y + clmH / 2 + 4);
          ctx.lineTo(trackX - 3, y + clmH / 2);
          ctx.lineTo(trackX + 3, y + clmH / 2);
          ctx.fill();
        }

        // Climber info panel (right side)
        const infoX = trackX + 20;
        ctx.font = '7px monospace';
        ctx.fillStyle = clmColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(clm.name, infoX, y - 6);

        ctx.fillStyle = c.textDim;
        ctx.font = '6px monospace';
        const altKm = (clm.altitude_frac * maxAlt).toFixed(0);
        ctx.fillText(`${altKm}km  ${clm.velocity_kph.toFixed(0)}kph`, infoX, y + 3);
        ctx.fillText(clm.cargo, infoX, y + 11);
      });

      // --- Right panel: Anchors, cable tension, weather ---
      const panelX = W * 0.62;

      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('ANCHORS', panelX, 4);

      anchors.forEach((a, i) => {
        const y = 18 + i * 16;
        let aColor = c.accent2;
        if (a.status === 'warning') aColor = c.warn;
        if (a.status === 'stressed') aColor = c.error;

        ctx.font = '7px monospace';
        ctx.fillStyle = aColor;
        ctx.textAlign = 'left';
        ctx.fillText(`${a.id}  ${a.tension_pct.toFixed(0)}%`, panelX, y);

        // Mini bar
        const barX = panelX + 70;
        const barW = W - panelX - 78;
        ctx.fillStyle = c.border + '33';
        ctx.fillRect(barX, y + 2, barW, 4);
        ctx.fillStyle = aColor;
        ctx.fillRect(barX, y + 2, barW * (a.tension_pct / 100), 4);
      });

      // Cable tension
      const ctY = 18 + anchors.length * 16 + 8;
      ctx.font = '8px monospace';
      ctx.fillStyle = c.textDim;
      ctx.fillText('CABLE TENSION', panelX, ctY);
      const tension = state.cable_tension || 0;
      ctx.fillStyle = tension < 60 ? c.error : tension < 80 ? c.warn : c.accent2;
      ctx.fillText(`${tension.toFixed(1)}%`, panelX + 100, ctY);

      // Weather
      const wxY = ctY + 16;
      ctx.fillStyle = c.textDim;
      ctx.fillText('WEATHER', panelX, wxY);
      const wx = state.weather_status || 'clear';
      ctx.fillStyle = wx === 'severe' ? c.error : wx === 'advisory' ? c.warn : c.accent2;
      ctx.fillText(wx.toUpperCase(), panelX + 65, wxY);

      ctx.fillStyle = c.textDim;
      ctx.fillText(`WIND ${(state.wind_speed_kph || 0).toFixed(0)} KPH`, panelX, wxY + 12);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
