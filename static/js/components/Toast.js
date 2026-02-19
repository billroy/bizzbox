/**
 * Transient on-screen toast notification.
 * Shows brief feedback for keyboard actions.
 */
import { store } from '../store.js';

export default {
  name: 'Toast',
  setup() {
    return { store };
  },
  template: `
    <div class="toast" v-if="store.toastMessage">
      {{ store.toastMessage }}
    </div>
  `,
};
