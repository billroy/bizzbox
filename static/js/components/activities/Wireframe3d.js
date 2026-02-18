/**
 * 3D Wireframe — rotating wireframe mesh rendered with simple 3D→2D projection.
 * Canvas RAF loop — green/cyan lines on dark background with depth-based opacity.
 */
export default {
  name: 'ActivityWireframe3d',
  props: { activity: { type: Object, required: true } },
  setup(props) {
    const { ref, onMounted, onUnmounted, watch } = Vue;
    const canvasRef = ref(null);
    let raf = null;

    // Get current theme accent color or fallback to green
    function getLineColor() {
      const style = getComputedStyle(document.documentElement);
      return style.getPropertyValue('--color-accent-1').trim() || '#00ff88';
    }

    function draw() {
      const canvas = canvasRef.value;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width = canvas.offsetWidth;
      const h = canvas.height = canvas.offsetHeight;
      if (w === 0 || h === 0) return;

      ctx.clearRect(0, 0, w, h);

      const state = props.activity.state;
      if (!state || !state.vertices || !state.edges) return;

      const vertices = state.vertices;
      const edges = state.edges;
      const rotX = state.rot_x || 0;
      const rotY = state.rot_y || 0;

      // Rotation matrices
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);

      // Project vertices
      const fov = 3;
      const projected = [];
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
        const px = w / 2 + x * scale * Math.min(w, h) * 0.35;
        const py = h / 2 + y * scale * Math.min(w, h) * 0.35;

        projected.push([px, py]);
        zValues.push(z);
      }

      // Draw edges with depth-based opacity
      const lineColor = getLineColor();

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
      for (let k = 0; k < projected.length; k++) {
        const opacity = Math.max(0.2, Math.min(0.9, 0.5 - zValues[k] * 0.25));
        ctx.globalAlpha = opacity;
        ctx.fillStyle = lineColor;
        ctx.beginPath();
        ctx.arc(projected[k][0], projected[k][1], 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }

    onMounted(() => {
      raf = requestAnimationFrame(draw);
    });

    onUnmounted(() => {
      if (raf) cancelAnimationFrame(raf);
    });

    return { canvasRef };
  },
  template: `
    <div class="activity-content">
      <canvas ref="canvasRef" class="activity-canvas"></canvas>
    </div>
  `,
};
