/**
 * Socket.IO client wrapper.
 * Registers all inbound event handlers and provides outbound helpers.
 */
import { store, initFromServer, addActivity, updateActivity, beginDespawn, applyStyle, moveActivity, resizeActivity, setLayout } from './store.js';
import { audio } from './audio.js';

let _socket = null;

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
    audio.unlock();
  });

  _socket.on('disconnect', () => {
    store.connected = false;
  });

  _socket.on('sync:init', (payload) => {
    // Clear any orphaned sound timers from a previous session before reinitialising
    Object.keys(_soundTimers).forEach(id => clearActivitySound(id));
    initFromServer(payload);
    // Schedule ambient sounds for existing activities
    for (const act of payload.activities) {
      scheduleActivitySound(act.id, act.type);
    }
  });

  _socket.on('activity:spawn', (payload) => {
    addActivity(payload);
    audio.playSpawn();
    scheduleActivitySound(payload.id, payload.type);
  });

  _socket.on('activity:update', (data) => {
    updateActivity(data.id, data.state);
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
  });

  _socket.on('configure:intensity', (data) => {
    store.config.intensity = data.value;
  });

  _socket.on('configure:fg_count', (data) => {
    store.config.fgTarget = data.value;
  });

  _socket.on('configure:mute', (data) => {
    store.config.muted = data.muted;
    audio.setMuted(data.muted);
  });

  _socket.on('client:connect', (data) => {
    store.clientCount = data.count;
  });

  _socket.on('configure:layout', (data) => {
    setLayout(data.cols, data.rows);
  });

  _socket.on('window:resize', (data) => {
    resizeActivity(data.id, data.size, data.position);
  });

  _socket.on('window:move', (data) => {
    // Update window position from another client's drag (or echo of our own)
    moveActivity(data.id, data.position);
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
