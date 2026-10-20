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
  const chartPaths = [];
  let clears = 0;
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
      if (key === 'clearRect') return () => { clears++; };
      if (key === 'beginPath') return () => { target.path = []; };
      if (key === 'moveTo' || key === 'lineTo') return (x, y) => { target.path.push([x, y]); };
      if (key === 'stroke') return () => {
        if (target.strokeStyle === '#00cc44' && target.lineWidth === 2) {
          chartPaths.push([...target.path]);
        }
      };
      return () => {};
    },
    set: (target, key, value) => Reflect.set(target, key, value),
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
  const drawnFrameCount = clears;
  activity.state = { nodes: [{ status: 'fault' }], edges: [] }; // Incomplete update.
  runFrame();
  assert.equal(clears, drawnFrameCount, 'incomplete state must not erase the last frame');
  activity.state = {
    nodes: [{ id: 'n0', type: 'generator', label: 'GEN-1', x: 0.5, y: 0.5, status: 'online' }],
    edges: [],
    readings: {},
  };
  runFrame();
  assert.equal(clears, drawnFrameCount + 1, 'drawing resumes when complete state arrives');
  activity.state.readings = { voltage_v: 220, frequency_hz: 60.02, load_pct: 52, battery_temp_c: 31 };
  runFrame();
  assert.ok(draws.includes('VOLTAGE TREND'));
  assert.ok(draws.includes('220.0 V'));
  assert.ok(draws.includes('FREQUENCY 60.0 Hz'));
  assert.ok(draws.includes('LOAD 52%'));
  assert.ok(!draws.some(text => String(text).includes('BATTERY TEMP')));
  assert.equal(chartPaths.at(-1).length, 2);
  assert.equal(chartPaths.at(-1)[0][1], chartPaths.at(-1)[1][1]);
  activity.state = {
    ...activity.state,
    nodes: activity.state.nodes.map(node => ({ ...node })),
    readings: { voltage_v: 218, frequency_hz: 59.98, load_pct: 53 },
  };
  runFrame();
  assert.ok(draws.includes('218.0 V'));
  assert.equal(chartPaths.at(-1).length, 2, 'full frames retain the prior voltage sample');
  assert.notEqual(chartPaths.at(-1)[0][1], chartPaths.at(-1)[1][1]);
  unmounted();
  assert.equal(frames.size, 0);
});
