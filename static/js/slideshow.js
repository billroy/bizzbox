/**
 * Slideshow mode — auto-cycles through scenes on a timer.
 */
import { store, showToast } from './store.js';
import { applyScene } from './keyboard.js';
import { SCENES, loadCustomScenes } from './scenes.js';

let _timer = null;
let _index = 0;

function allScenes() {
  return [...SCENES, ...loadCustomScenes()];
}

export function startSlideshow(intervalSec = 60) {
  if (_timer) clearInterval(_timer);
  store.slideshowActive = true;
  store.slideshowInterval = intervalSec;

  const scenes = allScenes();
  if (scenes.length === 0) return;

  // Find current scene index (start from next)
  _index = (_index + 1) % scenes.length;

  _timer = setInterval(() => {
    const scenes = allScenes();
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

  showToast(`SLIDESHOW ON (${intervalSec}s)`);
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

export function toggleSlideshow(intervalSec = 60) {
  if (store.slideshowActive) {
    stopSlideshow();
  } else {
    startSlideshow(intervalSec);
  }
}
