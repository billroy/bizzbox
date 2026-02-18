/**
 * Toast-like notification stack renderer.
 */
export default {
  name: 'ActivityNotifications',
  props: { activity: Object },
  setup(props) {
    const { computed } = Vue;
    const stack = computed(() => {
      const items = props.activity?.state?.stack ?? [];
      return [...items].reverse();
    });
    function progressWidth(item) {
      const pct = Math.max(0, 100 - (item.age_ms / item.max_age_ms) * 100);
      return pct + '%';
    }
    return { stack, progressWidth };
  },
  template: `
    <div class="activity-notifications">
      <div
        v-for="item in stack"
        :key="item.id"
        class="notif-item"
        :class="'level-' + item.level"
      >
        <div class="notif-header">
          <span class="notif-level">{{ item.level }}</span>
          <span class="notif-title">{{ item.title }}</span>
        </div>
        <div class="notif-body">{{ item.body }}</div>
        <div class="notif-progress">
          <div class="notif-progress-bar" :style="{ width: progressWidth(item) }"></div>
        </div>
      </div>
    </div>
  `,
};
