import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const store = {
  currentChannel: 2,
  slideshowActive: false,
  slideshowInterval: 60,
  slideshowNextTransitionAt: null,
  slideshowRevision: -1,
  slideshowPhase: 'idle',
  slideshowFilter: 'all',
  ambientPreset: null,
};
const bodyClasses = new Set();
const commands = [];
const audioCalls = [];
let now = 1_000_000;

globalThis.document = {
  body: {
    classList: {
      add: value => bodyClasses.add(value),
      remove: value => bodyClasses.delete(value),
    },
  },
};
Date.now = () => now;

function syntheticModule(exports) {
  return new SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
  });
}

const dependencies = {
  './store.js': { store, showToast: () => {} },
  './scenes.js': {
    SCENES: [
      { name: 'One', style: 'dark', cols: 2, rows: 2, intensity: 5 },
      { name: 'Two', style: 'neon', cols: 3, rows: 2, intensity: 8, ambientPreset: 'hum' },
    ],
    loadCustomScenes: () => [],
  },
  './audio.js': {
    audio: {
      startAmbient: (...args) => audioCalls.push(['start', ...args]),
      stopAmbient: () => audioCalls.push(['stop']),
    },
  },
};

const path = fileURLToPath(new URL('../static/js/slideshow.js', import.meta.url));
const slideshow = new SourceTextModule(await readFile(path, 'utf8'), { identifier: path });
await slideshow.link(specifier => syntheticModule(dependencies[specifier]));
await slideshow.evaluate();

slideshow.namespace.setSlideshowTransport({
  start: payload => commands.push(['start', payload]),
  schedule: seconds => commands.push(['schedule', seconds]),
  stop: () => commands.push(['stop']),
});

test('starting presentation sends the complete playlist without starting a local timer', () => {
  assert.equal(slideshow.namespace.startSlideshow(60), true);
  assert.equal(commands[0][0], 'start');
  assert.equal(commands[0][1].intervalSeconds, 60);
  assert.deepEqual(commands[0][1].scenes.map(scene => scene.name), ['One', 'Two']);
  assert.equal(store.slideshowActive, false);
});

test('authoritative state drives countdown, transition class, and interval controls', () => {
  const applied = slideshow.namespace.applyPresentationState({
    channelId: 2,
    active: true,
    intervalSeconds: 60,
    nextTransitionAt: 1_060_250,
    currentIndex: 1,
    currentScene: { name: 'Two', ambientPreset: 'hum', intensity: 8 },
    revision: 4,
    phase: 'blackout',
    filter: 'all',
    serverTime: 1_000_250,
  });

  assert.equal(applied, true);
  assert.equal(store.slideshowActive, true);
  assert.equal(store.slideshowNextTransitionAt, 1_060_000);
  assert.equal(bodyClasses.has('slideshow-transition'), true);
  assert.deepEqual(audioCalls.at(-1), ['start', 'hum', 8]);

  assert.equal(slideshow.namespace.setNextTransition(15), true);
  assert.deepEqual(commands.at(-1), ['schedule', 15]);
});

test('older or other-channel state cannot overwrite the active channel', () => {
  assert.equal(slideshow.namespace.applyPresentationState({
    channelId: 2, active: false, revision: 3, serverTime: now,
  }), false);
  assert.equal(slideshow.namespace.applyPresentationState({
    channelId: 1, active: false, revision: 99, serverTime: now,
  }), false);
  assert.equal(store.slideshowActive, true);
});

test('server stop clears countdown and transition state before a client emits stop', () => {
  assert.equal(slideshow.namespace.stopSlideshow(), true);
  assert.deepEqual(commands.at(-1), ['stop']);

  slideshow.namespace.applyPresentationState({
    channelId: 2,
    active: false,
    intervalSeconds: 15,
    nextTransitionAt: null,
    revision: 5,
    phase: 'idle',
    serverTime: now,
  });
  assert.equal(store.slideshowActive, false);
  assert.equal(store.slideshowNextTransitionAt, null);
  assert.equal(bodyClasses.has('slideshow-transition'), false);
});
