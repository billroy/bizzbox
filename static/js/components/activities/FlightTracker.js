/**
 * ATC-style flight tracker — canvas with moving aircraft, trails, data tags,
 * range rings, and compass labels.
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
    warn:    get('--color-warn'),
    error:   get('--color-error'),
    border:  get('--color-border'),
  };
}

export default {
  name: 'ActivityFlightTracker',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;
    let frameCounter = 0;

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
      frameCounter++;

      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(cx, cy) - 16;

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      // Range rings (4 concentric)
      const rings = 4;
      ctx.setLineDash([4, 6]);
      for (let i = 1; i <= rings; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (R * i) / rings, 0, Math.PI * 2);
        ctx.strokeStyle = c.border + '44';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Cross hairs
      ctx.strokeStyle = c.border + '33';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
      ctx.setLineDash([]);

      // Compass labels
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', cx, cy - R - 8);
      ctx.fillText('S', cx, cy + R + 8);
      ctx.fillText('E', cx + R + 10, cy);
      ctx.fillText('W', cx - R - 10, cy);

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fillStyle = c.textDim;
      ctx.fill();

      // Aircraft
      const aircraft = state.aircraft || [];
      for (const ac of aircraft) {
        const ax = ac.x * W;
        const ay = ac.y * H;

        // Pick color by type
        let color;
        if (ac.type === 'commercial')     color = c.accent1;
        else if (ac.type === 'military')  color = c.accent2;
        else if (ac.type === 'private')   color = c.accent3;
        else if (ac.type === 'cargo')     color = c.warn;
        else                              color = c.accent1;

        // Emergency override
        const isEmergency = ac.status === 'emergency';
        if (isEmergency) {
          color = c.error;
          // Pulse: skip drawing every other ~15 frame stretch for flash
          if (Math.floor(frameCounter / 8) % 2 === 0) {
            color = c.error;
          } else {
            color = c.error + '66';
          }
        }

        // Trail
        const trail = ac.trail || [];
        if (trail.length >= 2) {
          for (let i = 1; i < trail.length; i++) {
            const age = 1 - (trail.length - i) / trail.length;
            const alpha = Math.floor(age * 120).toString(16).padStart(2, '0');
            ctx.beginPath();
            ctx.moveTo(trail[i - 1][0] * W, trail[i - 1][1] * H);
            ctx.lineTo(trail[i][0] * W, trail[i][1] * H);
            ctx.strokeStyle = color + alpha;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          // Line from last trail point to current position
          const last = trail[trail.length - 1];
          ctx.beginPath();
          ctx.moveTo(last[0] * W, last[1] * H);
          ctx.lineTo(ax, ay);
          ctx.strokeStyle = color + '88';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Aircraft chevron (triangle oriented to heading)
        const headingRad = (ac.heading || 0) * Math.PI / 180;
        const sz = 5;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(headingRad);
        ctx.beginPath();
        ctx.moveTo(0, -sz);       // nose
        ctx.lineTo(-sz * 0.6, sz * 0.6);
        ctx.lineTo(sz * 0.6, sz * 0.6);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();

        // Data tag: callsign + altitude
        const flStr = ac.altitude >= 18000
          ? 'FL' + Math.round(ac.altitude / 100)
          : ac.altitude + 'ft';
        const tag = ac.callsign + ' ' + flStr;
        ctx.font = '8px monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(tag, ax + 7, ay - 3);

        // Emergency indicator
        if (isEmergency && frameCounter % 30 < 15) {
          ctx.font = '7px monospace';
          ctx.fillStyle = c.error;
          ctx.fillText('EMRG', ax + 7, ay + 8);
        }
      }

      // Range indicator top-left
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('RANGE: ' + (state.range_nm || 120) + 'NM', 6, 6);

      // Center label bottom-left
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(state.center_label || '', 6, H - 6);

      // Strategy label bottom-right
      ctx.font = '8px monospace';
      ctx.fillStyle = c.border;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText((state.strategy || '').toUpperCase().replace(/_/g, ' '), W - 6, H - 6);

      // Aircraft count top-right
      ctx.font = '8px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(aircraft.length + ' TGT', W - 6, 6);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
