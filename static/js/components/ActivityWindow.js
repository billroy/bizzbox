/**
 * Activity window chrome — title bar, fade wrapper, dynamic activity component.
 */
export default {
  name: 'ActivityWindow',
  props: {
    activity: { type: Object, required: true },
  },
  setup(props) {
    const { computed } = Vue;
    const activityComponent = computed(() =>
      'activity-' + props.activity.type.replace(/_/g, '-')
    );
    const fadeClass = computed(() => ({
      'is-fading-in':  props.activity.spawning,
      'is-fading-out': props.activity.despawning,
    }));
    return { activityComponent, fadeClass };
  },
  template: `
    <div class="activity-window" :class="fadeClass">
      <div class="window-titlebar">
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
