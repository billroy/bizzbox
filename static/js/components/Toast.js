/**
 * Transient on-screen toast notification.
 * Shows brief feedback for keyboard actions.
 */
import { store } from '../store.js';
import { audio } from '../audio.js';

export default {
  name: 'Toast',
  setup() {
    const { watch } = Vue;
    watch(() => store.toastMessage, (msg) => {
      if (msg) audio.playToast();
    });
    return { store };
  },
  template: `
    <div class="toast" v-if="store.toastMessage">
      {{ store.toastMessage }}
    </div>
  `,
};
