import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SourceTextModule } from 'node:vm';

const loadModule = async (relativePath) => {
  const path = fileURLToPath(new URL(relativePath, import.meta.url));
  return new SourceTextModule(await readFile(path, 'utf8'), { identifier: path });
};

const activityTypesModule = await loadModule('../static/js/activityTypes.js');
await activityTypesModule.link(() => { throw new Error('unexpected activity types import'); });
await activityTypesModule.evaluate();

const layoutModule = await loadModule('../static/js/layout.js');
await layoutModule.link(() => { throw new Error('unexpected layout import'); });
await layoutModule.evaluate();

const scenesModule = await loadModule('../static/js/scenes.js');
await scenesModule.link(specifier => {
  if (specifier === './activityTypes.js') return activityTypesModule;
  if (specifier === './layout.js') return layoutModule;
  throw new Error(`unexpected scenes import: ${specifier}`);
});
await scenesModule.evaluate();

test('Heart Monitor is absent from the activity picker and built-in scenes', () => {
  const { ACTIVITY_TYPES, ACTIVITY_CATEGORIES } = activityTypesModule.namespace;
  const { SCENES } = scenesModule.namespace;

  assert.ok(!ACTIVITY_TYPES.includes('heart_monitor'));
  for (const types of Object.values(ACTIVITY_CATEGORIES)) {
    assert.ok(!types.includes('heart_monitor'));
  }
  for (const scene of SCENES) {
    assert.ok(!scene.filter?.includes('heart_monitor'));
    assert.ok(!scene.slots?.includes('heart_monitor'));
  }
});
