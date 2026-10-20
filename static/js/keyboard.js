/**
 * Keyboard shortcut handler + lock mode.
 */
import { store, savePrefs, showToast, THEME_LIST } from './store.js';
import { sendStyle, sendIntensity, sendMute, sendRandomize, sendLayout, sendScene, sendChannelSwitch, sendChannelCreate } from './socket.js';
import { audio, AMBIENT_PRESET_LIST } from './audio.js';
import { SCENES } from './scenes.js';
import { ACTIVITY_TYPES } from './activityTypes.js';
import { toggleSlideshow } from './slideshow.js';
import { GRID_PRESETS } from './layout.js';

let _cursorHideTimer = null;
let _sceneIndex = -1;

function cycleIndex(index, direction, length) {
  if (index < 0) return direction === 1 ? 0 : length - 1;
  return (index + direction + length) % length;
}

function enterLockMode() {
  store.lockMode = true;
  store.headerPinned = false;
  store.helpOverlay = false;
  store.commandPaletteOpen = false;
  store.filterModalOpen = false;
  document.body.classList.add('lock-mode');
  scheduleCursorHide();
}

function exitLockMode() {
  store.lockMode = false;
  document.body.classList.remove('lock-mode');
  clearTimeout(_cursorHideTimer);
  document.body.style.cursor = '';
}

function scheduleCursorHide() {
  clearTimeout(_cursorHideTimer);
  document.body.style.cursor = '';
  _cursorHideTimer = setTimeout(() => {
    if (store.lockMode) {
      document.body.style.cursor = 'none';
    }
  }, 2000);
}

export function applyScene(scene) {
  sendScene(scene);
  if (scene.ambientPreset !== undefined) {
    const key = scene.ambientPreset || null;
    store.ambientPreset = key;
    if (key) {
      audio.startAmbient(key, scene.intensity);
    } else {
      audio.stopAmbient();
    }
  }
  if (scene.filter && Array.isArray(scene.filter)) {
    const allowed = new Set(scene.filter);
    for (const t of ACTIVITY_TYPES) store.activityFilter[t] = allowed.has(t);
  } else {
    // No restrictive filter — clear any existing filter (filter:null or undefined)
    for (const t of ACTIVITY_TYPES) store.activityFilter[t] = true;
  }
}

function onKeyDown(evt) {
  // The palette can be open before its search field receives focus, or while
  // focus is elsewhere. Escape should still dismiss it in either case.
  if (store.commandPaletteOpen) {
    if (evt.key === 'Escape') {
      store.commandPaletteOpen = false;
      evt.preventDefault();
    }
    // Keep typing in the search field, but allow the scene shortcut when
    // focus has not reached the palette (or has moved outside it).
    if ((evt.key !== 's' && evt.key !== 'S') ||
        evt.target.tagName === 'INPUT' || evt.target.tagName === 'TEXTAREA') return;
  }

  // Skip if focused on text inputs or range sliders
  const tag = evt.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  // If a <select> has focus, blur it so our shortcuts work instead of
  // the native select behaviour (which jumps to matching options and
  // can inadvertently trigger change events).
  if (tag === 'SELECT') {
    evt.target.blur();
    evt.preventDefault();
  }

  const key = evt.key;

  // Alt+digit: direct channel switching (Alt+1..9 = channels 1-9, Alt+0 = channel 10)
  // Use evt.code to avoid macOS alt-character issues (Alt+1 → '¡' etc.)
  if (evt.altKey) {
    const digitMatch = evt.code && evt.code.match(/^Digit(\d)$/);
    if (digitMatch) {
      const digit = parseInt(digitMatch[1]);
      const channelNum = digit === 0 ? 10 : digit;
      const target = store.channels.find(c => c.id === channelNum);
      if (target && channelNum !== store.currentChannel) {
        sendChannelSwitch(channelNum);
        showToast('CHANNEL ' + channelNum);
      }
      evt.preventDefault();
      return;
    }
  }

  // Lock mode: only L or Escape exits (but not in kiosk or viewer mode)
  if (store.lockMode) {
    if (!store.kioskMode && !store.viewerMode && (key === 'l' || key === 'L' || key === 'Escape')) {
      exitLockMode();
      showToast('UNLOCKED');
      evt.preventDefault();
    }
    return;
  }

  switch (key) {
    case 'M':
      sendMute(!store.config.muted);
      showToast(store.config.muted ? 'SOUND ON' : 'MUTED');
      evt.preventDefault();
      break;

    case 'm': {
      const maxLayout = GRID_PRESETS.reduce((max, preset) =>
        preset.cols * preset.rows > max.cols * max.rows ? preset : max
      );
      sendLayout(maxLayout.cols, maxLayout.rows);
      showToast('LAYOUT ' + maxLayout.label);
      evt.preventDefault();
      break;
    }

    case 'f':
    case 'F':
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
      evt.preventDefault();
      break;

    case 'r':
    case 'R':
      sendRandomize();
      showToast('SHUFFLE');
      evt.preventDefault();
      break;

    case '+':
    case '=': {
      const newInt = Math.min(20, store.config.intensity + 1);
      sendIntensity(newInt);
      showToast('INTENSITY ' + newInt);
      evt.preventDefault();
      break;
    }

    case '-': {
      const newInt = Math.max(1, store.config.intensity - 1);
      sendIntensity(newInt);
      showToast('INTENSITY ' + newInt);
      evt.preventDefault();
      break;
    }

    case '[': {
      // Prev channel
      const sorted = store.channels.map(c => c.id).sort((a, b) => a - b);
      const curIdx = sorted.indexOf(store.currentChannel);
      if (curIdx > 0) {
        sendChannelSwitch(sorted[curIdx - 1]);
        showToast('CHANNEL ' + sorted[curIdx - 1]);
      }
      evt.preventDefault();
      break;
    }

    case ']': {
      // Next channel
      const sorted = store.channels.map(c => c.id).sort((a, b) => a - b);
      const curIdx = sorted.indexOf(store.currentChannel);
      if (curIdx < sorted.length - 1) {
        sendChannelSwitch(sorted[curIdx + 1]);
        showToast('CHANNEL ' + sorted[curIdx + 1]);
      }
      evt.preventDefault();
      break;
    }

    case ' ':
      if (!evt.repeat && !store.filterModalOpen && !store.embedModalOpen) {
        store.helpOverlay = false;
        store.commandPaletteOpen = true;
      }
      evt.preventDefault();
      break;

    case 'l':
    case 'L':
      showToast('LOCK MODE');
      enterLockMode();
      evt.preventDefault();
      break;

    case 'p':
    case 'P':
      toggleSlideshow(store.slideshowInterval);
      evt.preventDefault();
      break;

    case '?':
    case 'h':
    case 'H':
      store.helpOverlay = !store.helpOverlay;
      evt.preventDefault();
      break;

    case 't':
    case 'T': {
      const idx = THEME_LIST.indexOf(store.config.style);
      const direction = key === 'T' ? -1 : 1;
      const next = THEME_LIST[cycleIndex(idx, direction, THEME_LIST.length)];
      sendStyle(next);
      showToast('THEME: ' + next.toUpperCase());
      evt.preventDefault();
      break;
    }

    case 'a':
    case 'A': {
      // Cycle ambient presets in either direction, including the off state.
      const presets = [null, ...AMBIENT_PRESET_LIST];
      const idx = presets.findIndex(p => p?.key === store.ambientPreset || (p === null && !store.ambientPreset));
      const direction = key === 'A' ? -1 : 1;
      const nextPreset = presets[cycleIndex(idx, direction, presets.length)];
      const next = nextPreset?.key || null;
      if (next) {
        store.ambientPreset = next;
        audio.startAmbient(next, store.config.intensity);
        showToast('AMBIENT: ' + nextPreset.label.toUpperCase());
      } else {
        store.ambientPreset = null;
        audio.stopAmbient();
        showToast('AMBIENT OFF');
      }
      savePrefs();
      evt.preventDefault();
      break;
    }

    case 's':
    case 'S': {
      // Cycle scenes
      const direction = key === 'S' ? -1 : 1;
      _sceneIndex = cycleIndex(_sceneIndex, direction, SCENES.length);
      const scene = SCENES[_sceneIndex];
      applyScene({ ...scene, fgTarget: 0 });
      store.commandPaletteOpen = false;
      showToast('SCENE: ' + scene.name.toUpperCase());
      evt.preventDefault();
      break;
    }
  }
}

// Palette commands share the same action path as their keyboard shortcuts.
export function runShortcut(key) {
  onKeyDown({ target: document.body, key, altKey: false, preventDefault() {} });
}

function onMouseMoveLock() {
  if (store.lockMode) scheduleCursorHide();
}

export function initKeyboard() {
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('mousemove', onMouseMoveLock);

  // Check URL override for lock mode
  if (store.lockMode) {
    // Already set from URL override in store
    enterLockMode();
  }
}
