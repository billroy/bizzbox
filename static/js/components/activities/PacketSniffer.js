/**
 * Packet Sniffer — DOM-based network packet feed with threat highlighting.
 */
export default {
  name: 'ActivityPacketSniffer',
  props: { activity: Object },
  setup(props) {
    const { ref, computed, watch, nextTick } = Vue;
    const scrollRef = ref(null);

    const state    = computed(() => props.activity?.state || {});
    const packets  = computed(() => state.value.packets  || []);
    const rate_pps = computed(() => state.value.rate_pps  ?? '--');
    const bytes_sec = computed(() => state.value.bytes_sec ?? '--');
    const strategy = computed(() => state.value.strategy  || '');

    watch(packets, () => {
      nextTick(() => {
        const el = scrollRef.value;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });

    return { packets, rate_pps, bytes_sec, strategy, scrollRef };
  },
  template: `
    <div class="activity-packet-sniffer">
      <div class="pkt-hud">
        <span>RATE: {{ rate_pps }} pps</span>
        <span>{{ bytes_sec }} B/s</span>
        <span>{{ strategy }}</span>
      </div>
      <div class="pkt-scroll" ref="scrollRef">
        <div v-for="pkt in packets" :key="pkt.timestamp + pkt.src_ip" class="pkt-row" :class="'threat-' + pkt.threat">
          <span class="pkt-time">{{ pkt.timestamp }}</span>
          <span class="pkt-proto" :class="'proto-' + pkt.protocol">{{ pkt.protocol }}</span>
          <span class="pkt-addr">{{ pkt.src_ip }}:{{ pkt.port }} &rarr; {{ pkt.dst_ip }}</span>
          <span class="pkt-size">{{ pkt.size_bytes }}B</span>
          <span class="pkt-flags">{{ pkt.flags }}</span>
        </div>
      </div>
    </div>
  `,
};
