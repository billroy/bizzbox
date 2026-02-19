/**
 * Keyboard shortcut handler + lock mode.
 */
import { store, savePrefs, showToast, THEME_LIST } from './store.js';
import { sendStyle, sendIntensity, sendMute, sendRandomize, sendFgTarget } from './socket.js';
import { audio, AMBIENT_PRESET_LIST } from './audio.js';

let _cursorHideTimer = null;

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

function onKeyDown(evt) {
  // Skip if focused on inputs
  const tag = evt.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

  const key = evt.key;

  // Lock mode: only L or Escape exits
  if (store.lockMode) {
    if (key === 'l' || key === 'L' || key === 'Escape') {
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
      const newFg = Math.max(0, store.config.fgTarget - 1);
      sendFgTarget(newFg);
      showToast('WINDOWS ' + newFg);
      evt.preventDefault();
      break;
    }

    case ']': {
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
