/**
 * 3D Wireframe — rotating wireframe mesh rendered with simple 3D→2D projection.
 * Canvas RAF loop — green/cyan lines on dark background with depth-based opacity.
 */
export default {
  name: 'ActivityWireframe3d',
  props: { activity: { type: Object, required: true } },
  setup(props) {
    const { ref, onMounted, onUnmounted } = Vue;
    const canvasRef = ref(null);
    let raf = null;
    let lastTime = null;
    let rotX = props.activity.state?.rot_x || 0;
    let rotY = props.activity.state?.rot_y || 0;
    const zoom = ref(1);
    const paused = ref(false);
    const labels = ref(false);
    const selected = ref(null);
    let drag = null;
    let projected = [];

    function reset() {
      rotX = 0;
      rotY = 0;
      zoom.value = 1;
      selected.value = null;
      paused.value = false;
    }

    function pointerDown(event) {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY };
    }

    function pointerMove(event) {
      if (!drag) return;
      rotY += (event.clientX - drag.x) * 0.012;
      rotX += (event.clientY - drag.y) * 0.012;
      drag.x = event.clientX;
      drag.y = event.clientY;
    }

    function pointerUp(event) {
      if (!drag) return;
      const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      drag = null;
      if (moved > 5) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      let best = null;
      let distance = 14;
      projected.forEach(([px, py], index) => {
        const d = Math.hypot(px - x, py - y);
        if (d < distance) { distance = d; best = index; }
      });
      selected.value = best;
    }

    function pointerCancel() { drag = null; }

    function wheel(event) {
      zoom.value = Math.max(0.55, Math.min(2.4, zoom.value * (event.deltaY > 0 ? 0.9 : 1.1)));
    }

    // Get current theme accent color or fallback to green
    function getLineColor() {
      const style = getComputedStyle(document.documentElement);
      return style.getPropertyValue('--color-accent-1').trim() || '#00ff88';
    }

    function draw(time) {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.value;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, w, h);

      const state = props.activity.state;
      if (!state || !state.vertices || !state.edges) return;

      const vertices = state.vertices;
      const edges = state.edges;
      const dt = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      if (!paused.value && !drag) {
        rotX += dt * 0.18;
        rotY += dt * 0.32;
      }

      // Rotation matrices
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);

      // Project vertices
      const fov = 3;
      projected = [];
      const zValues = [];

      for (const [vx, vy, vz] of vertices) {
        // Rotate around Y
        let x = vx * cosY + vz * sinY;
        let z = -vx * sinY + vz * cosY;
        let y = vy;

        // Rotate around X
        const y2 = y * cosX - z * sinX;
        const z2 = y * sinX + z * cosX;
        y = y2;
        z = z2;

        // Perspective projection
        const d = fov + z;
        const scale = d > 0.1 ? fov / d : fov / 0.1;
        const px = w / 2 + x * scale * Math.min(w, h) * 0.31 * zoom.value;
        const py = h / 2 + y * scale * Math.min(w, h) * 0.31 * zoom.value;

        projected.push([px, py]);
        zValues.push(z);
      }

      // Draw edges with depth-based opacity
      const lineColor = getLineColor();

      // Subtle reticle keeps the object legible while it rotates.
      ctx.strokeStyle = lineColor;
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.37, 0, Math.PI * 2);
      ctx.moveTo(w / 2 - 8, h / 2); ctx.lineTo(w / 2 + 8, h / 2);
      ctx.moveTo(w / 2, h / 2 - 8); ctx.lineTo(w / 2, h / 2 + 8);
      ctx.stroke();

      // Parse the color to apply opacity
      for (const [i, j] of edges) {
        if (i >= projected.length || j >= projected.length) continue;
        const avgZ = (zValues[i] + zValues[j]) / 2;
        // Map z from [-1.5, 1.5] to opacity [0.15, 0.9]
        const opacity = Math.max(0.15, Math.min(0.9, 0.5 - avgZ * 0.25));

        ctx.beginPath();
        ctx.moveTo(projected[i][0], projected[i][1]);
        ctx.lineTo(projected[j][0], projected[j][1]);
        ctx.strokeStyle = lineColor;
        ctx.globalAlpha = opacity;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw vertex dots
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      for (let k = 0; k < projected.length; k++) {
        const opacity = Math.max(0.2, Math.min(0.9, 0.5 - zValues[k] * 0.25));
        ctx.globalAlpha = opacity;
        ctx.fillStyle = lineColor;
        ctx.beginPath();
        ctx.arc(projected[k][0], projected[k][1], selected.value === k ? 4 : 1.5, 0, Math.PI * 2);
        ctx.fill();
        if (labels.value || selected.value === k) {
          ctx.font = '9px monospace';
          ctx.fillText(String(k), projected[k][0] + 5, projected[k][1] - 5);
        }
      }

      ctx.globalAlpha = 1;
      ctx.font = '9px monospace';
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text-dim').trim() || lineColor;
      ctx.textAlign = 'left';
      ctx.fillText((state.strategy || 'mesh').replace(/_/g, ' ').toUpperCase(), 8, 14);
      if (w > 150) {
        ctx.textAlign = 'right';
        ctx.fillText(`${vertices.length} V / ${edges.length} E`, w - 8, 14);
      }
      if (selected.value !== null && vertices[selected.value]) {
        ctx.textAlign = 'left';
        ctx.fillStyle = lineColor;
        ctx.fillText(`V${selected.value}  ${vertices[selected.value].map(n => Number(n).toFixed(2)).join(', ')}`, 8, h - 8);
      }
    }

    onMounted(() => {
      raf = requestAnimationFrame(draw);
    });

    onUnmounted(() => {
      if (raf) cancelAnimationFrame(raf);
    });

    return { canvasRef, paused, labels, reset, pointerDown, pointerMove, pointerUp, pointerCancel, wheel };
  },
  template: `
    <div class="wireframe-viewer">
      <canvas ref="canvasRef" class="activity-canvas wireframe-canvas"
        @pointerdown="pointerDown" @pointermove="pointerMove"
        @pointerup="pointerUp" @pointercancel="pointerCancel" @wheel.prevent="wheel"
        aria-label="3D wireframe. Drag to rotate, scroll to zoom, click a point to inspect it."></canvas>
      <div class="wireframe-controls">
        <button type="button" @click="paused = !paused" :aria-label="paused ? 'Resume rotation' : 'Pause rotation'">{{ paused ? 'PLAY' : 'PAUSE' }}</button>
        <button type="button" @click="labels = !labels" :aria-pressed="labels">{{ labels ? 'LABELS ON' : 'LABELS' }}</button>
        <button type="button" @click="reset">RESET</button>
      </div>
    </div>
  `,
};
