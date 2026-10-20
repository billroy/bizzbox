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

test('mech bay deltas retain the section geometry and weapon labels', () => {
  addActivity({
    id: 'bay', type: 'mech_bay', state: {
      mech_name: 'ATLAS',
      sections: [
        { id: 'head', label: 'HEAD', y_frac: 0.05, armor_pct: 90, internal_pct: 100, servo_status: 'nominal' },
        { id: 'torso_ct', label: 'CENTER TORSO', y_frac: 0.2, armor_pct: 80, internal_pct: 100, servo_status: 'nominal' },
      ],
      weapons: [
        { name: 'AC/20', mount: 'arm_la', status: 'ready', ammo_pct: 65 },
        { name: 'PPC', mount: 'arm_ra', status: 'ready', ammo_pct: null },
      ],
      coolant_pct: 90, neural_link_pct: 95, heat_pct: 20, reactor_output_pct: 85,
    },
  });

  for (const armor of [75, 60]) {
    assert.equal(mergeActivityDelta('bay', {
      _delta: true,
      sections: [
        { armor_pct: armor, internal_pct: 98, servo_status: 'degraded' },
        { armor_pct: armor - 10, internal_pct: 100, servo_status: 'nominal' },
      ],
      weapons: [
        { status: 'cycling', ammo_pct: 40 },
        { status: 'offline', ammo_pct: null },
      ],
      coolant_pct: 80, neural_link_pct: 92, heat_pct: 30, reactor_output_pct: 82,
    }), true);
  }

  const state = store.activities.bay.state;
  assert.equal(state.mech_name, 'ATLAS');
  assert.deepEqual(state.sections[0], {
    id: 'head', label: 'HEAD', y_frac: 0.05,
    armor_pct: 60, internal_pct: 98, servo_status: 'degraded',
  });
  assert.equal(state.sections[1].id, 'torso_ct');
  assert.deepEqual(state.weapons[0], {
    name: 'AC/20', mount: 'arm_la', status: 'cycling', ammo_pct: 40,
  });
  assert.equal(state.weapons[1].name, 'PPC');
  assert.equal(state.heat_pct, 30);
});
