/**
 * Chat/Comms Intercept — intercepted communications feed.
 * HTML/CSS template (not canvas) — styled like a secure terminal printout.
 */
export default {
  name: 'ActivityChatIntercept',
  props: { activity: { type: Object, required: true } },
  setup(props) {
    const { computed } = Vue;
    const messages = computed(() => props.activity.state?.messages || []);

    function clsClass(classification) {
      switch (classification) {
        case 'TOP SECRET':    return 'cls-topsecret';
        case 'SECRET':        return 'cls-secret';
        case 'CONFIDENTIAL':  return 'cls-conf';
        default:              return 'cls-unclass';
      }
    }

    return { messages, clsClass };
  },
  template: `
    <div class="activity-chat-intercept">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="intercept-msg"
        :class="clsClass(msg.classification)"
      >
        <div class="intercept-header">
          <span class="intercept-cls" :class="clsClass(msg.classification)">{{ msg.classification }}</span>
          <span class="intercept-ts">{{ msg.timestamp }}</span>
        </div>
        <div class="intercept-route">
          <span class="intercept-callsign from">{{ msg.callsign_from }}</span>
          <span class="intercept-arrow">&rarr;</span>
          <span class="intercept-callsign to">{{ msg.callsign_to }}</span>
        </div>
        <div class="intercept-body">{{ msg.body }}</div>
      </div>
    </div>
  `,
};
