/**
 * Slideshow mode — auto-cycles through scenes on a timer.
 * Supports subset filtering: 'all' (default), 'builtin', 'custom',
 * or a comma-separated list of scene names.
 */
import { store, showToast } from './store.js';
import { applyScene } from './keyboard.js';
import { SCENES, loadCustomScenes } from './scenes.js';

let _timer = null;
let _transitionTimer = null;
let _transitionEndTimer = null;
let _index = 0;
let _filter = 'all';

function normalizeInterval(intervalSec) {
  const seconds = Number(intervalSec);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 60;
}

function scheduleNextTransition(intervalSec = store.slideshowInterval) {
  if (_timer) clearTimeout(_timer);

  const seconds = normalizeInterval(intervalSec);
  store.slideshowInterval = seconds;
  store.slideshowNextTransitionAt = Date.now() + seconds * 1000;
  _timer = setTimeout(advanceSlideshow, seconds * 1000);
}

function advanceSlideshow() {
  _timer = null;
  if (!store.slideshowActive) return;

  const scenes = filteredScenes();
  if (scenes.length > 0) {
    _index = _index % scenes.length;

    // Brief blackout transition
    document.body.classList.add('slideshow-transition');
    _transitionTimer = setTimeout(() => {
      _transitionTimer = null;
      applyScene(scenes[_index]);
      _index = (_index + 1) % scenes.length;
      _transitionEndTimer = setTimeout(() => {
        _transitionEndTimer = null;
        document.body.classList.remove('slideshow-transition');
      }, 300);
    }, 300);
  }

  scheduleNextTransition();
}

function filteredScenes() {
  const builtin = SCENES;
  const custom = loadCustomScenes();

  if (_filter === 'builtin') return [...builtin];
  if (_filter === 'custom')  return [...custom];
  if (_filter === 'all')     return [...builtin, ...custom];

  // Comma-separated list of scene names (case-insensitive)
  const names = _filter.split(',').map(n => n.trim().toLowerCase().replace(/[-_]/g, ' '));
  const all = [...builtin, ...custom];
  return all.filter(s => names.includes(s.name.toLowerCase().replace(/[-_]/g, ' ')));
}

export function startSlideshow(intervalSec = 60, filter = 'all') {
  if (_timer) clearTimeout(_timer);
  clearTimeout(_transitionTimer);
  clearTimeout(_transitionEndTimer);
  document.body.classList.remove('slideshow-transition');
  store.slideshowActive = true;
  store.slideshowInterval = normalizeInterval(intervalSec);
  _filter = filter || 'all';

  const scenes = filteredScenes();
  if (scenes.length === 0) {
    showToast('SLIDESHOW: NO SCENES MATCH FILTER');
    store.slideshowActive = false;
    store.slideshowNextTransitionAt = null;
    return;
  }

  // Find current scene index (start from next)
  _index = (_index + 1) % scenes.length;

  scheduleNextTransition(store.slideshowInterval);

  // Apply first scene immediately
  applyScene(scenes[_index]);
  _index = (_index + 1) % scenes.length;

  const label = _filter === 'all' ? '' : ` [${_filter.toUpperCase()}]`;
  showToast(`SLIDESHOW ON (${store.slideshowInterval}s)${label}`);
}

/** Reset the upcoming transition and use the selected duration for the cadence. */
export function setNextTransition(intervalSec) {
  if (!store.slideshowActive) return;
  scheduleNextTransition(intervalSec);
}

export function stopSlideshow() {
  if (_timer) {
    clearTimeout(_timer);
    _timer = null;
  }
  clearTimeout(_transitionTimer);
  clearTimeout(_transitionEndTimer);
  _transitionTimer = null;
  _transitionEndTimer = null;
  store.slideshowActive = false;
  store.slideshowNextTransitionAt = null;
  document.body.classList.remove('slideshow-transition');
  showToast('SLIDESHOW OFF');
}

export function toggleSlideshow(intervalSec = 60, filter = 'all') {
  if (store.slideshowActive) {
    stopSlideshow();
  } else {
    startSlideshow(intervalSec, filter);
  }
}
