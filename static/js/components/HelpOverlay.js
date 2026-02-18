/**
 * Help overlay showing keyboard shortcuts.
 */
import { store } from '../store.js';

const SHORTCUTS = [
  ['M',       'Toggle mute'],
  ['F',       'Toggle fullscreen'],
  ['R',       'Shuffle / randomize all'],
  ['+ / =',   'Increase intensity'],
  ['-',       'Decrease intensity'],
  ['[',       'Decrease window count'],
  [']',       'Increase window count'],
  ['Space',   'Pin / unpin header'],
  ['L',       'Enter lock mode'],
  ['A',       'Toggle ambient audio'],
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
