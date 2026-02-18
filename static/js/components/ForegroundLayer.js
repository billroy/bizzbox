/**
 * Floating foreground windows layer — absolutely positioned over the grid.
 */
import { store, getForegroundActivities } from '../store.js';
import { scalePosition } from '../layout.js';
import ActivityWindow from './ActivityWindow.js';

export default {
  name: 'ForegroundLayer',
  components: { ActivityWindow },
  setup() {
    const { computed } = Vue;
    const activities = computed(() => getForegroundActivities());

    function windowStyle(act) {
      if (!act.position || !act.size) return {};
      return scalePosition(act.position, act.size);
    }

    return { activities, windowStyle };
  },
  template: `
    <div class="foreground-layer">
      <div
        v-for="act in activities"
        :key="act.id"
        class="foreground-window"
        :style="windowStyle(act)"
      >
        <ActivityWindow :activity="act" />
      </div>
    </div>
  `,
};
