/**
 * Self-playing Tic-tac-toe — canvas-based game renderer.
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
    text:    get('--color-text-primary'),
  };
}

export default {
  name: 'ActivityTicTacToe',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    // Animation state for marks appearing
    let prevBoard = Array(9).fill(null);
    let markAnimations = {};  // cell index -> { startTime, player }

    function draw() {
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
      const now = performance.now();

      // Detect new marks
      const board = state.board || Array(9).fill(null);
      for (let i = 0; i < 9; i++) {
        if (board[i] && !prevBoard[i]) {
          markAnimations[i] = { startTime: now, player: board[i] };
        }
      }
      // Clear animations on new game
      if (board.every(c => c === null) && prevBoard.some(c => c !== null)) {
        markAnimations = {};
      }
      prevBoard = [...board];

      // ── Background ──
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, W, H);

      // ── Grid sizing ──
      const gridSize = Math.min(W, H) * 0.7;
      const cellSize = gridSize / 3;
      const offsetX = (W - gridSize) / 2;
      const offsetY = (H - gridSize) / 2 + 10;

      // ── Draw grid lines ──
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      for (let i = 1; i < 3; i++) {
        // Vertical
        ctx.beginPath();
        ctx.moveTo(offsetX + i * cellSize, offsetY);
        ctx.lineTo(offsetX + i * cellSize, offsetY + gridSize);
        ctx.stroke();
        // Horizontal
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + i * cellSize);
        ctx.lineTo(offsetX + gridSize, offsetY + i * cellSize);
        ctx.stroke();
      }

      // ── Draw marks ──
      const markPad = cellSize * 0.2;
      for (let i = 0; i < 9; i++) {
        if (!board[i]) continue;
        const row = Math.floor(i / 3);
        const col = i % 3;
        const cx = offsetX + col * cellSize + cellSize / 2;
        const cy = offsetY + row * cellSize + cellSize / 2;
        const half = cellSize / 2 - markPad;

        // Animate scale
        const anim = markAnimations[i];
        let scale = 1;
        if (anim) {
          const elapsed = (now - anim.startTime) / 200;  // 200ms animation
          scale = Math.min(1, elapsed);
          scale = 1 - Math.pow(1 - scale, 3);  // ease out cubic
        }

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);

        if (board[i] === 'X') {
          // Draw X
          ctx.strokeStyle = colors.accent1;
          ctx.lineWidth = Math.max(3, cellSize * 0.08);
          ctx.shadowBlur = 6;
          ctx.shadowColor = colors.accent1;
          ctx.beginPath();
          ctx.moveTo(-half, -half);
          ctx.lineTo(half, half);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(half, -half);
          ctx.lineTo(-half, half);
          ctx.stroke();
        } else {
          // Draw O
          ctx.strokeStyle = colors.accent2 || colors.accent1;
          ctx.lineWidth = Math.max(3, cellSize * 0.08);
          ctx.shadowBlur = 6;
          ctx.shadowColor = colors.accent2 || colors.accent1;
          ctx.beginPath();
          ctx.arc(0, 0, half * 0.85, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // ── Win line ──
      if (state.win_line && state.winner && state.winner !== 'draw') {
        const [a, , c] = state.win_line;
        const ar = Math.floor(a / 3);
        const ac = a % 3;
        const cr = Math.floor(c / 3);
        const cc = c % 3;
        const x1 = offsetX + ac * cellSize + cellSize / 2;
        const y1 = offsetY + ar * cellSize + cellSize / 2;
        const x2 = offsetX + cc * cellSize + cellSize / 2;
        const y2 = offsetY + cr * cellSize + cellSize / 2;

        ctx.strokeStyle = state.winner === 'X' ? colors.accent1 : (colors.accent2 || colors.accent1);
        ctx.lineWidth = 4;
        ctx.shadowBlur = 12;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // ── Score header ──
      const scoreFontSize = Math.max(12, Math.min(18, W * 0.04));
      ctx.font = `bold ${scoreFontSize}px monospace`;
      ctx.textBaseline = 'top';
      ctx.fillStyle = colors.textDim;

      ctx.textAlign = 'left';
      ctx.fillStyle = colors.accent1;
      ctx.fillText(`X: ${state.x_wins || 0}`, 8, 8);

      ctx.textAlign = 'right';
      ctx.fillStyle = colors.accent2 || colors.accent1;
      ctx.fillText(`O: ${state.o_wins || 0}`, W - 8, 8);

      ctx.textAlign = 'center';
      ctx.fillStyle = colors.textDim;
      ctx.fillText(`DRAW: ${state.draws || 0}`, W / 2, 8);

      // ── Status / whose turn ──
      if (state.winner) {
        ctx.font = `bold ${Math.max(14, W * 0.04)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = colors.text || '#ffffff';
        const msg = state.winner === 'draw' ? 'DRAW' : `${state.winner} WINS`;
        ctx.fillText(msg, W / 2, H - 22);
      }

      // ── HUD bottom ──
      ctx.font = '9px monospace';
      ctx.textBaseline = 'bottom';

      const strategy = (state.strategy || '').toUpperCase().replace(/_/g, ' ');
      ctx.textAlign = 'left';
      ctx.fillStyle = colors.textDim;
      ctx.fillText(strategy, 6, H - 6);

      ctx.textAlign = 'right';
      ctx.fillText(`GAME ${state.game_count || 0}  MOVE ${state.move_count || 0}`, W - 6, H - 6);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
