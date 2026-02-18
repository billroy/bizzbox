/**
 * Scrolling code display renderer.
 */
export default {
  name: 'ActivityCodeScroll',
  props: { activity: Object },
  setup(props) {
    const { computed, ref, watch, nextTick } = Vue;
    const containerRef = ref(null);
    const lines = computed(() => props.activity?.state?.lines ?? []);

    watch(lines, () => {
      nextTick(() => {
        if (containerRef.value) {
          containerRef.value.scrollTop = containerRef.value.scrollHeight;
        }
      });
    }, { deep: true });

    return { lines, containerRef };
  },
  template: `
    <div class="activity-code-scroll text-scroll" ref="containerRef">
      <div
        v-for="(line, i) in lines"
        :key="i"
        class="text-line"
        :class="['type-' + line.type, { highlighted: line.highlighted }]"
      >{{ line.text || '\u00a0' }}</div>
    </div>
  `,
};
