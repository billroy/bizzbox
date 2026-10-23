import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const store = {
  slideshowActive: false,
  slideshowInterval: 60,
  slideshowNextTransitionAt: null,
};
const appliedScenes = [];
const bodyClasses = new Set();
const timers = new Map();
let now = 1_000_000;
let nextTimerId = 1;

globalThis.document = {
  body: {
    classList: {
      add: value => bodyClasses.add(value),
      remove: value => bodyClasses.delete(value),
    },
  },
};
globalThis.setTimeout = (callback, delay) => {
  const id = nextTimerId++;
  timers.set(id, { callback, delay });
  return id;
};
globalThis.clearTimeout = id => timers.delete(id);
Date.now = () => now;

function syntheticModule(exports) {
  return new SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
  });
}

const dependencies = {
  './store.js': { store, showToast: () => {} },
  './keyboard.js': { applyScene: scene => appliedScenes.push(scene.name) },
  './scenes.js': {
    SCENES: [{ name: 'One' }, { name: 'Two' }],
    loadCustomScenes: () => [],
  },
};

const path = fileURLToPath(new URL('../static/js/slideshow.js', import.meta.url));
const slideshow = new SourceTextModule(await readFile(path, 'utf8'), { identifier: path });
await slideshow.link(specifier => syntheticModule(dependencies[specifier]));
await slideshow.evaluate();

test('presentation timer exposes and resets the next transition deadline', () => {
  slideshow.namespace.startSlideshow(60);
  assert.equal(store.slideshowActive, true);
  assert.equal(store.slideshowNextTransitionAt, now + 60_000);
  assert.equal(appliedScenes.length, 1);

  slideshow.namespace.setNextTransition(15);
  assert.equal(store.slideshowInterval, 15);
  assert.equal(store.slideshowNextTransitionAt, now + 15_000);
  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0].delay, 15_000);
});

test('the scheduled transition advances the scene and schedules the next deadline', () => {
  now += 15_000;
  const transition = [...timers.values()][0];
  timers.delete([...timers.keys()][0]);
  transition.callback();

  assert.equal(bodyClasses.has('slideshow-transition'), true);
  assert.equal(store.slideshowNextTransitionAt, now + 15_000);

  const blackoutTimer = [...timers.entries()].find(([, timer]) => timer.delay === 300);
  timers.delete(blackoutTimer[0]);
  blackoutTimer[1].callback();
  assert.equal(appliedScenes.length, 2);
});

test('stopping clears the countdown and all pending timers', () => {
  slideshow.namespace.stopSlideshow();
  assert.equal(store.slideshowActive, false);
  assert.equal(store.slideshowNextTransitionAt, null);
  assert.equal(timers.size, 0);
  assert.equal(bodyClasses.has('slideshow-transition'), false);
});
