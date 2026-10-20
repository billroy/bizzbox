import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const events = [];
const store = {
  config: { style: 'first', intensity: 5 },
  ambientPreset: null,
  commandPaletteOpen: false,
  activityFilter: {},
};
const themes = ['first', 'middle', 'last'];
const presets = [
  { key: 'first', label: 'First' },
  { key: 'last', label: 'Last' },
];
const scenes = [{ name: 'First' }, { name: 'Middle' }, { name: 'Last' }];

globalThis.document = { body: { tagName: 'BODY' } };

const dependencies = {
  './store.js': {
    store, THEME_LIST: themes,
    savePrefs: () => {}, showToast: message => events.push(['toast', message]),
  },
  './socket.js': {
    sendStyle: style => events.push(['style', style]),
    sendScene: scene => events.push(['scene', scene.name]),
    sendIntensity: () => {}, sendMute: () => {}, sendRandomize: () => {},
    sendLayout: () => {}, sendChannelSwitch: () => {}, sendChannelCreate: () => {},
  },
  './audio.js': {
    AMBIENT_PRESET_LIST: presets,
    audio: {
      startAmbient: key => events.push(['ambient', key]),
      stopAmbient: () => events.push(['ambient', null]),
    },
  },
  './scenes.js': { SCENES: scenes },
  './activityTypes.js': { ACTIVITY_TYPES: [] },
  './slideshow.js': { toggleSlideshow: () => {} },
  './layout.js': { MAX_GRID_PRESET: { label: '10×7', cols: 10, rows: 7 } },
};

const path = fileURLToPath(new URL('../static/js/keyboard.js', import.meta.url));
const keyboard = new SourceTextModule(await readFile(path, 'utf8'), { identifier: path });
await keyboard.link(specifier => {
  const exports = dependencies[specifier];
  return new SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
  });
});
await keyboard.evaluate();
const { runShortcut } = keyboard.namespace;

test('Shift+T cycles backward and wraps to the last theme', () => {
  runShortcut('T');
  assert.deepEqual(events.filter(event => event[0] === 'style'), [['style', 'last']]);
  store.config.style = 'last';
  runShortcut('t');
  assert.deepEqual(events.filter(event => event[0] === 'style').at(-1), ['style', 'first']);
});

test('Shift+A cycles backward through presets and the off state', () => {
  runShortcut('A');
  assert.equal(store.ambientPreset, 'last');
  runShortcut('a');
  assert.equal(store.ambientPreset, null);
  store.ambientPreset = 'first';
  runShortcut('A');
  assert.equal(store.ambientPreset, null);
  assert.deepEqual(events.filter(event => event[0] === 'ambient'), [
    ['ambient', 'last'], ['ambient', null], ['ambient', null],
  ]);
});

test('Shift+S starts at the last scene and wraps back from the first', () => {
  runShortcut('S');
  runShortcut('s');
  runShortcut('S');
  assert.deepEqual(events.filter(event => event[0] === 'scene'), [
    ['scene', 'Last'], ['scene', 'First'], ['scene', 'Last'],
  ]);
});
