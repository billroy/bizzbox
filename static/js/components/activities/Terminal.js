/**
 * Simulated terminal output renderer.
 */
export default {
  name: 'ActivityTerminal',
  props: { activity: Object },
  setup(props) {
    const { computed, ref, watch, nextTick } = Vue;
    const containerRef = ref(null);
    const lines = computed(() => props.activity?.state?.lines ?? []);
    const cursorVisible = computed(() => props.activity?.state?.cursor_visible ?? true);

    watch(lines, () => {
      nextTick(() => {
        if (containerRef.value) {
          containerRef.value.scrollTop = containerRef.value.scrollHeight;
        }
      });
    }, { deep: true });

    return { lines, cursorVisible, containerRef };
  },
  template: `
    <div class="activity-terminal text-scroll" ref="containerRef">
      <div
        v-for="(line, i) in lines"
        :key="i"
        class="text-line"
        :class="'style-' + line.style"
      >{{ line.text }}<span v-if="i === lines.length - 1 && cursorVisible" class="terminal-cursor"></span></div>
    </div>
  `,
};
