/**
 * Activity type filter modal — checkboxes to include/exclude types from spawn pool.
 */
import { store } from '../store.js';
import { ACTIVITY_TYPES } from '../activityTypes.js';
import { sendActivityFilter } from '../socket.js';

export default {
  name: 'FilterModal',
  setup() {
    const { ref, computed, watch } = Vue;

    // Ensure filter map is populated for all types
    for (const t of ACTIVITY_TYPES) {
      if (store.activityFilter[t] === undefined) {
        store.activityFilter[t] = true;
      }
    }

    const types = ACTIVITY_TYPES;

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

    function emitFilter() {
      const allowed = ACTIVITY_TYPES.filter(t => store.activityFilter[t]);
      sendActivityFilter(allowed);
    }

    function close() {
      store.filterModalOpen = false;
    }

    function formatName(t) {
      return t.replace(/_/g, ' ').toUpperCase();
    }

    return { types, toggle, selectAll, selectNone, close, formatName, filter: store.activityFilter };
  },
  template: `
    <div class="filter-overlay" @click.self="close">
      <div class="filter-panel">
        <div class="filter-title">ACTIVITY FILTER</div>
        <div class="filter-actions">
          <button class="filter-action-btn" @click="selectAll">SELECT ALL</button>
          <button class="filter-action-btn" @click="selectNone">NONE</button>
        </div>
        <div class="filter-grid">
          <label v-for="t in types" :key="t" class="filter-item" @click.prevent="toggle(t)">
            <span class="filter-check" :class="{ checked: filter[t] }">{{ filter[t] ? '&#x2713;' : '' }}</span>
            <span class="filter-name">{{ formatName(t) }}</span>
          </label>
        </div>
        <div class="filter-close" @click="close">CLOSE</div>
      </div>
    </div>
  `,
};
