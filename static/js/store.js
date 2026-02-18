/**
 * Reactive global store — single source of truth for client state.
 * Uses the globally-loaded Vue 3 (window.Vue) — no separate ESM import.
 */
import { computeGrid } from './layout.js';

// Use the global Vue loaded via <script src="vue.global.prod.js">
const { reactive } = Vue;

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
  },

  // Layout (fixed for session)
  grid: null,
  backgroundCount: 0,

  // Activities stored as plain reactive object keyed by id
  activities: {},
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

  store.backgroundCount = layout.background_count;
  store.grid = computeGrid(layout.background_count);

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
