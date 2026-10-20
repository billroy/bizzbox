import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const activityTypesModule = new SyntheticModule(['ACTIVITY_TYPES'], function () {
  this.setExport('ACTIVITY_TYPES', ['pong', 'radar']);
});

const layoutPath = fileURLToPath(new URL('../static/js/layout.js', import.meta.url));
const layoutModule = new SourceTextModule(await readFile(layoutPath, 'utf8'), { identifier: layoutPath });
await layoutModule.link(() => { throw new Error('unexpected layout import'); });
await layoutModule.evaluate();

const path = fileURLToPath(new URL('../static/js/scenes.js', import.meta.url));
const scenesModule = new SourceTextModule(await readFile(path, 'utf8'), { identifier: path });
await scenesModule.link(specifier => {
  if (specifier === './activityTypes.js') return activityTypesModule;
  if (specifier === './layout.js') return layoutModule;
  throw new Error(`unexpected scenes import: ${specifier}`);
});
await scenesModule.evaluate();

test('Pong World uses the maximum selectable grid and only Pong activities', () => {
  const scene = scenesModule.namespace.SCENES.find(candidate => candidate.name === 'Pong World');
  const maxGridPreset = layoutModule.namespace.MAX_GRID_PRESET;

  assert.ok(scene);
  assert.equal(maxGridPreset.label, '10×7');
  assert.equal(scene.cols, maxGridPreset.cols);
  assert.equal(scene.rows, maxGridPreset.rows);
  assert.deepEqual([...scene.filter], ['pong']);
  assert.equal(scene.fgTarget, 0);
});
