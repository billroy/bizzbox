/**
 * Toast-like notification stack renderer — enhanced with animations and icons.
 */
const LEVEL_ICONS = {
  INFO: '\u25CF',     // ●
  WARN: '\u25B2',     // ▲
  ERROR: '\u2716',    // ✖
  CRIT: '\u25C6',     // ◆
  DEBUG: '\u25CB',    // ○
};

export default {
  name: 'ActivityNotifications',
  props: { activity: Object },
  setup(props) {
    const { computed, ref, watch } = Vue;

    const totalCount = ref(0);
    let seenIds = new Set();

    const stack = computed(() => {
      const items = props.activity?.state?.stack ?? [];
      return [...items].reverse();
    });

    // Track total count as new items appear
    watch(stack, (newStack) => {
      for (const item of newStack) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          totalCount.value++;
        }
      }
    }, { immediate: true });

    function progressWidth(item) {
      const pct = Math.max(0, 100 - (item.age_ms / item.max_age_ms) * 100);
      return pct + '%';
    }

    function icon(level) {
      return LEVEL_ICONS[level] || LEVEL_ICONS.INFO;
    }

    function isExpiring(item) {
      return (item.age_ms / item.max_age_ms) > 0.85;
    }

    function isNew(item) {
      return (item.age_ms / item.max_age_ms) < 0.08;
    }

    return { stack, progressWidth, icon, isExpiring, isNew, totalCount };
  },
  template: `
    <div class="activity-notifications">
      <div class="notif-counter">{{ totalCount }} EVENTS</div>
      <div
        v-for="item in stack"
        :key="item.id"
        class="notif-item"
        :class="['level-' + item.level, { 'notif-entering': isNew(item), 'notif-expiring': isExpiring(item) }]"
      >
        <div class="notif-stripe" :class="'stripe-' + item.level"></div>
        <div class="notif-content">
          <div class="notif-header">
            <span class="notif-icon" :class="'icon-' + item.level">{{ icon(item.level) }}</span>
            <span class="notif-level">{{ item.level }}</span>
            <span class="notif-title">{{ item.title }}</span>
          </div>
          <div class="notif-body">{{ item.body }}</div>
          <div class="notif-progress">
            <div class="notif-progress-bar" :class="'bar-' + item.level" :style="{ width: progressWidth(item) }"></div>
          </div>
        </div>
      </div>
    </div>
  `,
};
