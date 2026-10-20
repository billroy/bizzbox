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

test('dungeon master deltas retain party labels and HP/MP maxima', () => {
  addActivity({ id: 'raid', type: 'dungeon_master', state: {
    boss: { name: 'PLAGUE LORD', hp_pct: 100 },
    party: [
      { name: 'Healbot9000', class: 'Cleric', hp: 1200, max_hp: 1200,
        mp: 500, max_mp: 500, dps: 70, alive: true, status_effects: [] },
      { name: 'TankMcTankface', class: 'Paladin', hp: 2200, max_hp: 2200,
        mp: 300, max_mp: 300, dps: 95, alive: true, status_effects: [] },
    ],
    combat_log: ['Raid begins'], boss_phase: 1, elapsed_sec: 0,
  } });

  for (const elapsed_sec of [1, 2]) {
    assert.equal(mergeActivityDelta('raid', {
      _delta: true,
      boss: { name: 'PLAGUE LORD', hp_pct: 100 - elapsed_sec },
      party: [
        { hp: 1200 - elapsed_sec * 10, mp: 500 - elapsed_sec,
          dps: 70 + elapsed_sec, alive: true, status_effects: ['Blessed'] },
        { hp: 2200 - elapsed_sec * 20, mp: 300 - elapsed_sec,
          dps: 95 + elapsed_sec, alive: true, status_effects: [] },
      ],
      combat_log: [`Tick ${elapsed_sec}`], boss_phase: 1, elapsed_sec,
    }), true);
  }

  const state = store.activities.raid.state;
  assert.deepEqual(state.party.map(({ name, class: role, max_hp, max_mp }) =>
    ({ name, role, max_hp, max_mp })), [
    { name: 'Healbot9000', role: 'Cleric', max_hp: 1200, max_mp: 500 },
    { name: 'TankMcTankface', role: 'Paladin', max_hp: 2200, max_mp: 300 },
  ]);
  assert.equal(state.party[0].hp, 1180);
  assert.equal(state.party[1].dps, 97);
  assert.deepEqual(state.party[0].status_effects, ['Blessed']);
  assert.equal(state.boss.hp_pct, 98);
  assert.deepEqual(state.combat_log, ['Tick 2']);
  assert.equal(state.elapsed_sec, 2);
});
