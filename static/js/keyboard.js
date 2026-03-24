/**
 * Keyboard shortcut handler + lock mode.
 */
import { store, savePrefs, showToast, THEME_LIST } from './store.js';
import { sendStyle, sendIntensity, sendMute, sendRandomize, sendFgTarget, sendLayout, sendActivityFilter, sendChannelSwitch, sendChannelCreate, sendConfigureSlots } from './socket.js';
import { audio, AMBIENT_PRESET_LIST } from './audio.js';
import { SCENES } from './scenes.js';
import { ACTIVITY_TYPES } from './activityTypes.js';
import { toggleSlideshow } from './slideshow.js';

let _cursorHideTimer = null;
let _sceneIndex = -1;

function enterLockMode() {
  store.lockMode = true;
  store.headerPinned = false;
  store.helpOverlay = false;
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
  sendStyle(scene.style);
  sendLayout(scene.cols, scene.rows);
  sendIntensity(scene.intensity);
  sendFgTarget(scene.fgTarget);
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
    const filterObj = {};
    for (const t of ACTIVITY_TYPES) filterObj[t] = false;
    for (const t of scene.filter) filterObj[t] = true;
    store.activityFilter = filterObj;
    sendActivityFilter(scene.filter);
  } else {
    // No restrictive filter — clear any existing filter (filter:null or undefined)
    const filterObj = {};
    for (const t of ACTIVITY_TYPES) filterObj[t] = true;
    store.activityFilter = filterObj;
    sendActivityFilter(null);
  }
  // Bulk slot assignment (e.g. Feature Zoo)
  if (scene.slots && Array.isArray(scene.slots)) {
    // Delay to let layout resize settle before assigning slots
    setTimeout(() => {
      sendConfigureSlots(scene.slots);
    }, 500);
  } else {
    // Clear pinned slots from previous scenes (e.g. Feature Zoo)
    sendConfigureSlots([]);
  }
  savePrefs();
}

function onKeyDown(evt) {
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
    case 'm':
    case 'M':
      sendMute(!store.config.muted);
      showToast(store.config.muted ? 'SOUND ON' : 'MUTED');
      evt.preventDefault();
      break;

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

    case '{': {
      // Decrease window count (moved from '[')
      const newFg = Math.max(0, store.config.fgTarget - 1);
      sendFgTarget(newFg);
      showToast('WINDOWS ' + newFg);
      evt.preventDefault();
      break;
    }

    case '}': {
      // Increase window count (moved from ']')
      const newFg = Math.min(20, store.config.fgTarget + 1);
      sendFgTarget(newFg);
      showToast('WINDOWS ' + newFg);
      evt.preventDefault();
      break;
    }

    case ' ':
      store.headerPinned = !store.headerPinned;
      savePrefs();
      showToast(store.headerPinned ? 'HEADER PINNED' : 'HEADER AUTO-HIDE');
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
      const next = THEME_LIST[(idx + 1) % THEME_LIST.length];
      sendStyle(next);
      showToast('THEME: ' + next.toUpperCase());
      evt.preventDefault();
      break;
    }

    case 'a':
    case 'A': {
      // Cycle ambient presets: null → first → second → ... → last → null
      const keys = AMBIENT_PRESET_LIST.map(p => p.key);
      const labels = AMBIENT_PRESET_LIST.map(p => p.label);
      const idx = store.ambientPreset ? keys.indexOf(store.ambientPreset) : -1;
      const next = idx + 1 >= keys.length ? null : keys[idx + 1];
      if (next) {
        store.ambientPreset = next;
        audio.startAmbient(next, store.config.intensity);
        const label = labels[keys.indexOf(next)] || next;
        showToast('AMBIENT: ' + label.toUpperCase());
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
      _sceneIndex = (_sceneIndex + 1) % SCENES.length;
      const scene = SCENES[_sceneIndex];
      applyScene(scene);
      showToast('SCENE: ' + scene.name.toUpperCase());
      evt.preventDefault();
      break;
    }
  }
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
