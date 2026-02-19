/**
 * Animated cipher/decrypt text effect — canvas renderer.
 * Server sends lines with partially resolved text and progress;
 * client renders with typing/decode visual effect.
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
    textPri: get('--color-text-primary'),
    info:    get('--color-info'),
  };
}

export default {
  name: 'ActivityCipherDecrypt',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;
    let frameCount = 0;

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) return;
      const state = props.activity?.state;
      const lines = state?.lines;
      if (!lines || lines.length === 0) { rafId = requestAnimationFrame(draw); return; }

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
      const strategy = state.strategy || '';

      frameCount++;

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      // Layout
      const padX = 8;
      const padY = 8;
      const lineSpacing = Math.max(28, (H - padY * 2 - 16) / lines.length);
      const fontSize = Math.max(9, Math.min(13, lineSpacing * 0.42));

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const y = padY + i * lineSpacing;
        const progress = line.progress; // 0 to 1
        const text = line.text;
        const status = line.status;

        // Progress bar
        const barY = y;
        const barH = 3;
        const barW = W - padX * 2;
        ctx.fillStyle = c.accent1 + '22';
        ctx.fillRect(padX, barY, barW, barH);
        ctx.fillStyle = status === 'complete' ? c.info : c.accent1;
        ctx.fillRect(padX, barY, barW * progress, barH);

        // Status indicator
        ctx.font = `bold ${Math.max(7, fontSize - 2)}px monospace`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        if (status === 'complete') {
          ctx.fillStyle = c.info;
          ctx.fillText('DECRYPTED', W - padX, barY + barH + 2);
        } else {
          ctx.fillStyle = c.accent1;
          ctx.fillText(`${Math.round(progress * 100)}%`, W - padX, barY + barH + 2);
        }

        // Text — draw character by character for garble effect
        ctx.font = `${fontSize}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const charW = ctx.measureText('M').width;
        const textY = barY + barH + 4;

        for (let ci = 0; ci < text.length; ci++) {
          const ch = text[ci];
          const cx = padX + ci * charW;
          if (cx + charW > W - padX - 60) break;

          if (status === 'complete') {
            // Fully resolved — bright
            ctx.fillStyle = c.accent2;
          } else {
            // Is this char resolved or still garbled?
            const charProgress = ci / Math.max(1, text.length);
            if (charProgress < progress) {
              // Resolved character
              ctx.fillStyle = c.accent2;
            } else {
              // Still garbled — gentle slow pulse (< 2Hz) per character
              const phase = (frameCount * 0.03 + ci * 0.4) % (Math.PI * 2);
              const alpha = 0.5 + 0.3 * Math.sin(phase);
              ctx.fillStyle = `rgba(${hexToRgb(c.accent1)}, ${alpha})`;
            }
          }
          ctx.fillText(ch, cx, textY);
        }
      }

      // Strategy label
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(strategy.toUpperCase().replace(/_/g, ' '), padX, H - 4);

      rafId = requestAnimationFrame(draw);
    }

    function hexToRgb(hex) {
      let h = hex.replace('#', '');
      if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      const r = parseInt(h.substring(0, 2), 16) || 0;
      const g = parseInt(h.substring(2, 4), 16) || 0;
      const b = parseInt(h.substring(4, 6), 16) || 0;
      return `${r}, ${g}, ${b}`;
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
