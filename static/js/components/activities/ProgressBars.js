/**
 * Concurrent progress bar panel — enhanced with striped fills, completion burst, ETA.
 */
export default {
  name: 'ActivityProgressBars',
  props: { activity: Object },
  setup(props) {
    const { computed, ref, watch } = Vue;
    const bars = computed(() => props.activity?.state?.bars ?? []);
    const strategy = computed(() => props.activity?.state?.strategy ?? '');

    // Track recently completed bars for burst animation
    const justCompleted = ref({});
    let prevStatuses = {};

    watch(bars, (newBars) => {
      for (let i = 0; i < newBars.length; i++) {
        const bar = newBars[i];
        const prev = prevStatuses[i];
        if (bar.status === 'complete' && prev === 'active') {
          justCompleted.value[i] = true;
          setTimeout(() => { delete justCompleted.value[i]; }, 800);
        }
        prevStatuses[i] = bar.status;
      }
    }, { deep: true });

    function barWidth(bar) {
      return Math.min(100, Math.max(0, bar.progress)) + '%';
    }

    function statusClass(bar, idx) {
      const cls = [];
      if (bar.status === 'complete') cls.push('bar-complete');
      if (bar.progress > 80 && bar.status !== 'complete') cls.push('bar-finishing');
      if (justCompleted.value[idx]) cls.push('bar-just-completed');
      return cls.join(' ');
    }

    function eta(bar) {
      if (bar.status === 'complete' || bar.progress >= 100 || bar.speed <= 0) return '';
      const remaining = 100 - bar.progress;
      const secs = remaining / bar.speed;
      if (secs > 999) return '';
      if (secs < 60) return `~${Math.ceil(secs)}s`;
      return `~${Math.ceil(secs / 60)}m`;
    }

    return { bars, strategy, barWidth, statusClass, eta };
  },
  template: `
    <div class="activity-progress-bars">
      <div
        v-for="(bar, idx) in bars"
        :key="idx"
        class="pbar-item"
        :class="statusClass(bar, idx)"
      >
        <div class="pbar-header">
          <span class="pbar-label">{{ bar.label }}</span>
          <span class="pbar-eta">{{ eta(bar) }}</span>
          <span class="pbar-pct">{{ Math.round(bar.progress) }}%</span>
        </div>
        <div class="pbar-track">
          <div class="pbar-fill pbar-striped" :style="{ width: barWidth(bar) }"></div>
        </div>
        <div class="pbar-status" v-if="bar.status === 'complete'">COMPLETE</div>
      </div>
      <div class="pbar-strategy">{{ strategy.toUpperCase().replace(/_/g, ' ') }}</div>
    </div>
  `,
};
