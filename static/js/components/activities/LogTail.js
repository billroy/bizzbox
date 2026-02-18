/**
 * Log tail with severity color coding renderer.
 */
export default {
  name: 'ActivityLogTail',
  props: { activity: Object },
  setup(props) {
    const { computed, ref, watch, nextTick } = Vue;
    const containerRef = ref(null);
    const lines = computed(() => props.activity?.state?.lines ?? []);

    watch(lines, () => {
      nextTick(() => {
        if (containerRef.value) containerRef.value.scrollTop = containerRef.value.scrollHeight;
      });
    }, { deep: true });

    return { lines, containerRef };
  },
  template: `
    <div class="text-scroll" ref="containerRef" style="gap: 0;">
      <div v-for="(line, i) in lines" :key="i" class="log-line">
        <span class="log-ts">{{ line.timestamp }}</span>
        <span class="log-level" :class="'level-' + line.level">{{ line.level }}</span>
        <span class="log-text">{{ line.text }}</span>
      </div>
    </div>
  `,
};
