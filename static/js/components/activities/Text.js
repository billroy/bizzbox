/**
 * Shared text pad — editable textarea synced across all channel viewers.
 */
import { store } from '../../store.js';
import { sendTextUpdate } from '../../socket.js';

export default {
  name: 'ActivityText',
  props: { activity: Object },
  setup(props) {
    const { ref, watch, computed, onUnmounted } = Vue;

    const localText = ref('');
    let debounceTimer = null;
    let suppressNextWatch = false;

    const readOnly = computed(() => store.lockMode);

    // Sync incoming server state → local (unless we just typed)
    watch(
      () => props.activity?.state?.text,
      (newText) => {
        if (suppressNextWatch) {
          suppressNextWatch = false;
          return;
        }
        if (newText != null) {
          localText.value = newText;
        }
      },
      { immediate: true }
    );

    function onInput(e) {
      localText.value = e.target.value;
      suppressNextWatch = true;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (props.activity?.id) {
          sendTextUpdate(props.activity.id, localText.value);
        }
      }, 300);
    }

    onUnmounted(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
    });

    return { localText, readOnly, onInput };
  },
  template: `
    <div class="activity-text">
      <textarea
        :value="localText"
        @input="onInput"
        :readonly="readOnly"
        placeholder="Type here..."
        spellcheck="false"
      ></textarea>
    </div>
  `,
};
