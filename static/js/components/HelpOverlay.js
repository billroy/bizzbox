/**
 * Help overlay showing keyboard shortcuts.
 */
import { store } from '../store.js';

const SHORTCUTS = [
  ['m',       'Select maximum grid layout'],
  ['Shift+M', 'Toggle mute'],
  ['F',       'Toggle fullscreen'],
  ['R',       'Shuffle / randomize all'],
  ['+ / -',   'Next / previous grid layout'],
  ['= / _',   'Increase / decrease intensity'],
  ['[ / ]',   'Prev / next channel'],
  ['Alt+1-9', 'Switch to channel 1-9'],
  ['Alt+0',   'Switch to channel 10'],
  ['Space',   'Open command palette'],
  ['L',       'Enter lock mode'],
  ['S / Shift+S', 'Next / previous scene'],
  ['P',       'Toggle slideshow'],
  ['T / Shift+T', 'Next / previous theme'],
  ['A / Shift+A', 'Next / previous ambient preset'],
  ['? / H',   'Toggle this help'],
  ['Esc',     'Exit lock mode'],
];

export default {
  name: 'HelpOverlay',
  setup() {
    function close() {
      store.helpOverlay = false;
    }
    return { close, shortcuts: SHORTCUTS };
  },
  template: `
    <div class="help-overlay" @click.self="close">
      <div class="help-panel">
        <div class="help-title">KEYBOARD SHORTCUTS</div>
        <div class="help-grid">
          <div v-for="s in shortcuts" :key="s[0]" class="help-row">
            <span class="help-key">{{ s[0] }}</span>
            <span class="help-desc">{{ s[1] }}</span>
          </div>
        </div>
        <div class="help-close" @click="close">CLOSE</div>
      </div>
    </div>
  `,
};
