/**
 * Access Control — DOM-based badge event feed with DENIED/TAILGATE/FORCED
 * event coloring and auto-scroll.
 */
export default {
  name: 'ActivityAccessControl',
  props: { activity: Object },
  setup(props) {
    const { ref, computed, watch, nextTick } = Vue;
    const feedRef = ref(null);

    const state        = computed(() => props.activity?.state || {});
    const events       = computed(() => state.value.events        || []);
    const entries_today = computed(() => state.value.entries_today ?? '--');
    const denied_count  = computed(() => state.value.denied_count  ?? '--');
    const zones_active  = computed(() => state.value.zones_active  ?? '--');

    watch(events, () => {
      nextTick(() => {
        const el = feedRef.value;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });

    return { events, entries_today, denied_count, zones_active, feedRef };
  },
  template: `
    <div class="activity-access-control">
      <div class="ac-feed" ref="feedRef">
        <div
          v-for="evt in events"
          :key="evt.timestamp + evt.badge_id"
          class="ac-event"
          :class="'ac-' + evt.action.toLowerCase()"
        >
          <span class="ac-time">{{ evt.timestamp }}</span>
          <span class="ac-action" :class="'action-' + evt.action">{{ evt.action }}</span>
          <span class="ac-name">{{ evt.name }}</span>
          <span class="ac-badge">{{ evt.badge_id }}</span>
          <span class="ac-zone">{{ evt.zone }}</span>
          <span class="ac-clear">{{ evt.clearance }}</span>
        </div>
      </div>
      <div class="ac-stats">
        <span>ENTRIES: {{ entries_today }}</span>
        <span>DENIED: {{ denied_count }}</span>
        <span>ZONES: {{ zones_active }}</span>
      </div>
    </div>
  `,
};
