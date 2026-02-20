/**
 * Reactive global store — single source of truth for client state.
 * Uses the globally-loaded Vue 3 (window.Vue) — no separate ESM import.
 */
import { computeGrid } from './layout.js';

// Use the global Vue loaded via <script src="vue.global.prod.js">
const { reactive } = Vue;

// ── URL query parameter overrides ────────────────────────────
function parseUrlOverrides() {
  const params = new URLSearchParams(window.location.search);
  const o = {};
  if (params.has('style'))     o.style = params.get('style');
  if (params.has('layout'))    o.layout = params.get('layout');
  if (params.has('intensity')) o.intensity = parseInt(params.get('intensity'), 10);
  if (params.has('windows'))   o.windows = parseInt(params.get('windows'), 10);
  if (params.has('muted'))     o.muted = params.get('muted') === '1';
  if (params.has('lock'))      o.lock = params.get('lock') === '1';
  if (params.has('channel'))   o.channel = params.get('channel');
  if (params.has('scene'))     o.scene = params.get('scene');
  if (params.has('kiosk'))     o.kiosk = params.get('kiosk') === '1';
  if (params.has('slideshow')) o.slideshow = parseInt(params.get('slideshow'), 10);
  return o;
}

export const urlOverrides = parseUrlOverrides();

// ── localStorage persistence ─────────────────────────────────
const PREFS_KEY = 'bizzbox_prefs';

export function savePrefs() {
  try {
    const p = {
      style: store.config.style,
      layout: store.grid ? `${store.grid.cols}x${store.grid.rows}` : null,
      intensity: store.config.intensity,
      muted: store.config.muted,
      ambientPreset: store.ambientPreset,
      activityFilter: store.activityFilter,
      fgTarget: store.config.fgTarget,
      headerPinned: store.headerPinned,
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch (_) { /* storage full or unavailable */ }
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

export function clearPrefs() {
  try {
    localStorage.removeItem(PREFS_KEY);
    localStorage.removeItem('bizzbox_custom_scenes');
  } catch (_) { /* ignore */ }
}

export const store = reactive({
  // Connection
  connected: false,
  clientCount: 0,

  // Channels
  currentChannel: 1,
  currentChannelName: 'Channel 1',
  channels: [],             // [{id, name, viewers}, ...]
  channelViewers: 0,
  totalClients: 0,
  maxChannels: 10,

  // Configuration (synced from server, per-channel)
  config: {
    style: 'dark',
    intensity: 5,
    muted: false,
    syncMode: 'synced',
    fgTarget: 5,
  },

  // Layout (fixed for session)
  grid: null,
  backgroundCount: 0,

  // Activities stored as plain reactive object keyed by id
  activities: {},

  // UI state
  lockMode: false,
  kioskMode: false,
  slideshowActive: false,
  slideshowInterval: 60,
  helpOverlay: false,
  headerPinned: false,
  ambientPreset: null,    // null = off, or one of AMBIENT_PRESET_LIST keys
  filterModalOpen: false,
  activityFilter: {},   // type → boolean, all true by default

  // Custom scenes (loaded from localStorage)
  customScenes: [],

  // Z-ordering for foreground windows
  _nextZIndex: 100,

  // Pinned background slots: slot index → activity type string
  pinnedSlots: {},

  // Reconnection state
  reconnecting: false,
  reconnectAttempts: 0,

  // Toast notification
  toastMessage: null,
});

// ── Theme list for cycling ──────────────────────────────────
export const THEME_LIST = [
  'dark', 'light', 'brutalist', 'neon', 'rainbow',
  'sunshine', 'red', 'black', 'lcars', 'amber', 'arctic',
  'synthwave', 'military', 'ocean', 'forest', 'copper',
  'vapor', 'infrared', 'phosphor', 'blueprint', 'sunset',
  'matrix', 'frost',
];

// ── Toast helper ────────────────────────────────────────────
let _toastTimer = null;
export function showToast(msg, durationMs = 1500) {
  if (store.kioskMode) return;  // suppress toasts in kiosk mode
  if (_toastTimer) clearTimeout(_toastTimer);
  store.toastMessage = msg;
  _toastTimer = setTimeout(() => {
    store.toastMessage = null;
    _toastTimer = null;
  }, durationMs);
}

// Computed helpers (plain functions — called in templates/setup)
export function getBackgroundSlots() {
  if (!store.grid) return [];
  return store.grid.slots.map(slot => {
    if (!slot.active) return { slot, activity: null };
    const activity = Object.values(store.activities).find(
      a => !a.is_foreground && a.slot === slot.index && !a.despawning
    ) || null;
    return { slot, activity };
  });
}

export function getForegroundActivities() {
  return Object.values(store.activities).filter(a => a.is_foreground);
}

export function initFromServer(payload) {
  const { session, layout, activities } = payload;

  store.config.style    = session.style;
  store.config.intensity = session.intensity;
  store.config.muted    = session.muted;
  store.config.syncMode = session.sync_mode;

  store.config.fgTarget = layout.fg_target ?? 5;
  store.backgroundCount = layout.background_count;
  store.grid = computeGrid(layout.grid_cols || 3, layout.grid_rows || 2);

  // Channel metadata (present in synced mode)
  if (payload.channel) {
    store.currentChannel = payload.channel.id;
    store.currentChannelName = payload.channel.name;
  }

  // Clear and reload
  store.activities = {};
  for (const act of activities) {
    addActivity(act);
  }

  // Sync pinned slots from server
  if (payload.pinned_slots) {
    store.pinnedSlots = {};
    for (const [k, v] of Object.entries(payload.pinned_slots)) {
      store.pinnedSlots[parseInt(k, 10)] = v;
    }
  }

  applyStyle(session.style);
}

export function bringToFront(id) {
  const act = store.activities[id];
  if (act && act.is_foreground) {
    store._nextZIndex++;
    act.zIndex = store._nextZIndex;
  }
  return store._nextZIndex;
}

export function pinSlot(slotIndex, type) {
  store.pinnedSlots[slotIndex] = type;
}

export function unpinSlot(slotIndex) {
  delete store.pinnedSlots[slotIndex];
}

export function addActivity(payload) {
  store.activities[payload.id] = {
    id:            payload.id,
    type:          payload.type,
    title:         payload.title,
    slot:          payload.slot,
    is_foreground: payload.is_foreground,
    position:      payload.position,
    size:          payload.size,
    strategy:      payload.strategy,
    state:         payload.state,
    zIndex:        payload.is_foreground ? ++store._nextZIndex : 0,
    despawning:    false,
    spawning:      true,
  };
  setTimeout(() => {
    if (store.activities[payload.id]) {
      store.activities[payload.id].spawning = false;
    }
  }, 600);
}

export function updateActivity(id, state) {
  if (store.activities[id]) {
    store.activities[id].state = state;
  }
}

export function mergeActivityDelta(id, delta) {
  const act = store.activities[id];
  if (!act || !act.state) return false;
  const s = act.state;
  const type = act.type;

  if (type === 'game_of_life') {
    // Apply born/died to existing cell set
    const cols = s.cols || 80;
    const cellSet = new Set((s.cells || []).map(c => c[0] * cols + c[1]));
    for (const [r, c] of (delta.died || [])) cellSet.delete(r * cols + c);
    for (const [r, c] of (delta.born || [])) cellSet.add(r * cols + c);
    s.cells = Array.from(cellSet).map(k => [Math.floor(k / cols), k % cols]);
    if (delta.generation !== undefined) s.generation = delta.generation;
    if (delta.population !== undefined) s.population = delta.population;

  } else if (type === 'seismograph') {
    // Append new samples, shift old ones left
    const appends = delta.append || [];
    const channels = s.channels || [];
    for (let i = 0; i < channels.length && i < appends.length; i++) {
      const ch = channels[i];
      const newSamples = appends[i];
      if (ch.samples && newSamples && newSamples.length > 0) {
        ch.samples = ch.samples.slice(newSamples.length).concat(newSamples);
      }
    }
    if (delta.magnitude !== undefined) s.magnitude = delta.magnitude;
    if (delta.depth_km !== undefined) s.depth_km = delta.depth_km;
    if (delta.peak !== undefined) s.peak = delta.peak;

  } else if (type === 'data_table') {
    // Prepend new rows, then apply changed cells
    const n = delta.new_rows_count || 0;
    if (n > 0 && delta.new_rows && s.rows) {
      const maxRows = s.rows.length;
      s.rows = [...delta.new_rows, ...s.rows].slice(0, maxRows);
    }
    for (const [ri, ci, val] of (delta.changed_cells || [])) {
      if (s.rows && s.rows[ri]) s.rows[ri][ci] = val;
    }

  } else {
    // Generic shallow merge for any future opt-in activity
    for (const [k, v] of Object.entries(delta)) {
      if (k !== '_delta') s[k] = v;
    }
  }

  return true;
}

export function beginDespawn(id) {
  if (store.activities[id]) {
    store.activities[id].despawning = true;
    setTimeout(() => {
      delete store.activities[id];
    }, 600);
  }
}

export function applyStyle(style) {
  document.documentElement.dataset.theme = style;
  store.config.style = style;
}

export function setLayout(cols, rows) {
  store.backgroundCount = cols * rows;
  store.grid = computeGrid(cols, rows);
}

export function resizeActivity(id, size, position) {
  const act = store.activities[id];
  if (act && act.is_foreground) {
    if (act.size) {
      act.size.w = size.w;
      act.size.h = size.h;
    } else {
      act.size = size;
    }
    if (act.position) {
      act.position.x = position.x;
      act.position.y = position.y;
    } else {
      act.position = position;
    }
  }
}

export function moveActivity(id, position) {
  const act = store.activities[id];
  if (act && act.is_foreground) {
    // Mutate x/y in-place on the existing reactive object rather than replacing
    // the whole position reference — ensures Vue's proxy sees the change on all
    // browsers including Safari, which may not observe object-reference swaps
    // on nested reactive properties as reliably.
    if (act.position) {
      act.position.x = position.x;
      act.position.y = position.y;
    } else {
      act.position = position;
    }
  }
}
