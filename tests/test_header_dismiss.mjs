import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SourceTextModule, SyntheticModule } from 'node:vm';

const listeners = new Map();
const mounted = [];
const unmounted = [];
const timers = new Map();
let nextTimerId = 1;

globalThis.document = {
  addEventListener(type, listener, options) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push({ listener, options });
  },
  removeEventListener() {},
  fullscreenElement: null,
};
globalThis.window = {};
globalThis.location = { reload() {} };
globalThis.setTimeout = (callback, delay) => {
  const id = nextTimerId++;
  timers.set(id, { callback, delay });
  return id;
};
globalThis.clearTimeout = id => timers.delete(id);
globalThis.setInterval = () => 1;
globalThis.clearInterval = () => {};
globalThis.Vue = {
  ref: value => ({ value }),
  computed: value => typeof value === 'function'
    ? { get value() { return value(); } }
    : { get value() { return value.get(); }, set value(next) { value.set(next); } },
  onMounted: callback => mounted.push(callback),
  onUnmounted: callback => unmounted.push(callback),
};

const store = {
  lockMode: false,
  headerPinned: false,
  customScenes: [],
  config: { style: 'dark', intensity: 5, muted: false, fgTarget: 0, volume: 100 },
  grid: { cols: 3, rows: 2 },
  channels: [],
  activityFilter: {},
};

function syntheticModule(exports) {
  return new SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
  });
}

const noop = () => {};
const dependencies = {
  '../store.js': { store, savePrefs: noop, clearPrefs: noop, showToast: noop },
  '../socket.js': {
    sendStyle: noop, sendIntensity: noop, sendMute: noop, sendLayout: noop,
    sendFgTarget: noop, sendRandomize: noop, sendActivityFilter: noop,
    sendChannelCreate: noop, sendChannelSwitch: noop,
  },
  '../layout.js': { GRID_PRESETS: [] },
  '../activityTypes.js': { ACTIVITY_TYPES: [], ACTIVITY_CATEGORIES: {} },
  '../scenes.js': {
    SCENES: [], loadCustomScenes: () => [], saveCustomScene: noop,
    deleteCustomScene: noop, exportScenes: () => '[]', importScenes: () => [],
    encodeSceneToBase64: () => '',
  },
  '../audio.js': { audio: { setVolume: noop }, AMBIENT_PRESET_LIST: [] },
  '../configUrl.js': { copyConfigUrl: async () => {} },
  '../keyboard.js': { applyScene: noop },
  '../slideshow.js': { stopSlideshow: noop, setNextTransition: noop },
};

const path = fileURLToPath(new URL('../static/js/components/AppHeader.js', import.meta.url));
const module = new SourceTextModule(await readFile(path, 'utf8'), { identifier: path });
await module.link(specifier => syntheticModule(dependencies[specifier]));
await module.evaluate();

const component = module.namespace.default;
const state = component.setup();
for (const callback of mounted) callback();

test('Escape dismisses the visible header through a capture listener', () => {
  const mousemove = listeners.get('mousemove')[0].listener;
  mousemove({ clientY: 0 });
  assert.equal(state.visible.value, true);

  const keydown = listeners.get('keydown')[0];
  assert.equal(keydown.options, true);
  keydown.listener({ key: 'Escape', target: { tagName: 'INPUT' } });

  assert.equal(state.visible.value, false);
  assert.equal(state.dismissing.value, true);
  assert.ok([...timers.values()].some(timer => timer.delay === 100));
});

test('other keys leave the visible header alone', () => {
  const mousemove = listeners.get('mousemove')[0].listener;
  mousemove({ clientY: 0 });
  listeners.get('keydown')[0].listener({ key: 'Enter' });
  assert.equal(state.visible.value, true);
});
