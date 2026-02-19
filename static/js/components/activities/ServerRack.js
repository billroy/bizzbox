/**
 * Server Rack — canvas-based rack unit display with LEDs, CPU bars, and fan indicators.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    surface2:get('--color-surface-2'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    warn:    get('--color-warn'),
    error:   get('--color-error'),
    textDim: get('--color-text-dim'),
    textMain:get('--color-text-primary'),
    border:  get('--color-border'),
  };
}

const LED_COLORS = {
  green: '#00cc44',
  amber: '#ffaa00',
  red:   '#ee3333',
};

export default {
  name: 'ActivityServerRack',
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
      if (!state || !state.units) { rafId = requestAnimationFrame(draw); return; }

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

      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const units = state.units;
      const rackLabel = state.rack_label || 'RACK';
      const totalLoad = state.total_load || 0;
      const strategy = state.strategy || '';

      // Layout
      const margin = 8;
      const headerH = 20;
      const footerH = 28;
      const rackX = margin;
      const rackY = margin + headerH;
      const rackW = W - margin * 2;
      const rackH = H - margin * 2 - headerH - footerH;

      // Rack frame border
      ctx.strokeStyle = c.border;
      ctx.lineWidth = 2;
      ctx.strokeRect(rackX, rackY, rackW, rackH);

      // Rack label at top
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = c.accent1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rackLabel, W / 2, margin + headerH / 2);

      // Calculate total U for proportional heights
      let totalU = 0;
      for (const unit of units) totalU += unit.size_u;

      // Draw each unit as a horizontal strip
      const unitGap = 1;
      const usableH = rackH - unitGap * (units.length + 1);
      let yPos = rackY + unitGap;

      for (const unit of units) {
        const unitH = Math.max(12, (unit.size_u / totalU) * usableH);
        const unitX = rackX + 2;
        const unitW = rackW - 4;

        // Unit background
        ctx.fillStyle = c.surface2;
        ctx.fillRect(unitX, yPos, unitW, unitH);

        // Unit border
        ctx.strokeStyle = c.border + '66';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(unitX, yPos, unitW, unitH);

        // Layout zones within the unit
        const innerPad = 4;
        const midY = yPos + unitH / 2;

        // --- Left side: server name ---
        ctx.font = `${Math.max(7, Math.min(10, unitH * 0.45))}px monospace`;
        ctx.fillStyle = c.textMain;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(unit.name, unitX + innerPad, midY);

        // Name width for offset
        const nameWidth = ctx.measureText(unit.name).width;

        // --- LEDs ---
        const ledRadius = Math.max(2, Math.min(2.5, unitH * 0.15));
        const ledStartX = unitX + innerPad + nameWidth + 8;
        const leds = unit.leds || [];
        for (let li = 0; li < leds.length; li++) {
          const led = leds[li];
          const lx = ledStartX + li * (ledRadius * 2 + 3);

          // Blinking LEDs: smooth slow pulse instead of hard toggle
          const ledColor = LED_COLORS[led.color] || LED_COLORS.green;
          if (led.blink) {
            const ledAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(frameCount * 0.05 + li));
            ctx.globalAlpha = ledAlpha;
          }

          // LED glow
          ctx.beginPath();
          ctx.arc(lx, midY, ledRadius + 1, 0, Math.PI * 2);
          ctx.fillStyle = ledColor + '33';
          ctx.fill();

          // LED dot
          ctx.beginPath();
          ctx.arc(lx, midY, ledRadius, 0, Math.PI * 2);
          ctx.fillStyle = ledColor;
          ctx.fill();

          if (led.blink) ctx.globalAlpha = 1;
        }

        // --- CPU load bar ---
        const barH = Math.max(3, unitH * 0.2);
        const barMaxW = unitW * 0.25;
        const barX = unitX + unitW * 0.42;
        const barY = midY - barH / 2;
        const cpuLoad = unit.cpu_load || 0;
        const barW = (cpuLoad / 100) * barMaxW;

        // Bar background
        ctx.fillStyle = c.border + '33';
        ctx.fillRect(barX, barY, barMaxW, barH);

        // Bar fill
        let barColor;
        if (cpuLoad > 90) barColor = c.error;
        else if (cpuLoad >= 70) barColor = c.warn;
        else barColor = c.accent1;
        ctx.fillStyle = barColor;
        ctx.fillRect(barX, barY, barW, barH);

        // CPU percentage label
        ctx.font = `${Math.max(6, Math.min(8, unitH * 0.3))}px monospace`;
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${cpuLoad}%`, barX + barMaxW + 3, midY);

        // --- Fan indicator: spinning hash marks ---
        const fanX = unitX + unitW * 0.78;
        const fanR = Math.max(3, Math.min(5, unitH * 0.25));
        const fanSpeed = unit.fan_speed || 0;
        const fanAngle = (frameCount * fanSpeed * 0.02) % (Math.PI * 2);

        ctx.save();
        ctx.translate(fanX, midY);
        ctx.rotate(fanAngle);
        ctx.strokeStyle = c.textDim;
        ctx.lineWidth = 1;
        for (let b = 0; b < 4; b++) {
          const a = (Math.PI / 2) * b;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * fanR, Math.sin(a) * fanR);
          ctx.stroke();
        }
        ctx.restore();

        // --- Status badge ---
        const badgeX = unitX + unitW - innerPad;
        ctx.font = `bold ${Math.max(6, Math.min(9, unitH * 0.35))}px monospace`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const status = unit.status || 'online';
        if (status === 'online') {
          ctx.fillStyle = c.accent2;
          ctx.fillText('ONLINE', badgeX, midY);
        } else if (status === 'degraded') {
          ctx.fillStyle = c.warn;
          ctx.fillText('DEGRADED', badgeX, midY);
        } else if (status === 'offline') {
          ctx.fillStyle = c.error;
          ctx.fillText('OFFLINE', badgeX, midY);
        } else if (status === 'rebooting') {
          // Gently pulsing reboot text
          ctx.globalAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(frameCount * 0.06));
          ctx.fillStyle = c.accent1;
          ctx.fillText('REBOOT', badgeX, midY);
          ctx.globalAlpha = 1;
        }

        // --- Role label (dim, before status badge) ---
        const roleX = unitX + unitW - innerPad - 60;
        ctx.font = `${Math.max(6, Math.min(8, unitH * 0.3))}px monospace`;
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'right';
        ctx.fillText(unit.role.toUpperCase(), roleX, midY);

        yPos += unitH + unitGap;
      }

      // --- Total load bar at bottom ---
      const footerY = H - margin - footerH;
      const loadBarX = rackX + 4;
      const loadBarW = rackW * 0.65;
      const loadBarH = 6;
      const loadBarY = footerY + footerH / 2 - loadBarH / 2;

      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('AVG LOAD', loadBarX, footerY + 6);

      // Bar background
      ctx.fillStyle = c.border + '33';
      ctx.fillRect(loadBarX, loadBarY + 4, loadBarW, loadBarH);

      // Bar fill
      let loadColor;
      if (totalLoad > 90) loadColor = c.error;
      else if (totalLoad >= 70) loadColor = c.warn;
      else loadColor = c.accent1;
      ctx.fillStyle = loadColor;
      ctx.fillRect(loadBarX, loadBarY + 4, (totalLoad / 100) * loadBarW, loadBarH);

      // Load percentage
      ctx.fillStyle = c.textMain;
      ctx.textAlign = 'left';
      ctx.fillText(`${totalLoad}%`, loadBarX + loadBarW + 6, loadBarY + 4 + loadBarH / 2);

      // --- Strategy label bottom-right ---
      ctx.font = '9px monospace';
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'right';
      ctx.fillText(strategy.toUpperCase().replace(/_/g, ' '), W - margin, footerY + footerH / 2);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
