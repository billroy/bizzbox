/**
 * Fake facial recognition / object detection overlay renderer.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    accent3: get('--color-accent-3'),
    warn:    get('--color-warn'),
    error:   get('--color-error'),
    textDim: get('--color-text-dim'),
    textMain:get('--color-text-primary'),
    border:  get('--color-border'),
  };
}

export default {
  name: 'ActivityFacialRecognition',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

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

      // Background with simulated "camera" noise
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      // Static noise texture
      const imageData = ctx.getImageData(0, 0, W, H);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4 * 8) {
        const v = Math.random() * 15;
        data[i] = data[i] + v;
        data[i+1] = data[i+1] + v;
        data[i+2] = data[i+2] + v;
      }
      ctx.putImageData(imageData, 0, 0);

      // Corner bracket helpers
      const bracket = (x, y, bw, bh, col) => {
        const bs = 14;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        // TL
        ctx.beginPath(); ctx.moveTo(x, y + bs); ctx.lineTo(x, y); ctx.lineTo(x + bs, y); ctx.stroke();
        // TR
        ctx.beginPath(); ctx.moveTo(x + bw - bs, y); ctx.lineTo(x + bw, y); ctx.lineTo(x + bw, y + bs); ctx.stroke();
        // BL
        ctx.beginPath(); ctx.moveTo(x, y + bh - bs); ctx.lineTo(x, y + bh); ctx.lineTo(x + bs, y + bh); ctx.stroke();
        // BR
        ctx.beginPath(); ctx.moveTo(x + bw - bs, y + bh); ctx.lineTo(x + bw, y + bh); ctx.lineTo(x + bw, y + bh - bs); ctx.stroke();
      };

      // Detection boxes
      for (const face of (state.faces || [])) {
        const bx = face.x * W;
        const by = face.y * H;
        const bw = face.w * W;
        const bh = face.h * H;

        const conf = face.confidence;
        const col = conf > 0.8 ? c.accent2 : conf > 0.6 ? c.accent1 : c.warn;

        // Box fill
        ctx.fillStyle = col + '11';
        ctx.fillRect(bx, by, bw, bh);

        // Corner brackets
        bracket(bx, by, bw, bh, col);

        // Label
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = col;
        ctx.textAlign = 'left';
        ctx.fillText(face.label, bx + 2, by - 4);

        const confStr = (conf * 100).toFixed(0) + '%';
        ctx.font = '9px monospace';
        ctx.fillStyle = c.textDim;
        ctx.fillText(confStr, bx + 2, by + bh + 10);

        // Landmarks (biometric mode)
        for (const lm of (face.landmarks || [])) {
          ctx.beginPath();
          ctx.arc(lm.x * W, lm.y * H, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = c.accent3;
          ctx.fill();
        }
      }

      // Scan line
      if (state.scan_line !== undefined) {
        const sy = state.scan_line * H;
        ctx.beginPath();
        ctx.moveTo(0, sy); ctx.lineTo(W, sy);
        ctx.strokeStyle = c.accent1 + '55';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Scene label
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.fillText(state.scene_label || '', 6, H - 6);

      // Status overlay
      const now = (Date.now() / 500 | 0) % 2 === 0;
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'right';
      ctx.fillText(now ? '● REC' : '○ REC', W - 6, 14);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
