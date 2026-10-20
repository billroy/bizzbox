import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceTextModule } from 'node:vm';

globalThis.Vue = { reactive: value => value };
globalThis.window = { location: { search: '' } };

const modules = new Map();
async function loadModule(path) {
  if (!modules.has(path)) {
    modules.set(path, new SourceTextModule(await readFile(path, 'utf8'), { identifier: path }));
  }
  return modules.get(path);
}
const entry = await loadModule(fileURLToPath(new URL('../static/js/store.js', import.meta.url)));
await entry.link((specifier, parent) => loadModule(resolve(dirname(parent.identifier), specifier)));
await entry.evaluate();
const { addActivity, mergeActivityDelta, store, updateActivity } = entry.namespace;

test('power grid deltas preserve the schematic between full keyframes', () => {
  const initialState = {
    nodes: [
      { id: 'n0', type: 'generator', label: 'GEN-1', x: 0.1, y: 0.5, status: 'online' },
      { id: 'n1', type: 'load', label: 'LD-1', x: 0.9, y: 0.5, status: 'online' },
    ],
    edges: [{ from_id: 'n0', to_id: 'n1', flow: 20 }],
    readings: { voltage_v: 220 },
    flow_offset: 0,
  };
  addActivity({ id: 'grid', type: 'power_grid', state: structuredClone(initialState) });

  mergeActivityDelta('grid', {
    _delta: true,
    nodes: [{ status: 'fault' }, { status: 'online' }],
    edges: [{ flow: 25 }],
    readings: { voltage_v: 218 },
    flow_offset: 0.5,
  });

  assert.deepEqual(store.activities.grid.state, {
    nodes: [
      { ...initialState.nodes[0], status: 'fault' },
      initialState.nodes[1],
    ],
    edges: [{ from_id: 'n0', to_id: 'n1', flow: 25 }],
    readings: { voltage_v: 218 },
    flow_offset: 0.5,
  });

  updateActivity('grid', structuredClone(initialState));
  mergeActivityDelta('grid', {
    _delta: true,
    nodes: [{ status: 'online' }, { status: 'fault' }],
    edges: [{ flow: 30 }],
    readings: { voltage_v: 221 },
    flow_offset: 1,
  });
  assert.equal(store.activities.grid.state.nodes[1].id, 'n1');
  assert.equal(store.activities.grid.state.edges[0].to_id, 'n1');
  assert.equal(store.activities.grid.state.edges[0].flow, 30);
});
