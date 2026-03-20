/**
 * Embed code generator — produces an <iframe> snippet for embedding BizzBox
 * in Notion, Confluence, dashboards, etc.
 */
import { store } from '../store.js';
import { buildConfigUrl } from '../configUrl.js';

export default {
  name: 'EmbedModal',
  setup() {
    const { ref, computed } = Vue;

    const width = ref(1280);
    const height = ref(720);
    const lockMode = ref(true);
    const muted = ref(true);
    const obsMode = ref(false);
    const startVol = ref(store.config.volume);

    const embedUrl = computed(() => {
      const base = buildConfigUrl();
      const url = new URL(base);
      // Clear muted/vol from base URL — embed modal manages these independently
      url.searchParams.delete('muted');
      url.searchParams.delete('vol');
      if (lockMode.value) url.searchParams.set('lock', '1');
      if (muted.value)    url.searchParams.set('muted', '1');
      if (obsMode.value)  url.searchParams.set('obs', '1');
      if (!muted.value && startVol.value !== 100) url.searchParams.set('vol', startVol.value);
      return url.toString();
    });

    const embedCode = computed(() =>
      `<iframe src="${embedUrl.value}" width="${width.value}" height="${height.value}" frameborder="0" allowfullscreen></iframe>`
    );

    function copyCode() {
      navigator.clipboard.writeText(embedCode.value).then(() => {
        import('../store.js').then(m => m.showToast('EMBED CODE COPIED'));
      }).catch(() => {
        window.prompt('Copy this embed code:', embedCode.value);
      });
    }

    function close() {
      store.embedModalOpen = false;
    }

    function onKey(evt) {
      if (evt.key === 'Escape') close();
    }

    return { width, height, lockMode, muted, obsMode, startVol, embedCode, copyCode, close, onKey };
  },
  template: `
    <div class="filter-overlay" @click.self="close" @keydown="onKey" tabindex="-1">
      <div class="filter-panel embed-panel">
        <div class="filter-title">EMBED CODE</div>

        <div class="embed-options">
          <div class="embed-row">
            <label class="embed-label">
              WIDTH
              <input class="embed-input" type="number" v-model.number="width" min="200" max="3840" step="10" />
            </label>
            <label class="embed-label">
              HEIGHT
              <input class="embed-input" type="number" v-model.number="height" min="150" max="2160" step="10" />
            </label>
          </div>
          <div class="embed-row">
            <label class="embed-check-label">
              <input type="checkbox" v-model="lockMode" /> Lock mode (hide controls)
            </label>
            <label class="embed-check-label">
              <input type="checkbox" v-model="muted" /> Muted
            </label>
            <label class="embed-check-label">
              <input type="checkbox" v-model="obsMode" /> Transparent background
            </label>
          </div>
          <div class="embed-row" v-if="!muted">
            <label class="embed-label">
              VOLUME
              <input class="header-vol" type="range" min="0" max="100" v-model.number="startVol" style="width:100px" />
              <span class="vol-label">{{ startVol }}%</span>
            </label>
          </div>
        </div>

        <textarea class="embed-code" readonly :value="embedCode" @focus="$event.target.select()"></textarea>

        <div class="embed-actions">
          <button class="header-btn" @click="copyCode">COPY</button>
        </div>

        <div class="filter-close" @click="close">CLOSE</div>
      </div>
    </div>
  `,
};
