/**
 * Auto-hiding page header with all controls.
 */
import { store } from '../store.js';
import { sendStyle, sendIntensity, sendMute, sendLayout, sendWindowSpawn, sendFgTarget, sendRandomize } from '../socket.js';
import { GRID_PRESETS } from '../layout.js';
import { ACTIVITY_TYPES } from '../activityTypes.js';
import { SCENES } from '../scenes.js';
import { audio } from '../audio.js';

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

    function onMouseMove() { showHeader(); }

    onMounted(() => {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('touchstart', onMouseMove);
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
    function applyScene(evt) {
      const name = evt.target.value;
      if (!name) return;
      const scene = SCENES.find(s => s.name === name);
      if (scene) {
        sendStyle(scene.style);
        sendLayout(scene.cols, scene.rows);
        sendIntensity(scene.intensity);
        sendFgTarget(scene.fgTarget);
      }
      evt.target.value = '';
    }

    function openFilter() {
      store.filterModalOpen = true;
    }

    function toggleAmbient() {
      store.ambientEnabled = !store.ambientEnabled;
      if (store.ambientEnabled) {
        audio.startAmbient(store.config.intensity);
      } else {
        audio.stopAmbient();
      }
    }

    const ambientEnabled = computed(() => store.ambientEnabled);

    return { store, visible, style, intensity, muted, connected, clientCount, toggleFullscreen, isFullscreen, layout, gridPresets, fgTarget, spawnType, activityTypes, spawnWindow, randomize, scenes, applyScene, openFilter, toggleAmbient, ambientEnabled };
  },

  template: `
    <header class="page-header" :class="{ 'is-visible': visible }" v-show="!store.lockMode">
      <div class="header-title">BIZZBOX</div>

      <div class="header-sep"></div>

      <div class="conn-status">
        <div class="conn-dot" :class="{ connected }"></div>
        <span class="conn-label">{{ connected ? 'LIVE' : 'OFFLINE' }}</span>
      </div>

      <div class="header-sep"></div>

      <span class="header-label">SCENE</span>
      <select class="header-select" @change="applyScene">
        <option value="">---</option>
        <option v-for="s in scenes" :key="s.name" :value="s.name">{{ s.name.toUpperCase() }}</option>
      </select>

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

      <div class="header-spacer"></div>

      <select class="header-select" v-model="spawnType">
        <option :value="null">RANDOM</option>
        <option v-for="t in activityTypes" :key="t" :value="t">
          {{ t.toUpperCase().replace(/_/g, ' ') }}
        </option>
      </select>
      <button class="header-btn" @click="spawnWindow" title="Spawn new window">+</button>
      <button class="header-btn" @click="randomize" title="Randomize all activities">SHUFFLE</button>
      <button class="header-btn" @click="openFilter" title="Filter activity types">FILTER</button>

      <div class="header-sep"></div>

      <button class="header-btn" @click="muted = !muted"
              :class="{ active: muted }">
        {{ muted ? 'MUTED' : 'SOUND' }}
      </button>

      <button class="header-btn" @click="toggleAmbient"
              :class="{ active: ambientEnabled }">
        AMBIENCE
      </button>

      <button class="header-btn" @click="toggleFullscreen">
        {{ isFullscreen ? 'EXIT FS' : 'FULLSCR' }}
      </button>
    </header>
  `,
};
