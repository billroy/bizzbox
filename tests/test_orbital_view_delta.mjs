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

test('orbital position deltas retain satellite labels and orbit types', () => {
  const initial = {
    strategy: 'gps_network', rotation: 0,
    satellites: [
      { x: 1, y: 0, z: 0, label: 'SAT-123', orbit_type: 'leo' },
      { x: 0, y: 1, z: 0, label: 'SAT-456', orbit_type: 'geo' },
    ],
  };
  addActivity({ id: 'orbit', type: 'orbital_view', state: structuredClone(initial) });

  for (const rotation of [0.1, 0.2]) {
    assert.equal(mergeActivityDelta('orbit', {
      _delta: true, rotation,
      satellites: [{ x: 0.8, y: 0.2, z: 0.1 }, { x: 0.1, y: 0.8, z: 0.2 }],
    }), true);
  }
  assert.deepEqual(store.activities.orbit.state, {
    strategy: 'gps_network', rotation: 0.2,
    satellites: [
      { x: 0.8, y: 0.2, z: 0.1, label: 'SAT-123', orbit_type: 'leo' },
      { x: 0.1, y: 0.8, z: 0.2, label: 'SAT-456', orbit_type: 'geo' },
    ],
  });

  updateActivity('orbit', structuredClone(initial));
  mergeActivityDelta('orbit', {
    _delta: true, rotation: 0.3,
    satellites: [{ x: 0.7, y: 0.3, z: 0.1 }, { x: 0.2, y: 0.7, z: 0.2 }],
  });
  assert.equal(store.activities.orbit.state.satellites[0].label, 'SAT-123');
  assert.equal(store.activities.orbit.state.satellites[1].orbit_type, 'geo');
});
