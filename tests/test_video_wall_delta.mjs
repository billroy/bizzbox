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

for (const type of ['camera_feed', 'cctv_mosaic']) {
  test(`${type} keeps camera labels through compact updates and keyframes`, () => {
    const initial = {
      strategy: 'building_lobby', grid_rows: 2, grid_cols: 2,
      cameras: [
        { label: 'LOBBY-1', scene_type: 'hallway', status: 'active', brightness: 0.7, noise_seed: 1 },
        { label: 'ELEVATOR-A', scene_type: 'elevator', status: 'active', brightness: 0.8, noise_seed: 2 },
      ],
    };
    addActivity({ id: type, type, state: structuredClone(initial) });

    for (const brightness of [0.6, 0.5]) {
      assert.equal(mergeActivityDelta(type, {
        _delta: true,
        cameras: [
          { status: 'active', brightness, noise_seed: 3 },
          { status: 'static', brightness: 0.8, noise_seed: 4 },
        ],
      }), true);
    }
    assert.equal(store.activities[type].state.cameras[0].label, 'LOBBY-1');
    assert.equal(store.activities[type].state.cameras[0].scene_type, 'hallway');
    assert.equal(store.activities[type].state.cameras[0].brightness, 0.5);
    assert.equal(store.activities[type].state.cameras[1].label, 'ELEVATOR-A');
    assert.equal(store.activities[type].state.cameras[1].status, 'static');

    updateActivity(type, structuredClone(initial));
    mergeActivityDelta(type, { _delta: true, cameras: [{ status: 'signal_lost' }] });
    assert.equal(store.activities[type].state.cameras[0].label, 'LOBBY-1');
    assert.equal(store.activities[type].state.cameras[1].label, 'ELEVATOR-A');
  });
}
