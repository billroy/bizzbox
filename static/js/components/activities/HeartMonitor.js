/**
 * Hospital-style heart monitor with EKG trace and vital sign readouts.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    textDim: get('--color-text-dim'),
    textMain:get('--color-text-primary'),
    textBright: get('--color-text-bright'),
    border:  get('--color-border'),
    error:   get('--color-error'),
    warn:    get('--color-warn'),
  };
}

export default {
  name: 'ActivityHeartMonitor',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;
    let beatPhase = 0;

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

      // Background — black for hospital monitor look
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);

      const samples = state.ekg_samples || [];
      const alarm = state.alarm;
      const ekgColor = alarm ? '#ff3333' : '#00ff44';

      // Layout zones
      const headerH = Math.max(18, H * 0.08);
      const ekgTop = headerH;
      const ekgH = H * 0.48;
      const vitalsTop = ekgTop + ekgH + 4;
      const vitalsH = H - vitalsTop;

      // ── Header: EKG label ──
      ctx.font = `bold ${Math.max(10, headerH * 0.7)|0}px monospace`;
      ctx.fillStyle = alarm ? '#ff3333' : '#00ff44';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.ekg_label || '', 6, headerH / 2);

      // Beep indicator (pulsing dot)
      beatPhase += 0.15;
      const pulse = Math.max(0, Math.sin(beatPhase * (state.hr || 72) / 40));
      const dotR = 3 + pulse * 4;
      ctx.beginPath();
      ctx.arc(W - 14, headerH / 2, dotR, 0, Math.PI * 2);
      ctx.fillStyle = alarm ? `rgba(255,50,50,${0.3 + pulse * 0.7})` : `rgba(0,255,68,${0.3 + pulse * 0.7})`;
      ctx.fill();

      // ── EKG waveform ──
      if (samples.length > 1) {
        const step = W / (samples.length - 1);
        const midY = ekgTop + ekgH / 2;
        const ampScale = ekgH * 0.38;

        // Grid lines
        ctx.strokeStyle = '#1a2a1a';
        ctx.lineWidth = 0.5;
        const gridSpacing = ekgH / 4;
        for (let gy = ekgTop; gy <= ekgTop + ekgH; gy += gridSpacing) {
          ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
        }
        const vGrid = W / 8;
        for (let gx = 0; gx < W; gx += vGrid) {
          ctx.beginPath(); ctx.moveTo(gx, ekgTop); ctx.lineTo(gx, ekgTop + ekgH); ctx.stroke();
        }

        // Glow
        ctx.beginPath();
        ctx.moveTo(0, midY - samples[0] * ampScale);
        for (let i = 1; i < samples.length; i++) {
          ctx.lineTo(i * step, midY - samples[i] * ampScale);
        }
        ctx.shadowBlur = 10;
        ctx.shadowColor = ekgColor;
        ctx.strokeStyle = ekgColor + '66';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Main trace
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(0, midY - samples[0] * ampScale);
        for (let i = 1; i < samples.length; i++) {
          ctx.lineTo(i * step, midY - samples[i] * ampScale);
        }
        ctx.strokeStyle = ekgColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // ── Separator line ──
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, vitalsTop - 2); ctx.lineTo(W, vitalsTop - 2); ctx.stroke();

      // ── Vital signs readouts ──
      const vitals = [
        { label: 'HR',   value: `${state.hr || '--'}`,                  unit: 'bpm',  color: ekgColor },
        { label: 'BP',   value: `${state.bp_sys || '--'}/${state.bp_dia || '--'}`, unit: 'mmHg', color: '#ffaa00' },
        { label: 'SpO2', value: `${state.spo2 || '--'}`,                unit: '%',    color: '#00ccff' },
        { label: 'RESP', value: `${state.resp || '--'}`,                unit: '/min', color: '#ffff55' },
      ];

      const colW = W / vitals.length;
      const labelSize = Math.max(8, vitalsH * 0.18) | 0;
      const valueSize = Math.max(14, vitalsH * 0.45) | 0;
      const unitSize = Math.max(7, vitalsH * 0.14) | 0;

      for (let i = 0; i < vitals.length; i++) {
        const vx = i * colW + colW / 2;
        const vy = vitalsTop + vitalsH * 0.15;

        // Label
        ctx.font = `${labelSize}px monospace`;
        ctx.fillStyle = '#888888';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(vitals[i].label, vx, vy);

        // Value
        ctx.font = `bold ${valueSize}px monospace`;
        ctx.fillStyle = vitals[i].color;
        ctx.fillText(vitals[i].value, vx, vy + labelSize + 2);

        // Unit
        ctx.font = `${unitSize}px monospace`;
        ctx.fillStyle = '#666666';
        ctx.fillText(vitals[i].unit, vx, vy + labelSize + valueSize + 4);
      }

      // Alarm flash border
      if (alarm && pulse > 0.5) {
        ctx.strokeStyle = `rgba(255,50,50,${pulse * 0.4})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, W - 2, H - 2);
      }

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
