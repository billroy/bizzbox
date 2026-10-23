/**
 * Presentation controls and authoritative server-state projection.
 * Timing and scene advancement live on the server; this module never owns a
 * presentation timer.
 */
import { store, showToast } from './store.js';
import { SCENES, loadCustomScenes } from './scenes.js';
import { audio } from './audio.js';

let _transport = null;
let _lastAmbientSceneKey = null;

export function setSlideshowTransport(transport) {
  _transport = transport;
}

function normalizeInterval(intervalSec) {
  const seconds = Number(intervalSec);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 60;
}

export function filteredScenes(filter = 'all') {
  const builtin = SCENES;
  const custom = loadCustomScenes();

  if (filter === 'builtin') return [...builtin];
  if (filter === 'custom') return [...custom];
  if (filter === 'all') return [...builtin, ...custom];

  const names = filter.split(',').map(n => n.trim().toLowerCase().replace(/[-_]/g, ' '));
  return [...builtin, ...custom].filter(
    scene => names.includes(scene.name.toLowerCase().replace(/[-_]/g, ' ')),
  );
}

export function startSlideshow(intervalSec = 60, filter = 'all', ifInactive = false) {
  const scenes = filteredScenes(filter || 'all');
  if (scenes.length === 0) {
    showToast('PRESENTATION: NO SCENES MATCH FILTER');
    return false;
  }
  if (!_transport) return false;
  _transport.start({
    intervalSeconds: normalizeInterval(intervalSec),
    filter: filter || 'all',
    scenes,
    ifInactive,
  });
  return true;
}

export function setNextTransition(intervalSec) {
  if (!store.slideshowActive || !_transport) return false;
  _transport.schedule(normalizeInterval(intervalSec));
  return true;
}

export function stopSlideshow() {
  if (!store.slideshowActive || !_transport) return false;
  _transport.stop();
  return true;
}

export function toggleSlideshow(intervalSec = 60, filter = 'all') {
  return store.slideshowActive
    ? stopSlideshow()
    : startSlideshow(intervalSec, filter);
}

/** Apply a presentation snapshot received from the server. */
export function applyPresentationState(state, force = false) {
  if (!state || (state.channelId && state.channelId !== store.currentChannel)) return false;
  if (!force && state.revision < store.slideshowRevision) return false;

  const serverTime = Number(state.serverTime);
  const nextTransitionAt = Number(state.nextTransitionAt);
  const offset = Number.isFinite(serverTime) ? serverTime - Date.now() : 0;

  store.slideshowActive = !!state.active;
  store.slideshowInterval = normalizeInterval(state.intervalSeconds);
  store.slideshowNextTransitionAt = state.active && Number.isFinite(nextTransitionAt)
    ? nextTransitionAt - offset
    : null;
  store.slideshowRevision = Number.isFinite(Number(state.revision)) ? Number(state.revision) : 0;
  store.slideshowPhase = state.phase || 'idle';
  store.slideshowFilter = state.filter || 'all';

  if (store.slideshowActive && store.slideshowPhase !== 'idle') {
    document.body.classList.add('slideshow-transition');
  } else {
    document.body.classList.remove('slideshow-transition');
  }

  const scene = state.currentScene;
  const sceneKey = scene ? `${state.currentIndex}:${scene.name}:${scene.ambientPreset || ''}` : null;
  if (scene && sceneKey !== _lastAmbientSceneKey) {
    _lastAmbientSceneKey = sceneKey;
    store.ambientPreset = scene.ambientPreset || null;
    if (store.ambientPreset) audio.startAmbient(store.ambientPreset, scene.intensity);
    else audio.stopAmbient();
  }

  return true;
}
