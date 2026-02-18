/**
 * Binary/hex dump stream renderer.
 */
export default {
  name: 'ActivityHexDump',
  props: { activity: Object },
  setup(props) {
    const { computed, ref, watch, nextTick } = Vue;
    const containerRef = ref(null);
    const rows = computed(() => props.activity?.state?.rows ?? []);

    watch(rows, () => {
      nextTick(() => {
        if (containerRef.value) containerRef.value.scrollTop = containerRef.value.scrollHeight;
      });
    }, { deep: true });

    return { rows, containerRef };
  },
  template: `
    <div class="text-scroll" ref="containerRef" style="gap:0;">
      <div v-for="(row, i) in rows" :key="i" class="hex-row">
        <span class="hex-offset">{{ row.offset }}</span>
        <span class="hex-bytes">{{ row.hex }}</span>
        <span class="hex-ascii">{{ row.ascii }}</span>
      </div>
    </div>
  `,
};
