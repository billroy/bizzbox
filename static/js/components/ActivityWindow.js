/**
 * Activity window chrome — title bar, fade wrapper, dynamic activity component.
 * Emits 'titlebar-pointerdown' so the parent ForegroundLayer can handle dragging.
 * Titlebar includes a type-selector dropdown and a respawn button.
 */
import { ACTIVITY_TYPES } from '../activityTypes.js';
import { sendWindowReplace } from '../socket.js';

export default {
  name: 'ActivityWindow',
  props: {
    activity: { type: Object, required: true },
  },
  emits: ['titlebar-pointerdown'],
  setup(props, { emit }) {
    const { computed } = Vue;
    const activityComponent = computed(() =>
      'activity-' + props.activity.type.replace(/_/g, '-')
    );
    const fadeClass = computed(() => ({
      'is-fading-in':  props.activity.spawning,
      'is-fading-out': props.activity.despawning,
    }));

    const activityTypes = ACTIVITY_TYPES;

    function formatTypeName(t) {
      return t.replace(/_/g, ' ').toUpperCase();
    }

    function onTitlebarPointerDown(evt) {
      emit('titlebar-pointerdown', evt);
    }

    function onTypeChange(evt) {
      const newType = evt.target.value;
      if (newType && newType !== props.activity.type) {
        sendWindowReplace(props.activity.id, newType);
      }
      // Reset select to current type (the window will despawn/respawn)
      evt.target.value = props.activity.type;
    }

    function onRespawn() {
      sendWindowReplace(props.activity.id, null);
    }

    return { activityComponent, fadeClass, activityTypes, formatTypeName, onTitlebarPointerDown, onTypeChange, onRespawn };
  },
  template: `
    <div class="activity-window" :class="fadeClass">
      <div
        class="window-titlebar"
        @pointerdown="onTitlebarPointerDown"
      >
        <div class="titlebar-dot"></div>
        <span class="titlebar-title">{{ activity.title }}</span>
        <select
          class="titlebar-select"
          :value="activity.type"
          @change="onTypeChange"
          @pointerdown.stop
        >
          <option v-for="t in activityTypes" :key="t" :value="t">{{ formatTypeName(t) }}</option>
        </select>
        <button class="titlebar-respawn" @click.stop="onRespawn" @pointerdown.stop title="Respawn">&#x21BB;</button>
        <div class="titlebar-blink"></div>
      </div>
      <div class="activity-content">
        <component :is="activityComponent" :activity="activity" />
      </div>
    </div>
  `,
};
