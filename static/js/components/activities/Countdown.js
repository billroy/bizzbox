/**
 * Countdown timer renderer.
 */
export default {
  name: 'ActivityCountdown',
  props: { activity: Object },
  setup(props) {
    const { computed } = Vue;
    const state = computed(() => props.activity?.state ?? {});
    return { state };
  },
  template: `
    <div class="activity-countdown">
      <div class="countdown-label">{{ state.phase_label || 'COUNTDOWN' }}</div>
      <div class="countdown-display" :class="'style-' + (state.phase_style || 'normal')">
        {{ state.display || '00:00:00.000' }}
      </div>
      <div class="countdown-phase">T-MINUS</div>
    </div>
  `,
};
