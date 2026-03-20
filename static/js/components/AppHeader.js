/**
 * Auto-hiding page header with all controls.
 */
import { store, savePrefs, clearPrefs, showToast } from '../store.js';
import { sendStyle, sendIntensity, sendMute, sendLayout, sendWindowSpawn, sendFgTarget, sendRandomize, sendActivityFilter, sendChannelCreate, sendChannelSwitch } from '../socket.js';
import { GRID_PRESETS } from '../layout.js';
import { ACTIVITY_TYPES, ACTIVITY_CATEGORIES } from '../activityTypes.js';
import { SCENES, loadCustomScenes, saveCustomScene, deleteCustomScene, exportScenes, importScenes, encodeSceneToBase64 } from '../scenes.js';
import { audio, AMBIENT_PRESET_LIST } from '../audio.js';
import { copyConfigUrl } from '../configUrl.js';
import { applyScene as applySceneAction } from '../keyboard.js';

export default {
  name: 'AppHeader',
  setup() {
    const { ref, computed, onMounted, onUnmounted } = Vue;

    const visible = ref(false);
    let hideTimer = null;
    let mouseInHeader = false;

    function showHeader() {
      if (store.lockMode) return;
      visible.value = true;
      clearTimeout(hideTimer);
      if (!store.headerPinned) {
        hideTimer = setTimeout(() => {
          // Only hide if the mouse has left the header
          if (!mouseInHeader) {
            visible.value = false;
          }
        }, 3000);
      }
    }

    function onHeaderMouseEnter() {
      mouseInHeader = true;
    }

    function onHeaderMouseLeave() {
      mouseInHeader = false;
      // Start hide timer now that mouse has left
      if (visible.value && !store.headerPinned) {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => { visible.value = false; }, 1000);
      }
    }

    function onMouseMove(evt) {
      // Reveal header only when cursor hits the very top edge of the screen
      // (avoids covering top-row activity titlebars at clientY ~10-30px)
      if (evt.clientY < 5 || visible.value) {
        showHeader();
      }
    }

    // ── Scene actions dropdown ──────────────────────────────────
    const sceneActionsOpen = ref(false);

    function toggleSceneActions() {
      sceneActionsOpen.value = !sceneActionsOpen.value;
    }

    function onDocClick(evt) {
      if (sceneActionsOpen.value && !evt.target.closest('.scene-actions-wrapper')) {
        sceneActionsOpen.value = false;
      }
    }

    // ── Pin toggle ────────────────────────────────────────────────
    function togglePin() {
      store.headerPinned = !store.headerPinned;
      savePrefs();
      // Reset the hide timer based on new pin state
      clearTimeout(hideTimer);
      if (!store.headerPinned && !mouseInHeader) {
        hideTimer = setTimeout(() => { visible.value = false; }, 3000);
      }
    }

    onMounted(() => {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('touchstart', onMouseMove);
      document.addEventListener('click', onDocClick);
      // Load custom scenes from localStorage
      store.customScenes = loadCustomScenes();
    });

    onUnmounted(() => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('touchstart', onMouseMove);
      document.removeEventListener('click', onDocClick);
      clearTimeout(hideTimer);
    });

    const style = computed({
      get: () => store.config.style,
      set: (v) => sendStyle(v),
    });

    const intensity = computed({
      get: () => store.config.intensity,
      set: (v) => sendIntensity(Number(v)),
    });

    const muted = computed({
      get: () => store.config.muted,
      set: (v) => sendMute(v),  // store updated via server echo on 'configure:mute'
    });

    const gridPresets = GRID_PRESETS;

    const layout = computed({
      get: () => store.grid ? `${store.grid.cols}x${store.grid.rows}` : '3x2',
      set: (v) => {
        const [cols, rows] = v.split('x').map(Number);
        sendLayout(cols, rows);
      },
    });

    const connected = computed(() => store.connected);
    const clientCount = computed(() => store.clientCount || 0);

    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }

    const isFullscreen = ref(false);
    function onFullscreenChange() {
      isFullscreen.value = !!document.fullscreenElement;
    }
    onMounted(() => document.addEventListener('fullscreenchange', onFullscreenChange));
    onUnmounted(() => document.removeEventListener('fullscreenchange', onFullscreenChange));

    const fgTarget = computed({
      get: () => store.config.fgTarget,
      set: (v) => sendFgTarget(Number(v)),
    });

    const spawnType = ref(null);  // null = RANDOM
    const activityTypes = ACTIVITY_TYPES;

    function spawnWindow() {
      sendWindowSpawn(spawnType.value);
    }

    function randomize() {
      sendRandomize();
    }

    const scenes = SCENES;
    const customScenes = computed(() => store.customScenes);

    function applyScene(evt) {
      const name = evt.target.value;
      if (!name) return;
      const scene = SCENES.find(s => s.name === name) || store.customScenes.find(s => s.name === name);
      if (scene) applySceneAction(scene);
      evt.target.value = '';
    }

    function saveScene() {
      const name = window.prompt('Scene name:');
      if (!name || !name.trim()) return;

      // Capture the current activity filter
      const allEnabled = ACTIVITY_TYPES.every(t => store.activityFilter[t]);
      let filter = null;
      if (!allEnabled) {
        filter = ACTIVITY_TYPES.filter(t => store.activityFilter[t]);
      }

      // Determine which categories are fully included for metadata
      const categories = [];
      if (filter) {
        const filterSet = new Set(filter);
        for (const [cat, types] of Object.entries(ACTIVITY_CATEGORIES)) {
          if (types.every(t => filterSet.has(t))) {
            categories.push(cat);
          }
        }
      }

      const scene = {
        name: name.trim(),
        style: store.config.style,
        cols: store.grid ? store.grid.cols : 3,
        rows: store.grid ? store.grid.rows : 2,
        intensity: store.config.intensity,
        fgTarget: store.config.fgTarget,
        ambientPreset: store.ambientPreset || null,
        filter,
        categories: categories.length > 0 ? categories : undefined,
      };
      saveCustomScene(scene);
      store.customScenes = loadCustomScenes();
    }

    function removeCustomScene(evt, name) {
      evt.preventDefault();
      evt.stopPropagation();
      deleteCustomScene(name);
      store.customScenes = loadCustomScenes();
    }

    function doExportScenes() {
      const json = exportScenes();
      const count = JSON.parse(json).length;
      navigator.clipboard.writeText(json).then(() => {
        showToast(`${count} SCENE(S) COPIED`);
      }).catch(() => {
        window.alert(`${count} custom scene(s) copied to clipboard.`);
      });
    }

    function doImportScenes() {
      const json = window.prompt('Paste scene JSON (or cancel to upload a file):');
      if (json && json.trim()) {
        try {
          const result = importScenes(json);
          store.customScenes = result;
          window.alert(`Imported — ${result.length} custom scene(s) total.`);
        } catch (e) {
          window.alert('Import failed: ' + e.message);
        }
      } else if (json === null) {
        // User cancelled — offer file upload
        doImportScenesFromFile();
      }
    }

    function doImportScenesFromFile() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const result = importScenes(reader.result);
            store.customScenes = result;
            window.alert(`Imported — ${result.length} custom scene(s) total.`);
          } catch (e) {
            window.alert('Import failed: ' + e.message);
          }
        };
        reader.readAsText(file);
      });
      input.click();
    }

    function shareScene() {
      // Check if current config matches a built-in scene — use vanity URL if so
      const builtinMatch = SCENES.find(s => {
        if (s.style !== store.config.style) return false;
        if (store.grid && (s.cols !== store.grid.cols || s.rows !== store.grid.rows)) return false;
        if (s.intensity !== store.config.intensity) return false;
        if ((s.ambientPreset || null) !== (store.ambientPreset || null)) return false;
        return true;
      });

      if (builtinMatch) {
        const slug = builtinMatch.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const url = `${window.location.origin}/${slug}`;
        navigator.clipboard.writeText(url).then(() => {
          window.alert('Scene URL copied to clipboard!');
        }).catch(() => {
          window.prompt('Copy this URL:', url);
        });
        return;
      }

      // Fall back to scene_data encoding for custom configs
      const scene = {
        name: 'Shared Scene',
        style: store.config.style,
        cols: store.grid ? store.grid.cols : 3,
        rows: store.grid ? store.grid.rows : 2,
        intensity: store.config.intensity,
        fgTarget: store.config.fgTarget,
        ambientPreset: store.ambientPreset || null,
        filter: null,
      };
      const allEnabled = ACTIVITY_TYPES.every(t => store.activityFilter[t]);
      if (!allEnabled) {
        scene.filter = ACTIVITY_TYPES.filter(t => store.activityFilter[t]);
      }
      const b64 = encodeSceneToBase64(scene);
      const url = `${window.location.origin}${window.location.pathname}?scene_data=${b64}`;
      navigator.clipboard.writeText(url).then(() => {
        window.alert('Scene URL copied to clipboard!');
      }).catch(() => {
        window.prompt('Copy this URL:', url);
      });
    }

    function copyConfigLink() {
      copyConfigUrl().then(() => {
        import('../store.js').then(m => m.showToast('CONFIG URL COPIED'));
      });
    }

    async function takeScreenshot() {
      const header = document.querySelector('.page-header');
      if (header) header.style.display = 'none';
      try {
        // Brief flash for feedback
        const flash = document.createElement('div');
        flash.className = 'screenshot-flash';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 300);

        const canvas = await html2canvas(document.body, {
          backgroundColor: null,
          scale: window.devicePixelRatio || 1,
          logging: false,
        });
        const link = document.createElement('a');
        link.download = `bizzbox-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } finally {
        if (header) header.style.display = '';
      }
    }

    function openFilter() {
      store.filterModalOpen = true;
    }

    function openEmbed() {
      store.embedModalOpen = true;
    }

    function resetPrefs() {
      clearPrefs();
      location.reload();
    }

    // ── Volume control ────────────────────────────────────────
    const volume = computed({
      get: () => store.config.volume,
      set: (v) => {
        const val = Math.max(0, Math.min(100, Number(v)));
        store.config.volume = val;
        audio.setVolume(val / 100);
        // Auto-mute at 0, auto-unmute above 0
        if (val === 0 && !store.config.muted) {
          sendMute(true);
        } else if (val > 0 && store.config.muted) {
          sendMute(false);
        }
        savePrefs();
      },
    });

    const ambientPresets = AMBIENT_PRESET_LIST;

    const ambientPreset = computed({
      get: () => store.ambientPreset || '',
      set: (v) => {
        const key = v || null;
        store.ambientPreset = key;
        if (key) {
          audio.startAmbient(key, store.config.intensity);
        } else {
          audio.stopAmbient();
        }
        savePrefs();
      },
    });

    // ── Channel controls ─────────────────────────────────────
    const currentChannel = computed(() => store.currentChannel);
    const channels = computed(() => store.channels);
    const maxChannels = computed(() => store.maxChannels);
    const channelViewers = computed(() => store.channelViewers);
    const totalClients = computed(() => store.totalClients);

    function switchChannel(evt) {
      const channelId = parseInt(evt.target.value);
      if (channelId && channelId !== store.currentChannel) {
        sendChannelSwitch(channelId);
      }
    }

    function createChannel() {
      sendChannelCreate();
    }

    return { store, visible, style, intensity, muted, connected, clientCount, toggleFullscreen, isFullscreen, layout, gridPresets, fgTarget, spawnType, activityTypes, spawnWindow, randomize, scenes, customScenes, applyScene, saveScene, removeCustomScene, doExportScenes, doImportScenes, shareScene, copyConfigLink, takeScreenshot, openFilter, openEmbed, resetPrefs, ambientPresets, ambientPreset, volume, currentChannel, channels, maxChannels, channelViewers, totalClients, switchChannel, createChannel, sceneActionsOpen, toggleSceneActions, togglePin, onHeaderMouseEnter, onHeaderMouseLeave };
  },

  template: `
    <header class="page-header" :class="{ 'is-visible': visible }" v-show="!store.lockMode"
            @mouseenter="onHeaderMouseEnter" @mouseleave="onHeaderMouseLeave">

      <!-- ROW 1: Identity + Channel/Scene -->
      <div class="header-row">
        <div class="header-group">
          <a class="header-title" href="https://github.com/billroy/bizzbox" target="_blank" rel="noopener">BIZZBOX</a>
          <div class="conn-status">
            <div class="conn-dot" :class="{ connected }"></div>
            <span class="conn-label">{{ connected ? 'LIVE' : 'OFFLINE' }}</span>
          </div>
          <span class="viewer-count" v-if="connected">{{ channelViewers }}/{{ totalClients }}</span>
        </div>

        <div class="header-group">
          <div class="group-section">
            <span class="group-label">CHANNEL</span>
            <select class="header-select" :value="currentChannel" @change="switchChannel($event)">
              <option v-for="ch in channels" :key="ch.id" :value="ch.id">
                {{ ch.name }} ({{ ch.viewers }})
              </option>
            </select>
            <button class="header-btn" @click="createChannel"
                    :disabled="channels.length >= maxChannels"
                    :title="channels.length >= maxChannels ? 'Max channels reached' : 'Create new channel'">+</button>
          </div>
          <div class="group-section">
            <span class="group-label">SCENE</span>
            <select class="header-select" @change="applyScene">
              <option value="">---</option>
              <option v-for="s in scenes" :key="s.name" :value="s.name">{{ s.name.toUpperCase() }}</option>
              <option v-if="customScenes.length" disabled>────</option>
              <option v-for="s in customScenes" :key="'c_'+s.name" :value="s.name">{{ s.name.toUpperCase() }} *</option>
            </select>
            <div class="scene-actions-wrapper">
              <button class="header-btn scene-actions-trigger"
                      @click.stop="toggleSceneActions"
                      title="Scene actions: save, export, import, share">...</button>
              <div class="scene-actions-menu" v-show="sceneActionsOpen">
                <button class="scene-action-item" @click="saveScene(); sceneActionsOpen = false">Save Scene</button>
                <button class="scene-action-item" @click="doExportScenes(); sceneActionsOpen = false">Export Scenes</button>
                <button class="scene-action-item" @click="doImportScenes(); sceneActionsOpen = false">Import Scenes</button>
                <button class="scene-action-item" @click="shareScene(); sceneActionsOpen = false">Share Scene URL</button>
                <button class="scene-action-item" @click="openEmbed(); sceneActionsOpen = false">Embed Code</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ROW 2: Appearance + Activity -->
      <div class="header-row">
        <div class="header-group">
          <div class="group-section">
            <span class="group-label">THEME</span>
            <select class="header-select" v-model="style">
              <option value="dark">DARK</option>
              <option value="light">LIGHT</option>
              <option value="brutalist">BRUTALIST</option>
              <option value="neon">NEON</option>
              <option value="rainbow">RAINBOW</option>
              <option value="sunshine">SUNSHINE</option>
              <option value="red">RED</option>
              <option value="black">BLACK</option>
              <option value="lcars">LCARS</option>
              <option value="amber">AMBER</option>
              <option value="arctic">ARCTIC</option>
              <option value="synthwave">SYNTHWAVE</option>
              <option value="military">MILITARY</option>
              <option value="ocean">OCEAN</option>
              <option value="forest">FOREST</option>
              <option value="copper">COPPER</option>
              <option value="vapor">VAPOR</option>
              <option value="infrared">INFRARED</option>
              <option value="phosphor">PHOSPHOR</option>
              <option value="blueprint">BLUEPRINT</option>
              <option value="sunset">SUNSET</option>
              <option value="matrix">MATRIX</option>
              <option value="frost">FROST</option>
              <option value="agent">AGENT</option>
            </select>
          </div>
          <div class="group-section">
            <span class="group-label">LAYOUT</span>
            <select class="header-select" v-model="layout">
              <option v-for="p in gridPresets" :key="p.label" :value="p.cols + 'x' + p.rows">
                {{ p.label }}
              </option>
            </select>
          </div>
          <div class="group-section">
            <span class="group-label" title="Controls animation speed and visual complexity">ENERGY</span>
            <input class="header-input" type="range" min="1" max="20"
                   :value="intensity" @input="intensity = $event.target.value" />
            <span class="range-value">{{ intensity }}</span>
          </div>
        </div>

        <div class="header-group">
          <div class="group-section">
            <span class="group-label">SPAWN</span>
            <select class="header-select" v-model="spawnType">
              <option :value="null">RANDOM</option>
              <option v-for="t in activityTypes" :key="t" :value="t">
                {{ t.toUpperCase().replace(/_/g, ' ') }}
              </option>
            </select>
            <button class="header-btn" @click="spawnWindow" title="Spawn new window">+</button>
          </div>
          <button class="header-btn" @click="randomize" title="Randomize all activities">SHUFFLE</button>
          <button class="header-btn" @click="openFilter" title="Filter activity types">FILTER</button>
          <div class="group-section">
            <span class="group-label" title="Number of floating foreground windows">WIN COUNT</span>
            <input class="header-input" type="range" min="0" max="20"
                   :value="fgTarget" @input="fgTarget = $event.target.value" />
            <span class="range-value">{{ fgTarget }}</span>
          </div>
        </div>
      </div>

      <!-- ROW 3: Media + Utility -->
      <div class="header-row">
        <div class="header-group">
          <button class="header-btn" @click="muted = !muted"
                  :class="{ active: muted }">
            {{ muted ? 'MUTED' : 'SOUND' }}
          </button>
          <input type="range" min="0" max="100" v-model.number="volume"
                 class="header-slider header-vol" title="Volume" />
          <span class="vol-label">{{ volume }}%</span>
          <div class="group-section">
            <span class="group-label">AMBIENT</span>
            <select class="header-select" v-model="ambientPreset">
              <option value="">NONE</option>
              <option v-for="p in ambientPresets" :key="p.key" :value="p.key">
                {{ p.label.toUpperCase() }}
              </option>
            </select>
          </div>
        </div>

        <div class="header-spacer"></div>

        <div class="header-group">
          <button class="header-btn" @click="takeScreenshot" title="Save screenshot as PNG">SNAP</button>
          <button class="header-btn" @click="copyConfigLink" title="Copy shareable config URL to clipboard">LINK</button>
          <button class="header-btn" @click="toggleFullscreen">
            {{ isFullscreen ? 'EXIT FS' : 'FULLSCR' }}
          </button>
          <button class="header-btn header-btn--pin"
                  :class="{ active: store.headerPinned }"
                  @click="togglePin"
                  :title="store.headerPinned ? 'Unpin header (Space)' : 'Pin header open (Space)'">PIN</button>
          <button class="header-btn header-btn--danger" @click="resetPrefs"
                  title="Reset all saved preferences to defaults">RESET</button>
        </div>
      </div>

    </header>
  `,
};
