import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceTextModule } from 'node:vm';

globalThis.Vue = { reactive: value => value };
globalThis.window = { location: { search: '' } };

// The browser loads these .js files as ES modules without a package.json.
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
const { addActivity, mergeActivityDelta, store } = entry.namespace;

test('server rack deltas keep the fields needed to draw each unit', () => {
  addActivity({
    id: 'rack', type: 'server_rack', state: {
      rack_label: 'RACK-1', strategy: 'edge_node', total_load: 20,
      units: [{ name: 'EDGE-N1', role: 'compute', size_u: 2,
        status: 'online', cpu_load: 20, leds: [{ color: 'green', blink: false }], fan_speed: 18 }],
    },
  });

  mergeActivityDelta('rack', { _delta: true, total_load: 45,
    units: [{ status: 'degraded', cpu_load: 45,
      leds: [{ color: 'amber', blink: true }], fan_speed: 38 }] });

  assert.deepEqual(store.activities.rack.state.units[0], {
    name: 'EDGE-N1', role: 'compute', size_u: 2,
    status: 'degraded', cpu_load: 45,
    leds: [{ color: 'amber', blink: true }], fan_speed: 38,
  });
  assert.equal(store.activities.rack.state.rack_label, 'RACK-1');
  assert.equal(store.activities.rack.state.total_load, 45);
});

test('rack status topology deltas keep component labels', () => {
  addActivity({
    id: 'topology', type: 'system_topology', state: {
      strategy: 'data_center_rack',
      components: [{ name: 'SWITCH-1', category: 'network',
        status: 'ok', load: 0.2, lights: ['green'], data_flow: 0.1 }],
    },
  });

  mergeActivityDelta('topology', { _delta: true,
    components: [{ status: 'warn', load: 0.7, lights: ['amber'], data_flow: 0.5 }] });

  assert.deepEqual(store.activities.topology.state.components[0], {
    name: 'SWITCH-1', category: 'network',
    status: 'warn', load: 0.7, lights: ['amber'], data_flow: 0.5,
  });
  assert.equal(store.activities.topology.state.strategy, 'data_center_rack');
});
