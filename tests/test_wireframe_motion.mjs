import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../static/js/components/activities/Wireframe3d.js', import.meta.url), 'utf8');
const { default: Wireframe3d } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('wireframe canvas advances using the activity motion settings', () => {
  let mounted;
  let frame;
  const vertexDots = [];
  const ctx = {
    setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
    stroke() {}, fill() {}, fillText() {},
    arc(x, y, radius) { if (radius === 1.5) vertexDots.push([x, y]); },
  };
  globalThis.Vue = {
    ref: value => ({ value }),
    onMounted: callback => { mounted = callback; },
    onUnmounted() {},
  };
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.document = { documentElement: {} };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#00ff88' });
  globalThis.requestAnimationFrame = callback => { frame = callback; return 1; };

  const activity = { state: {
    vertices: [[1, 0, 0]], edges: [], strategy: 'cube',
    rot_x: 0, rot_y: 0, spin_x: 0, spin_y: -2,
  } };
  const controls = Wireframe3d.setup({ activity });
  controls.canvasRef.value = {
    clientWidth: 100, clientHeight: 100, width: 100, height: 100,
    getContext: () => ctx,
  };
  mounted();
  frame(0);
  frame(50);

  assert.equal(vertexDots.length, 2);
  assert.equal(vertexDots[0][0], 81);
  const angle = -0.1; // 50 ms at -2 radians per second
  const expectedX = 50 + Math.cos(angle) * 3 / (3 - Math.sin(angle)) * 31;
  assert.ok(Math.abs(vertexDots[1][0] - expectedX) < 1e-9);
  assert.equal(vertexDots[1][1], 50); // zero X speed stays on the horizontal axis
});
