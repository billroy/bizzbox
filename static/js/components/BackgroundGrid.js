/**
 * Fixed tiled background grid layout.
 */
import { store, getBackgroundSlots } from '../store.js';
import ActivityWindow from './ActivityWindow.js';

export default {
  name: 'BackgroundGrid',
  components: { ActivityWindow },
  setup() {
    const { computed } = Vue;
    const gridStyle = computed(() => {
      if (!store.grid) return {};
      return {
        gridTemplateColumns: store.grid.gridTemplateColumns,
        gridTemplateRows:    store.grid.gridTemplateRows,
      };
    });
    const slots = computed(() => getBackgroundSlots());
    return { gridStyle, slots };
  },
  template: `
    <div class="background-grid" :style="gridStyle">
      <div
        v-for="{ slot, activity } in slots"
        :key="slot.index"
        class="bg-slot"
        :class="{ 'bg-slot--empty': !activity || !slot.active }"
      >
        <ActivityWindow v-if="activity" :activity="activity" :key="activity.id" />
      </div>
    </div>
  `,
};
