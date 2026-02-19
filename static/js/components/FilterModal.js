/**
 * Activity type filter modal — checkboxes to include/exclude types from spawn pool.
 * Groups activities by category with search and invert.
 */
import { store, savePrefs } from '../store.js';
import { ACTIVITY_TYPES } from '../activityTypes.js';
import { sendActivityFilter } from '../socket.js';

const CANVAS_TYPES = new Set([
  'radar', 'network_topology', 'oscilloscope', 'geo_map', 'sdr_waterfall',
  'qam_constellation', 'orbital_view', 'globe_arcs', 'weather_radar',
  'wireframe_3d', 'game_of_life', 'matrix_rain', 'audio_spectrum',
  'seismograph', 'facial_recognition', 'resource_gauges', 'camera_feed',
  'heart_monitor', 'transit_map', 'power_grid', 'satellite_telemetry',
  'stock_graph', 'dna_sequence',
  // New canvas activities (added in later phases)
  'blockchain', 'flight_tracker', 'server_rack', 'cctv_mosaic',
  'process_monitor', 'sonar',
]);

export default {
  name: 'FilterModal',
  setup() {
    const { ref, computed } = Vue;

    // Ensure filter map is populated for all types
    for (const t of ACTIVITY_TYPES) {
      if (store.activityFilter[t] === undefined) {
        store.activityFilter[t] = true;
      }
    }

    const searchQuery = ref('');

    const canvasTypes = computed(() => {
      const q = searchQuery.value.toLowerCase();
      return ACTIVITY_TYPES.filter(t => CANVAS_TYPES.has(t) && formatName(t).toLowerCase().includes(q));
    });

    const textTypes = computed(() => {
      const q = searchQuery.value.toLowerCase();
      return ACTIVITY_TYPES.filter(t => !CANVAS_TYPES.has(t) && formatName(t).toLowerCase().includes(q));
    });

    function toggle(t) {
      store.activityFilter[t] = !store.activityFilter[t];
      emitFilter();
    }

    function selectAll() {
      for (const t of ACTIVITY_TYPES) store.activityFilter[t] = true;
      emitFilter();
    }

    function selectNone() {
      for (const t of ACTIVITY_TYPES) store.activityFilter[t] = false;
      emitFilter();
    }

    function invert() {
      for (const t of ACTIVITY_TYPES) store.activityFilter[t] = !store.activityFilter[t];
      emitFilter();
    }

    function emitFilter() {
      const allowed = ACTIVITY_TYPES.filter(t => store.activityFilter[t]);
      sendActivityFilter(allowed);
      savePrefs();
    }

    function close() {
      store.filterModalOpen = false;
    }

    function onKey(evt) {
      if (evt.key === 'Escape') close();
    }

    function formatName(t) {
      return t.replace(/_/g, ' ').toUpperCase();
    }

    return { canvasTypes, textTypes, toggle, selectAll, selectNone, invert, close, onKey, formatName, filter: store.activityFilter, searchQuery };
  },
  template: `
    <div class="filter-overlay" @click.self="close" @keydown="onKey" tabindex="-1">
      <div class="filter-panel">
        <div class="filter-title">ACTIVITY FILTER</div>

        <input class="filter-search" type="text" v-model="searchQuery"
               placeholder="Search types..." @keydown.escape="close" ref="searchInput" />

        <div class="filter-actions">
          <button class="filter-action-btn" @click="selectAll">ALL</button>
          <button class="filter-action-btn" @click="selectNone">NONE</button>
          <button class="filter-action-btn" @click="invert">INVERT</button>
        </div>

        <div class="filter-scroll">
          <div v-if="canvasTypes.length" class="filter-category">
            <div class="filter-category-header">CANVAS VISUALIZATIONS</div>
            <div class="filter-grid">
              <label v-for="t in canvasTypes" :key="t" class="filter-item" @click.prevent="toggle(t)">
                <span class="filter-check" :class="{ checked: filter[t] }">{{ filter[t] ? '&#x2713;' : '' }}</span>
                <span class="filter-name">{{ formatName(t) }}</span>
              </label>
            </div>
          </div>
          <div v-if="textTypes.length" class="filter-category">
            <div class="filter-category-header">TEXT / DATA PANELS</div>
            <div class="filter-grid">
              <label v-for="t in textTypes" :key="t" class="filter-item" @click.prevent="toggle(t)">
                <span class="filter-check" :class="{ checked: filter[t] }">{{ filter[t] ? '&#x2713;' : '' }}</span>
                <span class="filter-name">{{ formatName(t) }}</span>
              </label>
            </div>
          </div>
        </div>

        <div class="filter-close" @click="close">CLOSE</div>
      </div>
    </div>
  `,
};
