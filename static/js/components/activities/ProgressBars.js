/**
 * Concurrent progress bar panel — DOM-based reactive component.
 * Server sends array of bars with label, progress (0–100), status, speed.
 */
export default {
  name: 'ActivityProgressBars',
  props: { activity: Object },
  setup(props) {
    const { computed } = Vue;
    const bars = computed(() => props.activity?.state?.bars ?? []);
    const strategy = computed(() => props.activity?.state?.strategy ?? '');

    function barWidth(bar) {
      return Math.min(100, Math.max(0, bar.progress)) + '%';
    }

    function statusClass(bar) {
      if (bar.status === 'complete') return 'bar-complete';
      if (bar.progress > 80) return 'bar-finishing';
      return '';
    }

    return { bars, strategy, barWidth, statusClass };
  },
  template: `
    <div class="activity-progress-bars">
      <div
        v-for="(bar, idx) in bars"
        :key="idx"
        class="pbar-item"
        :class="statusClass(bar)"
      >
        <div class="pbar-header">
          <span class="pbar-label">{{ bar.label }}</span>
          <span class="pbar-pct">{{ Math.round(bar.progress) }}%</span>
        </div>
        <div class="pbar-track">
          <div class="pbar-fill" :style="{ width: barWidth(bar) }"></div>
        </div>
        <div class="pbar-status" v-if="bar.status === 'complete'">COMPLETE</div>
      </div>
      <div class="pbar-strategy">{{ strategy.toUpperCase().replace(/_/g, ' ') }}</div>
    </div>
  `,
};
