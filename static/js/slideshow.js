/**
 * Slideshow mode — auto-cycles through scenes on a timer.
 * Supports subset filtering: 'all' (default), 'builtin', 'custom',
 * or a comma-separated list of scene names.
 */
import { store, showToast } from './store.js';
import { applyScene } from './keyboard.js';
import { SCENES, loadCustomScenes } from './scenes.js';

let _timer = null;
let _index = 0;
let _filter = 'all';

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
  if (_timer) clearInterval(_timer);
  store.slideshowActive = true;
  store.slideshowInterval = intervalSec;
  _filter = filter || 'all';

  const scenes = filteredScenes();
  if (scenes.length === 0) {
    showToast('SLIDESHOW: NO SCENES MATCH FILTER');
    store.slideshowActive = false;
    return;
  }

  // Find current scene index (start from next)
  _index = (_index + 1) % scenes.length;

  _timer = setInterval(() => {
    const scenes = filteredScenes();
    if (scenes.length === 0) return;
    _index = _index % scenes.length;

    // Brief blackout transition
    document.body.classList.add('slideshow-transition');
    setTimeout(() => {
      applyScene(scenes[_index]);
      _index = (_index + 1) % scenes.length;
      setTimeout(() => {
        document.body.classList.remove('slideshow-transition');
      }, 300);
    }, 300);
  }, intervalSec * 1000);

  // Apply first scene immediately
  applyScene(scenes[_index]);
  _index = (_index + 1) % scenes.length;

  const label = _filter === 'all' ? '' : ` [${_filter.toUpperCase()}]`;
  showToast(`SLIDESHOW ON (${intervalSec}s)${label}`);
}

export function stopSlideshow() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  store.slideshowActive = false;
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
