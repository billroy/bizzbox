/**
 * Self-playing Pong — canvas-based arcade game renderer.
 * Ball positions are extrapolated client-side between server updates
 * for smooth 60 fps motion.
 */

function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    textDim: get('--color-text-dim'),
    border:  get('--color-border'),
    text:    get('--color-text'),
  };
}

export default {
  name: 'ActivityPong',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    // Smooth interpolation state for paddles
    let smoothLeftY = null;
    let smoothRightY = null;
    const LERP = 0.15;

    // Client-side ball extrapolation
    // Each entry: {x, y, vx, vy} where vx/vy are field-units per second
    let localBalls = [];
    let lastServerBalls = [];  // for change detection
    let lastServerTime = null; // performance.now() when last server frame arrived

    function draw(ts) {
      const canvas = canvasRef.value;
      if (!canvas) { rafId = requestAnimationFrame(draw); return; }

      const state = props.activity?.state;
      if (!state) { rafId = requestAnimationFrame(draw); return; }

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr;
        canvas.height = H * dpr;
      }

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const colors = getThemeColors();

      // Scale from field coords to canvas
      const fw = state.field_w || 1000;
      const fh = state.field_h || 600;
      const sx = W / fw;
      const sy = H / fh;

      const paddleW = (state.paddle_w || 12) * sx;
      const paddleH = (state.paddle_h || 80) * sy;
      const ballR_field = state.ball_r || 8;
      const ballR = ballR_field * Math.min(sx, sy);

      // Smooth paddle positions via LERP
      const targetLeftY = (state.paddle_left_y || fh / 2) * sy;
      const targetRightY = (state.paddle_right_y || fh / 2) * sy;
      if (smoothLeftY === null) { smoothLeftY = targetLeftY; smoothRightY = targetRightY; }
      smoothLeftY += (targetLeftY - smoothLeftY) * LERP;
      smoothRightY += (targetRightY - smoothRightY) * LERP;

      // ── Sync local balls with server state ──
      const serverBalls = state.balls || [];
      const changed = serverBalls.length !== lastServerBalls.length ||
        serverBalls.some((b, i) => {
          const p = lastServerBalls[i];
          return !p || b.x !== p.x || b.y !== p.y;
        });

      if (changed) {
        // New server frame — snap to server positions, store velocity
        localBalls = serverBalls.map(b => ({
          x: b.x, y: b.y,
          vx: b.vx || 0,   // already in field-units per second
          vy: b.vy || 0,
        }));
        lastServerBalls = serverBalls.map(b => ({ x: b.x, y: b.y }));
        lastServerTime = ts;
      }

      // ── Extrapolate ball positions ──
      const dt = lastServerTime != null ? (ts - lastServerTime) / 1000 : 0;

      // ── Background ──
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, W, H);

      // ── Center line (dashed) ──
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);

      // ── Paddles ──
      const padX_left = 20 * sx;
      const padX_right = W - 20 * sx - paddleW;

      ctx.fillStyle = colors.accent1;
      ctx.shadowBlur = 8;
      ctx.shadowColor = colors.accent1;
      ctx.fillRect(padX_left, smoothLeftY - paddleH / 2, paddleW, paddleH);

      ctx.fillStyle = colors.accent2 || colors.accent1;
      ctx.shadowColor = colors.accent2 || colors.accent1;
      ctx.fillRect(padX_right, smoothRightY - paddleH / 2, paddleW, paddleH);
      ctx.shadowBlur = 0;

      // ── Balls ──
      for (const lb of localBalls) {
        // Extrapolate from server position using velocity × elapsed time
        let ex = lb.x + lb.vx * dt;
        let ey = lb.y + lb.vy * dt;
        // Clamp to field bounds
        ex = Math.max(ballR_field, Math.min(fw - ballR_field, ex));
        ey = Math.max(ballR_field, Math.min(fh - ballR_field, ey));

        const bx = ex * sx;
        const by = ey * sy;
        ctx.beginPath();
        ctx.arc(bx, by, ballR, 0, Math.PI * 2);
        ctx.fillStyle = colors.text || '#ffffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = colors.text || '#ffffff';
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // ── Score ──
      const fontSize = Math.max(20, Math.min(48, W * 0.06));
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textBaseline = 'top';
      ctx.fillStyle = colors.textDim;

      ctx.textAlign = 'right';
      ctx.fillText(String(state.score_left || 0), W / 2 - 20, 12);

      ctx.textAlign = 'left';
      ctx.fillText(String(state.score_right || 0), W / 2 + 20, 12);

      // ── HUD ──
      ctx.font = '9px monospace';
      ctx.textBaseline = 'bottom';

      // Bottom-left: strategy
      const strategy = (state.strategy || '').toUpperCase().replace(/_/g, ' ');
      ctx.textAlign = 'left';
      ctx.fillStyle = colors.textDim;
      ctx.fillText(strategy, 6, H - 6);

      // Bottom-right: rally info
      ctx.textAlign = 'right';
      ctx.fillText(`RALLY ${state.rally || 0}  BEST ${state.max_rally || 0}`, W - 6, H - 6);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
