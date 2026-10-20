import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SourceTextModule } from 'node:vm';

test('unit readiness draws its frame and never prints undefined after a compact update', async () => {
  let mounted;
  let draw;
  const labels = [];
  const sectionOutlines = [];
  const ctx = {
    fillRect() {}, setTransform() {},
    strokeRect(x, y, width, height) { sectionOutlines.push({ x, y, width, height }); },
    fillText(value) { labels.push(value); },
  };
  const canvas = {
    clientWidth: 384, clientHeight: 270, width: 384, height: 270,
    getContext() { return ctx; },
  };
  globalThis.Vue = {
    ref: () => ({ value: canvas }),
    onMounted: callback => { mounted = callback; },
    onUnmounted() {},
  };
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.document = { documentElement: {} };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#fff' });
  globalThis.requestAnimationFrame = callback => { draw = callback; return 1; };

  const path = fileURLToPath(new URL('../static/js/components/activities/MechBay.js', import.meta.url));
  const module = new SourceTextModule(await readFile(path, 'utf8'));
  await module.link(() => { throw new Error('unexpected import'); });
  await module.evaluate();
  module.namespace.default.setup({ activity: { state: {
    mech_name: 'ATLAS',
    sections: [{ armor_pct: 85, servo_status: 'nominal' }, { armor_pct: 70, servo_status: 'degraded' }],
    weapons: [{ status: 'ready', ammo_pct: 65 }],
    heat_pct: 20, coolant_pct: 90, neural_link_pct: 95, reactor_output_pct: 85,
  } } });
  mounted();
  draw();

  assert.ok(sectionOutlines.length >= 2);
  assert.ok(sectionOutlines.every(({ x, width }) => x >= 0 && x + width < canvas.clientWidth * 0.65));
  assert.ok(labels.includes('ARMOR 78%  /  2 SECTIONS'));
  assert.ok(labels.includes('MOUNT 1'));
  assert.ok(labels.every(label => !String(label).includes('undefined')));

  // A dense grid leaves little vertical room. The frame must still be visible.
  canvas.clientWidth = 190;
  canvas.clientHeight = 90;
  sectionOutlines.length = 0;
  labels.length = 0;
  draw();
  assert.ok(sectionOutlines.length >= 2);
  assert.ok(sectionOutlines.every(({ x, width }) =>
    x >= 0 && x + width < canvas.clientWidth * 0.65 && width >= 8));
  assert.ok(labels.includes('MOUNT 1'));
  assert.ok(labels.every(label => !String(label).includes('undefined')));
});
