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

test('terraforming deltas retain zone names through updates and keyframes', () => {
  const initial = {
    gases: [{ name: 'O2', current_pct: 10, target_pct: 21 }],
    surface_temp: -30, target_temp: 20, ice_cap_pct: 70,
    seismic_level: 1, mirror_alignment: 90, progress_pct: 10,
    zones: [
      { name: 'ALPHA', temp: -32, status: 'processing' },
      { name: 'BETA', temp: -28, status: 'stable' },
    ],
  };
  addActivity({ id: 'planet', type: 'terraforming', state: structuredClone(initial) });

  for (const temp of [-31, -30]) {
    assert.equal(mergeActivityDelta('planet', {
      _delta: true,
      gases: [{ name: 'O2', current_pct: 11, target_pct: 21 }],
      surface_temp: temp, ice_cap_pct: 69, seismic_level: 1.2,
      mirror_alignment: 91, progress_pct: 11,
      zones: [{ temp, status: 'warning' }, { temp: temp + 4, status: 'stable' }],
    }), true);
  }

  const state = store.activities.planet.state;
  assert.deepEqual(state.zones, [
    { name: 'ALPHA', temp: -30, status: 'warning' },
    { name: 'BETA', temp: -26, status: 'stable' },
  ]);
  assert.equal(state.target_temp, 20);
  assert.equal(state.progress_pct, 11);

  updateActivity('planet', structuredClone(initial));
  mergeActivityDelta('planet', { _delta: true, zones: [{ temp: -29, status: 'offline' }] });
  assert.equal(store.activities.planet.state.zones[0].name, 'ALPHA');
  assert.equal(store.activities.planet.state.zones[1].name, 'BETA');
});
