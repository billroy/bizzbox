/**
 * Dungeon Master Screen — RPG raid encounter tracker with party HP/MP,
 * boss status, DPS meters, and scrolling combat log.
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
  name: 'ActivityDungeonMaster',
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

      const boss = state.boss || {};
      const party = state.party || [];
      const log = state.combat_log || [];
      const elapsed = state.elapsed_sec || 0;

      // --- Boss bar at top ---
      const bossY = 4;
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = c.error;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(boss.name || 'BOSS', 6, bossY);

      // Phase indicator
      ctx.font = '8px monospace';
      ctx.fillStyle = c.warn;
      ctx.textAlign = 'right';
      ctx.fillText(`P${boss.phase || 1}/${boss.max_phases || 3}`, W - 6, bossY);

      // Boss HP bar
      const bossBarY = bossY + 14;
      const bossBarW = W - 12;
      const bossBarH = 8;
      ctx.fillStyle = c.border + '33';
      ctx.fillRect(6, bossBarY, bossBarW, bossBarH);

      const hpPct = Math.max(0, boss.hp_pct || 0) / 100;
      const hpColor = hpPct > 0.5 ? c.error : hpPct > 0.25 ? c.warn : c.accent1;
      ctx.fillStyle = hpColor;
      ctx.fillRect(6, bossBarY, bossBarW * hpPct, bossBarH);

      ctx.font = '7px monospace';
      ctx.fillStyle = c.textMain;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${(boss.hp_pct || 0).toFixed(1)}%`, W / 2, bossBarY + bossBarH / 2);

      // Enrage timer
      const enrage = boss.enrage_timer || 0;
      ctx.font = '7px monospace';
      ctx.fillStyle = enrage < 30 ? c.error : c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const min = Math.floor(enrage / 60);
      const sec = enrage % 60;
      ctx.fillText(`ENRAGE ${min}:${sec.toString().padStart(2, '0')}`, 6, bossBarY + bossBarH + 3);

      // Time elapsed
      const eMin = Math.floor(elapsed / 60);
      const eSec = elapsed % 60;
      ctx.textAlign = 'right';
      ctx.fillStyle = c.textDim;
      ctx.fillText(`${eMin}:${eSec.toString().padStart(2, '0')}`, W - 6, bossBarY + bossBarH + 3);

      // --- Party members ---
      const partyY = bossBarY + bossBarH + 16;
      const memberH = Math.min(22, (H * 0.45) / Math.max(party.length, 1));

      party.forEach((p, i) => {
        const y = partyY + i * (memberH + 2);
        if (y + memberH > H * 0.7) return;

        const dead = !p.alive;
        const alpha = dead ? 0.3 : 1.0;
        ctx.globalAlpha = alpha;

        // Name and class
        ctx.font = '7px monospace';
        ctx.fillStyle = dead ? c.error : c.textMain;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const nameStr = `${p.name}`;
        ctx.fillText(nameStr, 6, y);

        ctx.fillStyle = c.textDim;
        ctx.fillText(p.class, 6, y + 9);

        // HP bar
        const hpBarX = W * 0.35;
        const hpBarW = W * 0.25;
        const barH = 4;
        const hpFrac = p.max_hp > 0 ? p.hp / p.max_hp : 0;
        ctx.fillStyle = c.border + '33';
        ctx.fillRect(hpBarX, y + 2, hpBarW, barH);
        ctx.fillStyle = hpFrac > 0.5 ? c.accent2 : hpFrac > 0.25 ? c.warn : c.error;
        ctx.fillRect(hpBarX, y + 2, hpBarW * hpFrac, barH);

        // MP bar
        const mpFrac = p.max_mp > 0 ? p.mp / p.max_mp : 0;
        ctx.fillStyle = c.border + '33';
        ctx.fillRect(hpBarX, y + 8, hpBarW, barH);
        ctx.fillStyle = c.accent3 || c.accent1;
        ctx.fillRect(hpBarX, y + 8, hpBarW * mpFrac, barH);

        // DPS
        ctx.font = '7px monospace';
        ctx.fillStyle = c.accent1;
        ctx.textAlign = 'left';
        ctx.fillText(`${p.dps} DPS`, hpBarX + hpBarW + 4, y + 2);

        // Status effects
        if (p.status_effects && p.status_effects.length > 0) {
          ctx.font = '6px monospace';
          ctx.fillStyle = c.warn;
          ctx.fillText(p.status_effects.join(' '), hpBarX + hpBarW + 4, y + 10);
        }

        ctx.globalAlpha = 1;
      });

      // --- Combat log at bottom ---
      const logY = H * 0.68;
      ctx.strokeStyle = c.border + '44';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(4, logY);
      ctx.lineTo(W - 4, logY);
      ctx.stroke();

      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('COMBAT LOG', 6, logY + 2);

      const logStartY = logY + 14;
      const lineH = 10;
      const maxLines = Math.floor((H - logStartY - 4) / lineH);

      log.slice(-maxLines).forEach((entry, i) => {
        const ly = logStartY + i * lineH;
        ctx.font = '7px monospace';
        const isCrit = entry.includes('CRITICAL') || entry.includes('**');
        ctx.fillStyle = isCrit ? c.warn : entry.includes('slain') ? c.error : c.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Truncate long entries
        const maxChars = Math.floor((W - 12) / 4.2);
        const display = entry.length > maxChars ? entry.slice(0, maxChars - 2) + '..' : entry;
        ctx.fillText(display, 6, ly);
      });

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
