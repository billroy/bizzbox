/**
 * Auto-hiding page header with all controls.
 */
import { store, savePrefs, clearPrefs } from '../store.js';
import { sendStyle, sendIntensity, sendMute, sendLayout, sendWindowSpawn, sendFgTarget, sendRandomize, sendActivityFilter, sendChannelCreate, sendChannelSwitch } from '../socket.js';
import { GRID_PRESETS } from '../layout.js';
import { ACTIVITY_TYPES, ACTIVITY_CATEGORIES } from '../activityTypes.js';
import { SCENES, loadCustomScenes, saveCustomScene, deleteCustomScene, exportScenes, importScenes, encodeSceneToBase64 } from '../scenes.js';
import { audio, AMBIENT_PRESET_LIST } from '../audio.js';

export default {
  name: 'AppHeader',
  setup() {
    const { ref, computed, onMounted, onUnmounted } = Vue;

    const visible = ref(false);
    let hideTimer = null;

    function showHeader() {
      if (store.lockMode) return;
      visible.value = true;
      clearTimeout(hideTimer);
      if (!store.headerPinned) {
        hideTimer = setTimeout(() => { visible.value = false; }, 3000);
      }
    }

    function onMouseMove(evt) {
      // Only reveal the header when the cursor is near the top of the viewport
      // or when the header is already visible (so interacting with it keeps it open)
      if (evt.clientY < 80 || visible.value) {
        showHeader();
      }
    }

    onMounted(() => {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('touchstart', onMouseMove);
      // Load custom scenes from localStorage
      store.customScenes = loadCustomScenes();
    });

    onUnmounted(() => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('touchstart', onMouseMove);
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

    function _applySceneObj(scene) {
      sendStyle(scene.style);
      sendLayout(scene.cols, scene.rows);
      sendIntensity(scene.intensity);
      sendFgTarget(scene.fgTarget);
      // Apply ambient preset if defined
      if (scene.ambientPreset !== undefined) {
        const key = scene.ambientPreset || null;
        store.ambientPreset = key;
        if (key) {
          audio.startAmbient(key, scene.intensity);
        } else {
          audio.stopAmbient();
        }
        savePrefs();
      }
      // Apply activity filter if defined
      if (scene.filter && Array.isArray(scene.filter)) {
        const filterObj = {};
        for (const t of ACTIVITY_TYPES) filterObj[t] = false;
        for (const t of scene.filter) filterObj[t] = true;
        store.activityFilter = filterObj;
        sendActivityFilter(scene.filter);
        savePrefs();
      } else if (scene.filter === null) {
        // null = all enabled — reset filter
        const filterObj = {};
        for (const t of ACTIVITY_TYPES) filterObj[t] = true;
        store.activityFilter = filterObj;
        sendActivityFilter(ACTIVITY_TYPES);
        savePrefs();
      }
    }

    function applyScene(evt) {
      const name = evt.target.value;
      if (!name) return;
      const scene = SCENES.find(s => s.name === name) || store.customScenes.find(s => s.name === name);
      if (scene) _applySceneObj(scene);
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
      navigator.clipboard.writeText(json).then(() => {
        // Inline import to avoid circular deps
        const { showToast } = store;
        // showToast is on the store module, use the imported one
      }).catch(() => {});
      // Show feedback via alert as toast might not be imported here
      const count = JSON.parse(json).length;
      window.alert(`${count} custom scene(s) copied to clipboard.`);
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
      // Include current activity filter if not "all enabled"
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

    function openFilter() {
      store.filterModalOpen = true;
    }

    function resetPrefs() {
      clearPrefs();
      location.reload();
    }

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

    return { store, visible, style, intensity, muted, connected, clientCount, toggleFullscreen, isFullscreen, layout, gridPresets, fgTarget, spawnType, activityTypes, spawnWindow, randomize, scenes, customScenes, applyScene, saveScene, removeCustomScene, doExportScenes, doImportScenes, shareScene, openFilter, resetPrefs, ambientPresets, ambientPreset, currentChannel, channels, maxChannels, channelViewers, totalClients, switchChannel, createChannel };
  },

  template: `
    <header class="page-header" :class="{ 'is-visible': visible }" v-show="!store.lockMode">

      <div class="header-row">
        <a class="header-title" href="https://github.com/billroy/bizzbox" target="_blank" rel="noopener">BIZZBOX</a>

        <div class="header-sep"></div>

        <div class="conn-status">
          <div class="conn-dot" :class="{ connected }"></div>
          <span class="conn-label">{{ connected ? 'LIVE' : 'OFFLINE' }}</span>
        </div>
        <span class="viewer-count" v-if="connected">{{ channelViewers }}/{{ totalClients }} Watching</span>

        <div class="header-sep"></div>

        <span class="header-label">CHANNEL</span>
        <select class="header-select" :value="currentChannel" @change="switchChannel($event)">
          <option v-for="ch in channels" :key="ch.id" :value="ch.id">
            {{ ch.name }} ({{ ch.viewers }})
          </option>
        </select>
        <button class="header-btn" @click="createChannel"
                :disabled="channels.length >= maxChannels"
                :title="channels.length >= maxChannels ? 'Max channels reached' : 'Create new channel'">+</button>

        <div class="header-sep"></div>

        <span class="header-label">SCENE</span>
        <select class="header-select" @change="applyScene">
          <option value="">---</option>
          <option v-for="s in scenes" :key="s.name" :value="s.name">{{ s.name.toUpperCase() }}</option>
          <option v-if="customScenes.length" disabled>────</option>
          <option v-for="s in customScenes" :key="'c_'+s.name" :value="s.name">{{ s.name.toUpperCase() }} *</option>
        </select>
        <button class="header-btn" @click="saveScene" title="Save current config as scene">SAVE</button>
        <button class="header-btn" @click="doExportScenes" title="Copy custom scenes to clipboard">EXPORT</button>
        <button class="header-btn" @click="doImportScenes" title="Import scenes from JSON">IMPORT</button>
        <button class="header-btn" @click="shareScene" title="Copy shareable URL for current config">SHARE</button>

        <div class="header-sep"></div>

        <span class="header-label">STYLE</span>
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
        </select>

        <div class="header-sep"></div>

        <span class="header-label">LAYOUT</span>
        <select class="header-select" v-model="layout">
          <option v-for="p in gridPresets" :key="p.label" :value="p.cols + 'x' + p.rows">
            {{ p.label }}
          </option>
        </select>

        <div class="header-sep"></div>

        <span class="header-label">INTENSITY</span>
        <input class="header-input" type="range" min="1" max="20"
               :value="intensity" @input="intensity = $event.target.value" />
        <span class="intensity-value">{{ intensity }}</span>

        <div class="header-sep"></div>

        <span class="header-label">WINDOWS</span>
        <input class="header-input" type="range" min="0" max="20"
               :value="fgTarget" @input="fgTarget = $event.target.value" />
        <span class="intensity-value">{{ fgTarget }}</span>
      </div>

      <div class="header-row">
        <select class="header-select" v-model="spawnType">
          <option :value="null">RANDOM</option>
          <option v-for="t in activityTypes" :key="t" :value="t">
            {{ t.toUpperCase().replace(/_/g, ' ') }}
          </option>
        </select>
        <button class="header-btn" @click="spawnWindow" title="Spawn new window">+</button>
        <button class="header-btn" @click="randomize" title="Randomize all activities">SHUFFLE</button>
        <button class="header-btn" @click="openFilter" title="Filter activity types">FILTER</button>

        <div class="header-spacer"></div>

        <button class="header-btn" @click="muted = !muted"
                :class="{ active: muted }">
          {{ muted ? 'MUTED' : 'SOUND' }}
        </button>

        <span class="header-label">AMBIENT</span>
        <select class="header-select" v-model="ambientPreset">
          <option value="">NONE</option>
          <option v-for="p in ambientPresets" :key="p.key" :value="p.key">
            {{ p.label.toUpperCase() }}
          </option>
        </select>

        <button class="header-btn" @click="toggleFullscreen">
          {{ isFullscreen ? 'EXIT FS' : 'FULLSCR' }}
        </button>

        <button class="header-btn" @click="resetPrefs" title="Reset all saved preferences">RESET</button>
      </div>

    </header>
  `,
};
