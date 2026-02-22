/**
 * Activity type filter modal — checkboxes to include/exclude types from spawn pool.
 * Groups activities by thematic category with search, invert, and per-category toggles.
 */
import { store, savePrefs } from '../store.js';
import { ACTIVITY_TYPES, ACTIVITY_CATEGORIES } from '../activityTypes.js';
import { sendActivityFilter } from '../socket.js';

const CATEGORY_ORDER = [
  'Ops Center', 'Surveillance', 'Sci-Fi', 'Fantasy',
  'Infrastructure', 'Data & Comms', 'Science', 'Finance',
];

export default {
  name: 'FilterModal',
  setup() {
    const { ref, computed, onMounted, nextTick } = Vue;

    // Ensure filter map is populated for all types
    for (const t of ACTIVITY_TYPES) {
      if (store.activityFilter[t] === undefined) {
        store.activityFilter[t] = true;
      }
    }

    const searchQuery = ref('');
    const searchInput = ref(null);
    const totalTypes = ACTIVITY_TYPES.length;

    // Auto-focus search on mount
    onMounted(() => {
      nextTick(() => { if (searchInput.value) searchInput.value.focus(); });
    });

    // Build filtered categories: each category with its types filtered by search
    const filteredCategories = computed(() => {
      const q = searchQuery.value.toLowerCase();
      const result = [];
      for (const cat of CATEGORY_ORDER) {
        const types = (ACTIVITY_CATEGORIES[cat] || [])
          .filter(t => formatName(t).toLowerCase().includes(q));
        if (types.length > 0) {
          result.push({ name: cat, types });
        }
      }
      return result;
    });

    const matchCount = computed(() =>
      filteredCategories.value.reduce((sum, c) => sum + c.types.length, 0)
    );

    function toggle(t) {
      store.activityFilter[t] = !store.activityFilter[t];
      emitFilter();
    }

    function toggleCategory(cat) {
      const types = ACTIVITY_CATEGORIES[cat] || [];
      // If all are checked, uncheck all; otherwise check all
      const allChecked = types.every(t => store.activityFilter[t]);
      for (const t of types) {
        store.activityFilter[t] = !allChecked;
      }
      emitFilter();
    }

    function isCategoryAllChecked(cat) {
      const types = ACTIVITY_CATEGORIES[cat] || [];
      return types.every(t => store.activityFilter[t]);
    }

    function isCategoryPartial(cat) {
      const types = ACTIVITY_CATEGORIES[cat] || [];
      const checked = types.filter(t => store.activityFilter[t]).length;
      return checked > 0 && checked < types.length;
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

    function highlightMatch(name) {
      if (!searchQuery.value) return name;
      const escaped = searchQuery.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return name.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
    }

    return {
      filteredCategories, matchCount, totalTypes, toggle, toggleCategory,
      isCategoryAllChecked, isCategoryPartial, selectAll, selectNone,
      invert, close, onKey, formatName, highlightMatch,
      filter: store.activityFilter, searchQuery, searchInput,
    };
  },
  template: `
    <div class="filter-overlay" @click.self="close" @keydown="onKey" tabindex="-1">
      <div class="filter-panel">
        <div class="filter-title">ACTIVITY FILTER</div>

        <div class="filter-search-wrap">
          <input class="filter-search" type="text" v-model="searchQuery"
                 placeholder="Search types..." @keydown.escape="close" ref="searchInput" />
          <button v-if="searchQuery" class="filter-search-clear"
                  @click="searchQuery = ''" title="Clear search">&times;</button>
        </div>

        <div class="filter-match-count" v-if="searchQuery">
          {{ matchCount }} of {{ totalTypes }} types
        </div>

        <div class="filter-actions">
          <button class="filter-action-btn" @click="selectAll">ALL</button>
          <button class="filter-action-btn" @click="selectNone">NONE</button>
          <button class="filter-action-btn" @click="invert">INVERT</button>
        </div>

        <div class="filter-scroll">
          <div v-for="cat in filteredCategories" :key="cat.name" class="filter-category">
            <div class="filter-category-header" @click="toggleCategory(cat.name)">
              <span class="filter-cat-check" :class="{ checked: isCategoryAllChecked(cat.name), partial: isCategoryPartial(cat.name) }">{{
                isCategoryAllChecked(cat.name) ? '\\u2713' : isCategoryPartial(cat.name) ? '\\u2500' : ''
              }}</span>
              {{ cat.name.toUpperCase() }}
              <span class="filter-cat-count">{{ cat.types.length }}</span>
            </div>
            <div class="filter-grid">
              <label v-for="t in cat.types" :key="t" class="filter-item" @click.prevent="toggle(t)">
                <span class="filter-check" :class="{ checked: filter[t] }">{{ filter[t] ? '\\u2713' : '' }}</span>
                <span class="filter-name" v-html="highlightMatch(formatName(t))"></span>
              </label>
            </div>
          </div>
        </div>

        <div class="filter-close" @click="close">CLOSE</div>
      </div>
    </div>
  `,
};
