/**
 * Server rack / system topology with blinking status lights — canvas renderer.
 * Server sends component list with status, lights, and load values.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    textDim: get('--color-text-dim'),
    textPri: get('--color-text-primary'),
    border:  get('--color-border'),
    warn:    get('--color-warn'),
    error:   get('--color-error'),
    info:    get('--color-info'),
  };
}

const LIGHT_COLORS = {
  green: '#4caf50',
  amber: '#ff9800',
  red:   '#f44336',
  off:   '#333333',
};

const STATUS_COLORS = {
  ok:      null, // accent1
  warn:    null, // warn
  error:   null, // error
  offline: null, // textDim
};

export default {
  name: 'ActivitySystemTopology',
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
      const components = state?.components;
      if (!components || components.length === 0) { rafId = requestAnimationFrame(draw); return; }

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

      // Rack dimensions
      const padX = 8;
      const padY = 6;
      const rackW = W - padX * 2;
      const slotH = Math.max(18, (H - padY * 2 - 14) / components.length);
      const slotGap = 2;

      // Rack border
      ctx.strokeStyle = c.border + '66';
      ctx.lineWidth = 1;
      ctx.strokeRect(padX - 2, padY - 2, rackW + 4, components.length * (slotH + slotGap) + 6);

      for (let i = 0; i < components.length; i++) {
        const comp = components[i];
        const y = padY + i * (slotH + slotGap);

        // Slot background
        const statusBg = comp.status === 'error' ? c.error + '11'
          : comp.status === 'warn' ? c.warn + '11'
          : comp.status === 'offline' ? '#ffffff05'
          : c.accent1 + '08';
        ctx.fillStyle = statusBg;
        ctx.fillRect(padX, y, rackW, slotH);

        // Slot border
        ctx.strokeStyle = c.border + '44';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(padX, y, rackW, slotH);

        // Status indicator bar (left edge)
        const statusColor = comp.status === 'error' ? c.error
          : comp.status === 'warn' ? c.warn
          : comp.status === 'offline' ? c.textDim
          : c.info;
        ctx.fillStyle = statusColor;
        ctx.fillRect(padX, y, 3, slotH);

        // Component name
        const fontSize = Math.max(8, Math.min(11, slotH * 0.45));
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.fillStyle = c.textPri;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(comp.name, padX + 8, y + slotH * 0.38);

        // Category tag
        ctx.font = `${Math.max(7, fontSize - 2)}px monospace`;
        ctx.fillStyle = c.textDim;
        ctx.fillText(comp.category.toUpperCase(), padX + 8, y + slotH * 0.75);

        // Status lights
        const lightR = Math.max(2, Math.min(4, slotH * 0.12));
        const lightsX = rackW * 0.55 + padX;
        for (let li = 0; li < comp.lights.length; li++) {
          const lx = lightsX + li * (lightR * 3);
          const ly = y + slotH / 2;
          const lightColor = LIGHT_COLORS[comp.lights[li]] || LIGHT_COLORS.off;

          // Glow
          if (comp.lights[li] !== 'off') {
            ctx.shadowBlur = 4;
            ctx.shadowColor = lightColor;
          }
          ctx.beginPath();
          ctx.arc(lx, ly, lightR, 0, Math.PI * 2);
          ctx.fillStyle = lightColor;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Load bar
        const barX = rackW * 0.75 + padX;
        const barW = rackW * 0.2;
        const barH = Math.max(3, slotH * 0.2);
        const barY = y + slotH / 2 - barH / 2;
        ctx.fillStyle = c.border + '44';
        ctx.fillRect(barX, barY, barW, barH);
        const loadColor = comp.load > 0.8 ? c.error : comp.load > 0.5 ? c.warn : c.info;
        ctx.fillStyle = loadColor;
        ctx.fillRect(barX, barY, barW * comp.load, barH);

        // Data flow animation — small moving dot
        if (comp.data_flow > 0.3 && comp.status !== 'offline') {
          const flowX = padX + rackW * 0.45 + Math.sin(frameCount * 0.1 + i * 2) * rackW * 0.04;
          ctx.beginPath();
          ctx.arc(flowX, y + slotH / 2, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = c.accent2;
          ctx.fill();
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

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
