import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const events = [];
const store = {
  config: { style: 'first', intensity: 5 },
  grid: { cols: 3, rows: 2 },
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
    sendIntensity: intensity => events.push(['intensity', intensity]),
    sendMute: () => {}, sendRandomize: () => {},
    sendLayout: (cols, rows) => {
      events.push(['layout', cols, rows]);
      store.grid = { cols, rows }; // Simulate the server echo.
    },
    sendChannelSwitch: () => {}, sendChannelCreate: () => {},
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
  './layout.js': {
    GRID_PRESETS: [
      { label: '2×1', cols: 2, rows: 1 },
      { label: '3×2', cols: 3, rows: 2 },
      { label: '4×2', cols: 4, rows: 2 },
    ],
    MAX_GRID_PRESET: { label: '4×2', cols: 4, rows: 2 },
  },
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

test('+ and - step through layout dropdown selections and stop at the ends', () => {
  runShortcut('+');
  runShortcut('+');
  runShortcut('-');
  runShortcut('-');
  runShortcut('-');
  assert.deepEqual(events.filter(event => event[0] === 'layout'), [
    ['layout', 4, 2], ['layout', 3, 2], ['layout', 2, 1],
  ]);
  assert.deepEqual(events.filter(event => event[0] === 'intensity'), []);
});

test('a custom layout enters the preset list in the requested direction', () => {
  store.grid = { cols: 1, rows: 1 };
  const start = events.length;
  runShortcut('+');
  store.grid = { cols: 1, rows: 1 };
  runShortcut('-');
  assert.deepEqual(events.slice(start).filter(event => event[0] === 'layout'), [
    ['layout', 2, 1], ['layout', 4, 2],
  ]);
});

test('= and _ continue to adjust intensity', () => {
  runShortcut('=');
  runShortcut('_');
  assert.deepEqual(events.filter(event => event[0] === 'intensity'), [
    ['intensity', 6], ['intensity', 4],
  ]);
});
