/**
 * Socket.IO client wrapper.
 * Registers all inbound event handlers and provides outbound helpers.
 */
import { store, urlOverrides, initFromServer, addActivity, updateActivity, mergeActivityDelta, beginDespawn, applyStyle, moveActivity, resizeActivity, setLayout, savePrefs, loadPrefs, bringToFront, pinSlot, unpinSlot, showToast } from './store.js';
import { audio } from './audio.js';
import { applyScene } from './keyboard.js';
import { SCENES, loadCustomScenes, decodeSceneFromBase64 } from './scenes.js';
import { startSlideshow } from './slideshow.js';

let _socket = null;
let _urlOverridesApplied = false;
let _channelOverrideResolved = false;

/**
 * If a ?channel= URL override is set and hasn't been resolved yet,
 * search the current channel list for a case-insensitive match and switch.
 */
function tryResolveChannelOverride() {
  if (_channelOverrideResolved || !urlOverrides.channel) return;
  if (store.channels.length === 0) return;  // list not yet received

  const target = urlOverrides.channel.toLowerCase();
  const match = store.channels.find(c => c.name.toLowerCase() === target);
  if (match && match.id !== store.currentChannel) {
    _channelOverrideResolved = true;
    sendChannelSwitch(match.id);
  } else if (match) {
    _channelOverrideResolved = true;  // already there
  }
  // If no match found, leave unresolved — channel:list may arrive later
  // with more channels, or the name may simply not exist.
}

// Per-activity sound timers: activityId → timeout handle
const _soundTimers = {};

function scheduleActivitySound(id, type) {
  if (_soundTimers[id]) return;  // already scheduled
  const delay = 45000 + Math.random() * 30000;  // ~1/minute
  _soundTimers[id] = setTimeout(() => {
    audio.playActivitySound(type);
    delete _soundTimers[id];
    // Reschedule if still alive
    if (store.activities[id]) {
      scheduleActivitySound(id, type);
    }
  }, delay);
}

function clearActivitySound(id) {
  if (_soundTimers[id]) {
    clearTimeout(_soundTimers[id]);
    delete _soundTimers[id];
  }
}

export function initSocket() {
  _socket = io();

  _socket.on('connect', () => {
    store.connected = true;
    if (store.reconnecting) {
      store.reconnecting = false;
      store.reconnectAttempts = 0;
      showToast('RECONNECTED');
    }
    audio.unlock();
  });

  _socket.on('disconnect', () => {
    store.connected = false;
  });

  _socket.io.on('reconnect_attempt', (attempt) => {
    store.reconnecting = true;
    store.reconnectAttempts = attempt;
  });

  _socket.io.on('reconnect_failed', () => {
    store.reconnecting = false;
  });

  _socket.on('sync:init', (payload) => {
    // Save desired channel before initFromServer overwrites store.currentChannel
    const desiredChannel = store.currentChannel;

    // Clear any orphaned sound timers from a previous session before reinitialising
    Object.keys(_soundTimers).forEach(id => clearActivitySound(id));
    initFromServer(payload);
    // Schedule ambient sounds for existing activities
    for (const act of payload.activities) {
      scheduleActivitySound(act.id, act.type);
    }

    // Apply saved prefs + URL overrides once on first sync:init
    // Priority: URL params > localStorage > server defaults
    if (!_urlOverridesApplied) {
      _urlOverridesApplied = true;
      const saved = loadPrefs();

      // Apply localStorage prefs first (lower priority)
      if (saved) {
        if (!urlOverrides.style && saved.style)         sendStyle(saved.style);
        if (!urlOverrides.layout && saved.layout) {
          const sp = saved.layout.split('x').map(Number);
          if (sp.length === 2) sendLayout(sp[0], sp[1]);
        }
        if (!urlOverrides.intensity && saved.intensity)  sendIntensity(saved.intensity);
        if (urlOverrides.windows === undefined && saved.fgTarget !== undefined) sendFgTarget(saved.fgTarget);
        if (urlOverrides.muted === undefined && saved.muted !== undefined)      sendMute(saved.muted);
        if (saved.headerPinned) store.headerPinned = true;
        if (saved.volume !== undefined) {
          store.config.volume = saved.volume;
          audio.setVolume(saved.volume / 100);
        }
        if (saved.ambientPreset) {
          store.ambientPreset = saved.ambientPreset;
          audio.startAmbient(saved.ambientPreset, store.config.intensity);
        }
        if (saved.activityFilter && Object.keys(saved.activityFilter).length > 0) {
          store.activityFilter = saved.activityFilter;
          const allowed = Object.entries(saved.activityFilter)
            .filter(([_, v]) => v).map(([k]) => k);
          sendActivityFilter(allowed);
        }
      }

      // URL overrides win (higher priority)
      if (urlOverrides.style)     sendStyle(urlOverrides.style);
      if (urlOverrides.layout) {
        const parts = urlOverrides.layout.split('x').map(Number);
        if (parts.length === 2) sendLayout(parts[0], parts[1]);
      }
      if (urlOverrides.intensity) sendIntensity(urlOverrides.intensity);
      if (urlOverrides.windows !== undefined) sendFgTarget(urlOverrides.windows);
      if (urlOverrides.muted !== undefined) sendMute(urlOverrides.muted);
      if (urlOverrides.vol !== undefined) {
        const v = Math.max(0, Math.min(100, urlOverrides.vol));
        store.config.volume = v;
        audio.setVolume(v / 100);
        if (v === 0) sendMute(true);
      }

      // ?scene= overrides everything above — apply last
      if (urlOverrides.scene) {
        const target = urlOverrides.scene.toLowerCase().replace(/[-_]/g, ' ');
        const all = [...SCENES, ...loadCustomScenes()];
        const match = all.find(s => s.name.toLowerCase().replace(/[-_]/g, ' ') === target);
        if (match) {
          applyScene(match);
          showToast(`SCENE: ${match.name.toUpperCase()}`);
        }
      }

      // ?scene_data= decodes an inline base64-encoded scene and applies it
      if (urlOverrides.scene_data) {
        const decoded = decodeSceneFromBase64(urlOverrides.scene_data);
        if (decoded) {
          applyScene(decoded);
          showToast(`SCENE: ${(decoded.name || 'CUSTOM').toUpperCase()}`);
        }
      }

      // ?slideshow= starts auto-cycling scenes, ?slideshow_filter= limits to subset
      if (urlOverrides.slideshow > 0) {
        startSlideshow(urlOverrides.slideshow, urlOverrides.slideshow_filter || 'all');
      }
    }

    // Reconnection: if we were on a different channel, rejoin it
    const serverChannel = payload.channel ? payload.channel.id : 1;
    if (desiredChannel > 1 && desiredChannel !== serverChannel) {
      sendChannelSwitch(desiredChannel);
    }

    // Try to resolve ?channel= URL override (channel:list may already be available)
    tryResolveChannelOverride();
  });

  _socket.on('activity:spawn', (payload) => {
    addActivity(payload);
    audio.playSpawn();
    scheduleActivitySound(payload.id, payload.type);
  });

  _socket.on('activity:update', (data) => {
    if (data.state && data.state._delta) {
      // Delta update — merge into existing state
      mergeActivityDelta(data.id, data.state);
    } else {
      // Full state replacement (keyframe or non-delta activity)
      updateActivity(data.id, data.state);
    }
  });

  _socket.on('activity:despawn', (data) => {
    const act = store.activities[data.id];
    if (act) {
      audio.playDespawn();
      clearActivitySound(data.id);
      beginDespawn(data.id);
    }
  });

  _socket.on('configure:style', (data) => {
    applyStyle(data.style);
    savePrefs();
  });

  _socket.on('configure:intensity', (data) => {
    store.config.intensity = data.value;
    if (store.ambientPreset) audio.updateAmbientIntensity(data.value);
    savePrefs();
  });

  _socket.on('configure:fg_count', (data) => {
    store.config.fgTarget = data.value;
    savePrefs();
  });

  _socket.on('configure:mute', (data) => {
    store.config.muted = data.muted;
    audio.setMuted(data.muted);
    savePrefs();
  });

  _socket.on('client:connect', (data) => {
    store.clientCount = data.count;
  });

  // ── Channel events ─────────────────────────────────────────

  _socket.on('channel:list', (data) => {
    store.channels = data.channels;
    store.totalClients = data.totalClients;
    store.maxChannels = data.maxChannels;

    // Try to resolve ?channel= URL override now that we have the list
    tryResolveChannelOverride();
  });

  _socket.on('channel:switched', (data) => {
    store.currentChannel = data.channelId;
    store.currentChannelName = data.channelName;
    // sync:init will follow immediately with full state
  });

  _socket.on('channel:viewers', (data) => {
    const prev = store.channelViewers;
    const next = data.channelViewers;
    store.channelViewers = next;
    store.totalClients = data.totalClients;
    // Play join/leave sounds (skip the first update after connecting)
    if (prev != null && next !== prev) {
      if (next > prev) audio.playClientJoin();
      else             audio.playClientLeave();
    }
  });

  _socket.on('configure:layout', (data) => {
    setLayout(data.cols, data.rows);
    savePrefs();
  });

  _socket.on('window:resize', (data) => {
    resizeActivity(data.id, data.size, data.position);
  });

  _socket.on('window:move', (data) => {
    // Update window position from another client's drag (or echo of our own)
    moveActivity(data.id, data.position);
  });

  _socket.on('window:focus', (data) => {
    bringToFront(data.id);
  });

  _socket.on('window:pin', (data) => {
    pinSlot(data.slot, data.type);
  });

  _socket.on('window:unpin', (data) => {
    unpinSlot(data.slot);
  });

  return _socket;
}

// ── Outbound helpers ─────────────────────────────────────────

export function sendStyle(style) {
  if (_socket) _socket.emit('configure:style', { style });
}

export function sendIntensity(value) {
  if (_socket) _socket.emit('configure:intensity', { value });
}

export function sendMute(muted) {
  if (_socket) _socket.emit('configure:mute', { muted });
  // audio.setMuted() is applied via the server echo on 'configure:mute',
  // keeping mute state server-authoritative like style and intensity.
}

export function sendWindowMove(id, position) {
  if (_socket) _socket.emit('window:move', { id, position });
}

export function sendWindowResize(id, size, position) {
  if (_socket) _socket.emit('window:resize', { id, size, position });
}

export function sendWindowReplace(id, type) {
  if (_socket) _socket.emit('window:replace', { id, type });
}

export function sendWindowClose(id) {
  if (_socket) _socket.emit('window:close', { id });
}

export function sendWindowSpawn(type) {
  if (_socket) _socket.emit('window:spawn', { type });
}

export function sendRandomize() {
  if (_socket) _socket.emit('window:randomize');
}

export function sendFgTarget(value) {
  if (_socket) _socket.emit('configure:fg_count', { value });
}

export function sendLayout(cols, rows) {
  if (_socket) _socket.emit('configure:layout', { cols, rows });
}

export function sendActivityFilter(allowedTypes) {
  if (_socket) _socket.emit('configure:activity_filter', { allowed: allowedTypes });
}

export function sendWindowFocus(id) {
  if (_socket) _socket.emit('window:focus', { id });
}

export function sendPinSlot(slot, type) {
  if (_socket) _socket.emit('window:pin', { slot, type });
}

export function sendUnpinSlot(slot) {
  if (_socket) _socket.emit('window:unpin', { slot });
}

export function sendConfigureSlots(slots) {
  if (_socket) _socket.emit('configure:slots', { slots });
}

// ── Channel helpers ─────────────────────────────────────────

export function sendTextUpdate(id, text) {
  if (_socket) _socket.emit('text:update', { id, text });
}

export function sendChannelCreate() {
  if (_socket) _socket.emit('channel:create');
}

export function sendChannelSwitch(channelId) {
  if (_socket) _socket.emit('channel:switch', { channelId });
}
