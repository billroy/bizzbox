/**
 * Mech Bay — wireframe mech silhouette with color-coded subsystem overlays,
 * weapon loadout, and system gauges.
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

function statusColor(status, c) {
  switch (status) {
    case 'nominal': case 'ready':    return c.accent2;
    case 'degraded': case 'cycling': return c.warn;
    case 'fault': case 'jammed': case 'offline': return c.error;
    default: return c.textDim;
  }
}

// Mech wireframe section positions (relative to mech center, normalized)
const SECTION_POS = {
  head:     { x: 0.0, y: -0.42, w: 0.12, h: 0.08 },
  torso_ct: { x: 0.0, y: -0.25, w: 0.18, h: 0.18 },
  torso_lt: { x: -0.16, y: -0.22, w: 0.10, h: 0.15 },
  torso_rt: { x: 0.16, y: -0.22, w: 0.10, h: 0.15 },
  arm_la:   { x: -0.30, y: -0.15, w: 0.08, h: 0.28 },
  arm_ra:   { x: 0.30, y: -0.15, w: 0.08, h: 0.28 },
  leg_ll:   { x: -0.10, y: 0.12, w: 0.10, h: 0.35 },
  leg_rl:   { x: 0.10, y: 0.12, w: 0.10, h: 0.35 },
};

export default {
  name: 'ActivityMechBay',
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

      const sections = state.sections || [];
      const weapons = state.weapons || [];
      const mechName = state.mech_name || 'MECH';

      // Mech name header
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(mechName, W / 2, 4);

      // Wireframe center
      const mechCx = W * 0.38;
      const mechCy = H * 0.48;
      const scale = Math.min(W * 0.7, H * 0.75);

      // Draw sections as rectangles
      for (const sec of sections) {
        const pos = SECTION_POS[sec.id];
        if (!pos) continue;

        const sx = mechCx + pos.x * scale;
        const sy = mechCy + pos.y * scale;
        const sw = pos.w * scale;
        const sh = pos.h * scale;

        // Armor fill (color based on percentage)
        const armor = sec.armor_pct;
        let fillColor;
        if (armor > 70) fillColor = c.accent2 + '33';
        else if (armor > 40) fillColor = c.warn + '33';
        else fillColor = c.error + '33';

        ctx.fillStyle = fillColor;
        ctx.fillRect(sx - sw / 2, sy, sw, sh);

        // Armor bar inside section
        const barH = 3;
        const barW = sw * 0.8;
        const barX = sx - barW / 2;
        const barY = sy + sh - barH - 2;
        ctx.fillStyle = c.border + '44';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = armor > 70 ? c.accent2 : armor > 40 ? c.warn : c.error;
        ctx.fillRect(barX, barY, barW * (armor / 100), barH);

        // Section border
        const servoColor = statusColor(sec.servo_status, c);
        ctx.strokeStyle = servoColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx - sw / 2, sy, sw, sh);

        // Servo fault pulse
        if (sec.servo_status === 'fault' && Math.floor(frameCount / 8) % 2 === 0) {
          ctx.strokeStyle = c.error;
          ctx.lineWidth = 2;
          ctx.strokeRect(sx - sw / 2 - 1, sy - 1, sw + 2, sh + 2);
        }

        // Label
        ctx.font = '6px monospace';
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`${armor}%`, sx, sy + 2);
      }

      // Right panel: weapons list
      const wpnX = W * 0.68;
      const wpnY = 20;
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('WEAPONS', wpnX, wpnY);

      weapons.forEach((w, i) => {
        const y = wpnY + 14 + i * 14;
        if (y > H - 40) return;
        const wColor = statusColor(w.status, c);
        ctx.font = '7px monospace';
        ctx.fillStyle = wColor;
        ctx.textAlign = 'left';
        ctx.fillText(w.name, wpnX, y);
        ctx.fillStyle = c.textDim;
        ctx.fillText(w.status.toUpperCase(), wpnX + 60, y);
        if (w.ammo_pct !== null && w.ammo_pct !== undefined) {
          ctx.fillStyle = w.ammo_pct < 20 ? c.error : c.textDim;
          ctx.fillText(`${w.ammo_pct}%`, wpnX + 105, y);
        }
      });

      // Bottom gauges
      const gaugeY = H - 22;
      const gauges = [
        { label: 'HEAT', val: state.heat_pct, warn: 70, crit: 90 },
        { label: 'COOL', val: state.coolant_pct, warn: 40, crit: 25, invert: true },
        { label: 'LINK', val: state.neural_link_pct, warn: 70, crit: 60, invert: true },
        { label: 'REAC', val: state.reactor_output_pct, warn: 70, crit: 65, invert: true },
      ];

      const gaugeW = (W - 16) / gauges.length;
      gauges.forEach((g, i) => {
        const gx = 8 + i * gaugeW;
        const barW = gaugeW - 8;
        const barH = 5;

        ctx.font = '7px monospace';
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${g.label} ${g.val.toFixed(0)}%`, gx, gaugeY - 2);

        // Bar bg
        ctx.fillStyle = c.border + '33';
        ctx.fillRect(gx, gaugeY, barW, barH);

        // Bar fill
        let barColor;
        if (g.invert) {
          barColor = g.val < g.crit ? c.error : g.val < g.warn ? c.warn : c.accent2;
        } else {
          barColor = g.val > g.crit ? c.error : g.val > g.warn ? c.warn : c.accent2;
        }
        ctx.fillStyle = barColor;
        ctx.fillRect(gx, gaugeY, barW * (g.val / 100), barH);
      });

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
