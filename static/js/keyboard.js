/**
 * Keyboard shortcut handler + lock mode.
 */
import { store } from './store.js';
import { sendStyle, sendIntensity, sendMute, sendRandomize, sendFgTarget } from './socket.js';
import { audio } from './audio.js';

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
      evt.preventDefault();
    }
    return;
  }

  switch (key) {
    case 'm':
    case 'M':
      sendMute(!store.config.muted);
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
      evt.preventDefault();
      break;

    case '+':
    case '=':
      sendIntensity(Math.min(20, store.config.intensity + 1));
      evt.preventDefault();
      break;

    case '-':
      sendIntensity(Math.max(1, store.config.intensity - 1));
      evt.preventDefault();
      break;

    case '[':
      sendFgTarget(Math.max(0, store.config.fgTarget - 1));
      evt.preventDefault();
      break;

    case ']':
      sendFgTarget(Math.min(20, store.config.fgTarget + 1));
      evt.preventDefault();
      break;

    case ' ':
      store.headerPinned = !store.headerPinned;
      evt.preventDefault();
      break;

    case 'l':
    case 'L':
      enterLockMode();
      evt.preventDefault();
      break;

    case '?':
    case 'h':
    case 'H':
      store.helpOverlay = !store.helpOverlay;
      evt.preventDefault();
      break;

    case 'a':
    case 'A':
      // Toggle ambient
      store.ambientEnabled = !store.ambientEnabled;
      if (store.ambientEnabled) {
        audio.startAmbient(store.config.intensity);
      } else {
        audio.stopAmbient();
      }
      evt.preventDefault();
      break;
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
