/**
 * Process Monitor — canvas-based CPU core bars, memory bar, and scrolling process table.
 */
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (v) => s.getPropertyValue(v).trim();
  return {
    bg:      get('--color-surface'),
    surface2:get('--color-surface-2'),
    accent1: get('--color-accent-1'),
    accent2: get('--color-accent-2'),
    textDim: get('--color-text-dim'),
    textMain:get('--color-text-primary'),
    border:  get('--color-border'),
    error:   get('--color-error'),
    warn:    get('--color-warn'),
  };
}

function cpuBarColor(usage, c) {
  if (usage > 90) return c.error;
  if (usage >= 70) return c.warn;
  return c.accent1;
}

export default {
  name: 'ActivityProcessMonitor',
  props: { activity: Object },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let rafId = null;

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) { rafId = requestAnimationFrame(draw); return; }
      const state = props.activity?.state;
      if (!state || !state.cores) { rafId = requestAnimationFrame(draw); return; }

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (W === 0 || H === 0) { rafId = requestAnimationFrame(draw); return; }

      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr;
        canvas.height = H * dpr;
      }

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = getThemeColors();

      // Clear
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, W, H);

      const pad = 8;
      const fontSize = Math.max(9, Math.min(12, H * 0.02));
      ctx.font = `${fontSize}px monospace`;

      // --- Layout ---
      // Top section: cores + memory + load avg (~35% of height)
      const topH = Math.floor(H * 0.35);
      // Bottom section: process table
      const bottomY = topH + 2;
      const bottomH = H - bottomY;

      // === TOP SECTION: CPU CORE BARS ===
      const cores = state.cores || [];
      const numCores = cores.length;
      const labelW = fontSize * 4;       // "C15 " width
      const pctLabelW = fontSize * 3.5;  // "100%" width
      const barLeft = pad + labelW;
      const barRight = W - pad - pctLabelW;
      const barMaxW = barRight - barLeft;

      // Space for cores, then memory bar, then load avg line
      const memBarH = fontSize + 4;
      const loadLineH = fontSize + 4;
      const coreAreaH = topH - memBarH - loadLineH - pad;
      const coreBarH = Math.max(4, Math.min(14, (coreAreaH - pad) / numCores - 2));
      const coreSpacing = coreBarH + 2;
      const coresStartY = pad;

      for (let i = 0; i < numCores; i++) {
        const usage = cores[i].usage;
        const y = coresStartY + i * coreSpacing;
        const col = cpuBarColor(usage, c);

        // Core label
        ctx.fillStyle = c.textDim;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`C${i}`, pad + labelW - 4, y + coreBarH / 2);

        // Bar track
        ctx.fillStyle = c.border + '44';
        ctx.fillRect(barLeft, y, barMaxW, coreBarH);

        // Bar fill
        const fillW = (usage / 100) * barMaxW;
        ctx.fillStyle = col;
        ctx.fillRect(barLeft, y, fillW, coreBarH);

        // Percentage label
        ctx.fillStyle = col;
        ctx.textAlign = 'left';
        ctx.fillText(`${usage}%`, barRight + 4, y + coreBarH / 2);
      }

      // === MEMORY BAR ===
      const memY = coresStartY + numCores * coreSpacing + 4;
      const memTotal = state.mem_total || 1;
      const memUsed = state.mem_used || 0;
      const memPct = Math.min(1, memUsed / memTotal);
      const memUsedGB = (memUsed / 1024).toFixed(1);
      const memTotalGB = (memTotal / 1024).toFixed(1);

      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('MEM', pad + labelW - 4, memY + memBarH / 2);

      // Track
      ctx.fillStyle = c.border + '44';
      ctx.fillRect(barLeft, memY, barMaxW, memBarH - 2);

      // Fill
      const memCol = memPct > 0.9 ? c.error : memPct > 0.75 ? c.warn : c.accent2;
      ctx.fillStyle = memCol;
      ctx.fillRect(barLeft, memY, memPct * barMaxW, memBarH - 2);

      // Memory text overlay
      ctx.fillStyle = c.textMain;
      ctx.textAlign = 'left';
      ctx.fillText(`${memUsedGB} / ${memTotalGB} GB`, barRight + 4, memY + (memBarH - 2) / 2);

      // === LOAD AVERAGE ===
      const loadY = memY + memBarH + 2;
      const loadAvg = state.load_avg || [0, 0, 0];
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `LOAD: ${loadAvg[0].toFixed(2)} / ${loadAvg[1].toFixed(2)} / ${loadAvg[2].toFixed(2)}`,
        pad,
        loadY + loadLineH / 2
      );

      // === SEPARATOR ===
      ctx.strokeStyle = c.border + '66';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, bottomY - 1);
      ctx.lineTo(W - pad, bottomY - 1);
      ctx.stroke();

      // === BOTTOM SECTION: PROCESS TABLE ===
      const processes = state.processes || [];
      // Sort by CPU descending
      const sorted = [...processes].sort((a, b) => b.cpu - a.cpu);

      const rowH = fontSize + 4;
      const headerY = bottomY + 4;

      // Column definitions (proportional widths)
      const cols = [
        { label: 'PID',    w: 0.10, align: 'right' },
        { label: 'NAME',   w: 0.24, align: 'left'  },
        { label: 'USER',   w: 0.16, align: 'left'  },
        { label: 'CPU%',   w: 0.12, align: 'right' },
        { label: 'MEM%',   w: 0.12, align: 'right' },
        { label: 'STATUS', w: 0.14, align: 'left'  },
        { label: 'TIME',   w: 0.12, align: 'right' },
      ];

      const tableW = W - pad * 2;
      let colX = pad;
      const colPositions = cols.map((col) => {
        const x = colX;
        colX += col.w * tableW;
        return x;
      });

      // Draw header
      ctx.textBaseline = 'top';
      ctx.fillStyle = c.accent1;
      for (let i = 0; i < cols.length; i++) {
        ctx.textAlign = cols[i].align;
        const x = cols[i].align === 'right' ? colPositions[i] + cols[i].w * tableW - 4 : colPositions[i] + 2;
        ctx.fillText(cols[i].label, x, headerY);
      }

      // Header underline
      ctx.strokeStyle = c.border + '88';
      ctx.beginPath();
      ctx.moveTo(pad, headerY + rowH);
      ctx.lineTo(W - pad, headerY + rowH);
      ctx.stroke();

      // Draw rows
      const dataStartY = headerY + rowH + 2;
      const maxRows = Math.floor((H - dataStartY - rowH) / rowH);

      for (let r = 0; r < Math.min(sorted.length, maxRows); r++) {
        const proc = sorted[r];
        const y = dataStartY + r * rowH;

        // Alternating row background
        if (r % 2 === 1) {
          ctx.fillStyle = c.surface2 + '33';
          ctx.fillRect(pad, y - 1, tableW, rowH);
        }

        // Determine row color
        let rowColor = c.textMain;
        if (proc.status === 'zombie') {
          rowColor = c.error;
        } else if (r < 3) {
          // Top 3 CPU consumers highlighted
          rowColor = c.accent1;
        }

        ctx.fillStyle = rowColor;
        ctx.textBaseline = 'top';

        const values = [
          String(proc.pid),
          proc.name,
          proc.user,
          proc.cpu.toFixed(1),
          proc.mem.toFixed(1),
          proc.status.toUpperCase(),
          proc.runtime,
        ];

        for (let i = 0; i < cols.length; i++) {
          ctx.textAlign = cols[i].align;
          const x = cols[i].align === 'right' ? colPositions[i] + cols[i].w * tableW - 4 : colPositions[i] + 2;
          // Truncate name/user if too wide
          let text = values[i];
          const maxCellW = cols[i].w * tableW - 6;
          while (ctx.measureText(text).width > maxCellW && text.length > 1) {
            text = text.slice(0, -1);
          }
          ctx.fillText(text, x, y);
        }
      }

      // === STRATEGY LABEL (bottom-right) ===
      const strategyLabel = (state.strategy || '').toUpperCase().replace(/_/g, ' ');
      ctx.fillStyle = c.textDim;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.font = `${Math.max(8, fontSize - 1)}px monospace`;
      ctx.fillText(strategyLabel, W - pad, H - 4);

      rafId = requestAnimationFrame(draw);
    }

    onMounted(() => { rafId = requestAnimationFrame(draw); });
    onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId); });

    return { canvasRef };
  },
  template: `<canvas ref="canvasRef" class="activity-canvas"></canvas>`,
};
