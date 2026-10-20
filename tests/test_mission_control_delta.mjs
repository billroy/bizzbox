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
const { addActivity, mergeActivityDelta, store } = entry.namespace;

test('launch status keeps station names through compact updates', () => {
  addActivity({ id: 'launch', type: 'mission_control', state: {
    vehicle: 'ATLAS-V', max_stages: 3,
    stations: [{ name: 'BOOSTER', status: 'GO' }, { name: 'RETRO', status: 'GO' }],
    t_minus: 10, counting: true, hold: false,
    telemetry: { altitude_km: 0 }, abort_mode: 'NOMINAL', events_log: [],
  } });

  for (const [status, time] of [['NO-GO', 9], ['GO', 8]]) {
    assert.equal(mergeActivityDelta('launch', {
      _delta: true, stations: [{ status }, { status: 'GO' }],
      t_minus: time, counting: true, hold: status === 'NO-GO',
      telemetry: { altitude_km: 0 }, abort_mode: 'NOMINAL', events_log: [],
    }), true);
  }

  const state = store.activities.launch.state;
  assert.deepEqual(state.stations, [
    { name: 'BOOSTER', status: 'GO' }, { name: 'RETRO', status: 'GO' },
  ]);
  assert.equal(state.t_minus, 8);
  assert.equal(state.vehicle, 'ATLAS-V');
  assert.equal(state.max_stages, 3);

  mergeActivityDelta('launch', { _delta: true, vehicle: 'FALCON-9',
    stations: [{ status: 'GO' }, { status: 'STANDBY' }] });
  assert.equal(state.vehicle, 'FALCON-9');
  assert.deepEqual(state.stations[1], { name: 'RETRO', status: 'STANDBY' });
});
