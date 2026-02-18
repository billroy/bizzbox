/**
 * Activity window chrome — title bar, fade wrapper, dynamic activity component.
 * Emits 'titlebar-pointerdown' so the parent ForegroundLayer can handle dragging.
 */
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

    function onTitlebarPointerDown(evt) {
      emit('titlebar-pointerdown', evt);
    }

    return { activityComponent, fadeClass, onTitlebarPointerDown };
  },
  template: `
    <div class="activity-window" :class="fadeClass">
      <div
        class="window-titlebar"
        @pointerdown="onTitlebarPointerDown"
      >
        <div class="titlebar-dot"></div>
        <span class="titlebar-title">{{ activity.title }}</span>
        <div class="titlebar-blink"></div>
      </div>
      <div class="activity-content">
        <component :is="activityComponent" :activity="activity" />
      </div>
    </div>
  `,
};
