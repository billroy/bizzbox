/**
 * Hyperloop Dispatch — horizontal tube route with pod positions, segment pressure,
 * and junction switches. Canvas RAF loop.
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
  name: 'ActivityHyperloop',
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

      const pods = state.pods || [];
      const segments = state.segments || [];
      const junctions = state.junctions || [];
      const stations = state.stations || [];
      const numSeg = segments.length;

      // --- Tube route (horizontal, middle of canvas) ---
      const tubeY = H * 0.32;
      const tubeX = 20;
      const tubeW = W - 40;
      const tubeH = 12;

      // Draw segments
      const segW = tubeW / numSeg;
      segments.forEach((seg, i) => {
        const sx = tubeX + i * segW;

        // Segment fill based on pressure
        let segColor = c.accent1 + '22';
        if (seg.status === 'warning') segColor = c.warn + '33';
        if (seg.status === 'pressure_fault') segColor = c.error + '33';
        ctx.fillStyle = segColor;
        ctx.fillRect(sx, tubeY, segW - 1, tubeH);

        // Segment border
        ctx.strokeStyle = seg.status === 'nominal' ? c.border + '66' : (seg.status === 'warning' ? c.warn : c.error);
        ctx.lineWidth = 0.5;
        ctx.strokeRect(sx, tubeY, segW - 1, tubeH);

        // Pressure label
        ctx.font = '6px monospace';
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${seg.pressure_pa.toFixed(0)}Pa`, sx + segW / 2, tubeY - 2);
      });

      // Station labels
      ctx.font = '7px monospace';
      ctx.fillStyle = c.accent2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const stationGap = tubeW / Math.max(stations.length - 1, 1);
      stations.forEach((st, i) => {
        const sx = tubeX + i * stationGap;
        // Station tick mark
        ctx.fillStyle = c.accent2;
        ctx.fillRect(sx - 1, tubeY - 6, 2, tubeH + 12);
        ctx.fillText(st, sx, tubeY + tubeH + 8);
      });

      // Draw pods on tube
      pods.forEach((pod) => {
        const podGlobalPos = (pod.segment + pod.position) / numSeg;
        const px = tubeX + podGlobalPos * tubeW;
        const py = tubeY + tubeH / 2;

        let podColor = c.accent1;
        if (pod.status === 'emergency_brake') podColor = c.error;
        if (pod.status === 'stopped') podColor = c.warn;
        if (pod.status === 'arrived') podColor = c.accent2;

        // Pod marker
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = podColor;
        ctx.fill();

        // Speed trail
        if (pod.speed_kph > 100) {
          const trailLen = Math.min(20, pod.speed_kph * 0.01);
          ctx.beginPath();
          ctx.moveTo(px - trailLen, py);
          ctx.lineTo(px - 4, py);
          ctx.strokeStyle = podColor + '44';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      });

      // --- Pod details (below tube) ---
      const detailY = tubeY + tubeH + 28;
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('PODS', 6, detailY);

      pods.forEach((pod, i) => {
        const y = detailY + 12 + i * 16;
        if (y > H * 0.72) return;

        let sColor = c.accent2;
        if (pod.status === 'emergency_brake') sColor = c.error;
        if (pod.status === 'stopped') sColor = c.warn;
        if (pod.status === 'arrived') sColor = c.accent1;

        ctx.font = '7px monospace';
        ctx.fillStyle = sColor;
        ctx.textAlign = 'left';
        ctx.fillText(pod.id, 6, y);

        ctx.fillStyle = c.textDim;
        ctx.fillText(`${pod.speed_kph.toFixed(0)} kph`, 65, y);
        ctx.fillText(pod.status.toUpperCase(), 120, y);

        ctx.fillStyle = c.textMain;
        ctx.fillText(`${pod.origin} \u2192 ${pod.destination}`, 6, y + 8);
        ctx.fillStyle = c.textDim;
        ctx.fillText(`${pod.passengers} PAX`, 140, y + 8);

        // Brake status
        if (pod.brake_status !== 'released') {
          ctx.fillStyle = c.error;
          ctx.fillText(`BRK:${pod.brake_status.toUpperCase()}`, W - 80, y);
        }
      });

      // --- Junctions at bottom ---
      const jctY = H - 20;
      ctx.font = '7px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      junctions.forEach((jct, i) => {
        const jx = 6 + i * 80;
        ctx.fillStyle = jct.status === 'switching' ? c.warn : c.textDim;
        ctx.fillText(`${jct.id}:${jct.switch_state}`, jx, jctY);
        if (jct.status === 'switching' && Math.floor(frameCount / 8) % 2 === 0) {
          ctx.fillStyle = c.warn;
          ctx.fillText('\u25CF', jx - 8, jctY);
        }
      });

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
