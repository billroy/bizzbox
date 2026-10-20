import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SourceTextModule } from 'node:vm';

test('facial recognition renders a fallback for detections without a label', async () => {
  let mounted;
  let draw;
  const text = [];
  const ctx = {
    fillRect() {}, getImageData() { return { data: new Uint8ClampedArray(4) }; },
    putImageData() {}, setTransform() {}, beginPath() {}, moveTo() {},
    lineTo() {}, stroke() {}, arc() {}, fill() {},
    fillText(value) { text.push(value); },
  };
  const canvas = { clientWidth: 100, clientHeight: 100, width: 100, height: 100,
    getContext() { return ctx; } };
  globalThis.Vue = {
    ref: () => ({ value: canvas }),
    onMounted: callback => { mounted = callback; },
    onUnmounted() {},
  };
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.document = { documentElement: {} };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#fff' });
  globalThis.requestAnimationFrame = callback => { draw = callback; return 1; };

  const path = fileURLToPath(new URL('../static/js/components/activities/FacialRecognition.js', import.meta.url));
  const module = new SourceTextModule(await readFile(path, 'utf8'));
  await module.link(() => { throw new Error('unexpected import'); });
  await module.evaluate();
  module.namespace.default.setup({ activity: { state: {
    faces: [
      { x: 0.1, y: 0.1, w: 0.2, h: 0.3, confidence: 0.8 },
      { x: 0.5, y: 0.1, w: 0.2, h: 0.3, confidence: 0.9, label: 'PERSON' },
    ],
  } } });
  mounted();
  draw();

  assert.ok(text.includes('UNIDENTIFIED'));
  assert.ok(text.includes('PERSON'));
  assert.ok(!text.includes(undefined));
});
