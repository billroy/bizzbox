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

  // Configuration (synced from server)
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
  helpOverlay: false,
  headerPinned: false,
  ambientPreset: null,    // null = off, or one of AMBIENT_PRESET_LIST keys
  filterModalOpen: false,
  activityFilter: {},   // type → boolean, all true by default

  // Custom scenes (loaded from localStorage)
  customScenes: [],
});

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

  // Clear and reload
  store.activities = {};
  for (const act of activities) {
    addActivity(act);
  }

  applyStyle(session.style);
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
