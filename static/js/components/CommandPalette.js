/** Searchable keyboard command palette. */
import { store, savePrefs, showToast } from '../store.js';
import { runShortcut, applyScene } from '../keyboard.js';
import { sendChannelSwitch } from '../socket.js';
import { SCENES } from '../scenes.js';

const SHORTCUT_COMMANDS = [
  ['Maximize grid layout', 'm', 'm'],
  ['Toggle sound', 'Shift+M', 'M'],
  ['Toggle fullscreen', 'F', 'f'],
  ['Shuffle activities', 'R', 'r'],
  ['Increase intensity', '+', '+'],
  ['Decrease intensity', '-', '-'],
  ['Increase window count', '}', '}'],
  ['Decrease window count', '{', '{'],
  ['Previous channel', '[', '['],
  ['Next channel', ']', ']'],
  ['Next scene', 'S', 's'],
  ['Previous scene', 'Shift+S', 'S'],
  ['Toggle slideshow', 'P', 'p'],
  ['Next theme', 'T', 't'],
  ['Previous theme', 'Shift+T', 'T'],
  ['Next ambient preset', 'A', 'a'],
  ['Previous ambient preset', 'Shift+A', 'A'],
  ['Show keyboard shortcuts', '?', '?'],
  ['Enter lock mode', 'L', 'l'],
];

export default {
  name: 'CommandPalette',
  setup() {
    const { ref, computed, watch, onMounted } = Vue;
    const query = ref('');
    const selected = ref(0);
    const searchInput = ref(null);

    const commands = computed(() => [
      ...SHORTCUT_COMMANDS.map(([label, shortcut, key]) => ({
        label, shortcut, run: () => runShortcut(key),
      })),
      {
        label: store.headerPinned ? 'Unpin header' : 'Pin header',
        shortcut: '',
        run: () => {
          store.headerPinned = !store.headerPinned;
          savePrefs();
          showToast(store.headerPinned ? 'HEADER PINNED' : 'HEADER AUTO-HIDE');
        },
      },
      ...store.channels.map(channel => ({
        label: `Switch to ${channel.name || `Channel ${channel.id}`}`,
        shortcut: `CH ${channel.id}`,
        run: () => {
          if (channel.id !== store.currentChannel) sendChannelSwitch(channel.id);
        },
      })),
      ...[...SCENES, ...store.customScenes].map(scene => ({
        label: `Scene: ${scene.name}`,
        shortcut: 'SCENE',
        run: () => {
          applyScene(scene);
          showToast('SCENE: ' + scene.name.toUpperCase());
        },
      })),
    ]);

    const matches = computed(() => {
      const terms = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      return commands.value.filter(command => {
        const text = `${command.label} ${command.shortcut}`.toLowerCase();
        return terms.every(term => text.includes(term));
      });
    });

    watch(query, () => { selected.value = 0; });
    onMounted(() => searchInput.value?.focus());

    function close() {
      store.commandPaletteOpen = false;
    }

    function execute(command) {
      if (!command) return;
      close();
      command.run();
    }

    function onKey(evt) {
      if (evt.key === 'Escape') {
        evt.preventDefault();
        close();
      } else if (evt.key === 'ArrowDown') {
        evt.preventDefault();
        if (matches.value.length) selected.value = (selected.value + 1) % matches.value.length;
      } else if (evt.key === 'ArrowUp') {
        evt.preventDefault();
        if (matches.value.length) selected.value = (selected.value - 1 + matches.value.length) % matches.value.length;
      } else if (evt.key === 'Enter') {
        evt.preventDefault();
        execute(matches.value[selected.value]);
      }
    }

    return { query, selected, searchInput, matches, close, execute, onKey };
  },
  template: `
    <div class="command-palette-overlay" @click.self="close" @keydown.stop="onKey">
      <div class="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <input ref="searchInput" v-model="query" class="command-palette-search"
               type="text" placeholder="Type a command or scene..." aria-label="Search commands" />
        <div class="command-palette-list" role="listbox" aria-label="Commands">
          <button v-for="(command, index) in matches" :key="command.label"
                  type="button" class="command-palette-item"
                  :class="{ selected: index === selected }"
                  role="option" :aria-selected="index === selected"
                  @mouseenter="selected = index" @click="execute(command)">
            <span>{{ command.label }}</span><span class="command-palette-shortcut">{{ command.shortcut }}</span>
          </button>
          <div v-if="!matches.length" class="command-palette-empty">No matching commands</div>
        </div>
        <div class="command-palette-hint">↑ ↓ SELECT &nbsp; ENTER RUN &nbsp; ESC CLOSE</div>
      </div>
    </div>
  `,
};
