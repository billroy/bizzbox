import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { SourceTextModule } from 'node:vm';

const source = await readFile(new URL('../static/js/components/activities/PowerGrid.js', import.meta.url), 'utf8');
const module = new SourceTextModule(source);
await module.link(() => { throw new Error('Unexpected import'); });
await module.evaluate();
const component = module.namespace.default;

test('power grid starts drawing when its canvas and state become ready after mount', () => {
  let mounted;
  let unmounted;
  const frames = new Map();
  let nextFrame = 0;
  const draws = [];
  globalThis.Vue = {
    ref: value => ({ value }),
    onMounted: callback => { mounted = callback; },
    onUnmounted: callback => { unmounted = callback; },
  };
  globalThis.requestAnimationFrame = callback => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  };
  globalThis.cancelAnimationFrame = id => frames.delete(id);

  const activity = { state: null };
  const { canvasRef } = component.setup({ activity });
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key === 'measureText') return text => ({ width: text.length * 5 });
      if (key === 'fillText') return text => draws.push(text);
      return () => {};
    },
    set: () => true,
  });
  const canvas = { offsetWidth: 0, offsetHeight: 0, getContext: () => ctx };
  canvasRef.value = canvas;

  function runFrame() {
    assert.equal(frames.size, 1, 'a frame remains scheduled');
    const [id, callback] = frames.entries().next().value;
    frames.delete(id);
    callback();
  }

  mounted();
  runFrame(); // Canvas still has no size.
  canvas.offsetWidth = 300;
  canvas.offsetHeight = 180;
  runFrame(); // State has not arrived yet.
  activity.state = {
    nodes: [{ id: 'n0', type: 'generator', label: 'GEN-1', x: 0.5, y: 0.5, status: 'online' }],
    edges: [],
    readings: {},
  };
  runFrame();
  assert.ok(draws.includes('GEN-1'));
  unmounted();
  assert.equal(frames.size, 0);
});
