/**
 * Floating foreground windows layer — absolutely positioned over the grid.
 * Windows are draggable (via titlebar) and resizable (via edge/corner handles).
 * Both operations are broadcast to all connected clients via socket events.
 */
import { store, getForegroundActivities, moveActivity, resizeActivity } from '../store.js';
import { scalePosition } from '../layout.js';
import { sendWindowMove, sendWindowResize } from '../socket.js';
import ActivityWindow from './ActivityWindow.js';

export default {
  name: 'ForegroundLayer',
  components: { ActivityWindow },
  setup() {
    const { computed } = Vue;
    const activities = computed(() => getForegroundActivities());

    function windowStyle(act) {
      if (!act.position || !act.size) return {};
      return scalePosition(act.position, act.size);
    }

    // ── Drag state ─────────────────────────────────────────────
    let drag = null;

    function onTitlebarPointerDown(evt, act) {
      if (store.lockMode) return;
      if (!act.position) return;
      if (evt.button !== 0) return;
      evt.preventDefault();
      evt.stopPropagation();

      drag = {
        id: act.id,
        startMouseX: evt.clientX,
        startMouseY: evt.clientY,
        startRefX:   act.position.x,
        startRefY:   act.position.y,
      };

      window.addEventListener('pointermove', onDragMove, { passive: false });
      window.addEventListener('pointerup',   onDragUp);
    }

    function onDragMove(evt) {
      if (!drag) return;
      evt.preventDefault();

      const dx = evt.clientX - drag.startMouseX;
      const dy = evt.clientY - drag.startMouseY;
      const scaleX = 1920 / window.innerWidth;
      const scaleY = 1080 / window.innerHeight;
      const refX = Math.round(drag.startRefX + dx * scaleX);
      const refY = Math.round(drag.startRefY + dy * scaleY);

      moveActivity(drag.id, { x: refX, y: refY });

      const now = Date.now();
      if (!drag.lastEmit || now - drag.lastEmit >= 33) {
        sendWindowMove(drag.id, { x: refX, y: refY });
        drag.lastEmit = now;
      }
    }

    function onDragUp(evt) {
      if (!drag) return;
      const dx = evt.clientX - drag.startMouseX;
      const dy = evt.clientY - drag.startMouseY;
      const scaleX = 1920 / window.innerWidth;
      const scaleY = 1080 / window.innerHeight;
      const refX = Math.round(drag.startRefX + dx * scaleX);
      const refY = Math.round(drag.startRefY + dy * scaleY);
      moveActivity(drag.id, { x: refX, y: refY });
      sendWindowMove(drag.id, { x: refX, y: refY });

      drag = null;
      window.removeEventListener('pointermove', onDragMove);
      window.removeEventListener('pointerup',   onDragUp);
    }

    // ── Resize state ───────────────────────────────────────────
    let resize = null;

    function onResizePointerDown(evt, act, handle) {
      if (store.lockMode) return;
      if (!act.position || !act.size) return;
      if (evt.button !== 0) return;
      evt.preventDefault();
      evt.stopPropagation();

      resize = {
        id: act.id,
        handle,
        startMouseX: evt.clientX,
        startMouseY: evt.clientY,
        startRefX: act.position.x,
        startRefY: act.position.y,
        startRefW: act.size.w,
        startRefH: act.size.h,
      };

      window.addEventListener('pointermove', onResizeMove, { passive: false });
      window.addEventListener('pointerup',   onResizeUp);
    }

    function computeResize(evt) {
      const dx = evt.clientX - resize.startMouseX;
      const dy = evt.clientY - resize.startMouseY;
      const scaleX = 1920 / window.innerWidth;
      const scaleY = 1080 / window.innerHeight;
      const dRefX = Math.round(dx * scaleX);
      const dRefY = Math.round(dy * scaleY);

      let x = resize.startRefX;
      let y = resize.startRefY;
      let w = resize.startRefW;
      let h = resize.startRefH;
      const handle = resize.handle;

      // East edge: grow/shrink width
      if (handle.includes('e')) w += dRefX;
      // West edge: move x and shrink width
      if (handle.includes('w')) { x += dRefX; w -= dRefX; }
      // South edge: grow/shrink height
      if (handle.includes('s')) h += dRefY;
      // North edge: move y and shrink height
      if (handle.includes('n')) { y += dRefY; h -= dRefY; }

      // Enforce minimums
      if (w < 200) {
        if (handle.includes('w')) x = resize.startRefX + resize.startRefW - 200;
        w = 200;
      }
      if (h < 120) {
        if (handle.includes('n')) y = resize.startRefY + resize.startRefH - 120;
        h = 120;
      }

      return { x, y, w, h };
    }

    function onResizeMove(evt) {
      if (!resize) return;
      evt.preventDefault();

      const { x, y, w, h } = computeResize(evt);
      resizeActivity(resize.id, { w, h }, { x, y });

      const now = Date.now();
      if (!resize.lastEmit || now - resize.lastEmit >= 33) {
        sendWindowResize(resize.id, { w, h }, { x, y });
        resize.lastEmit = now;
      }
    }

    function onResizeUp(evt) {
      if (!resize) return;
      const { x, y, w, h } = computeResize(evt);
      resizeActivity(resize.id, { w, h }, { x, y });
      sendWindowResize(resize.id, { w, h }, { x, y });

      resize = null;
      window.removeEventListener('pointermove', onResizeMove);
      window.removeEventListener('pointerup',   onResizeUp);
    }

    return { activities, windowStyle, onTitlebarPointerDown, onResizePointerDown };
  },
  template: `
    <div class="foreground-layer">
      <div
        v-for="act in activities"
        :key="act.id"
        class="foreground-window"
        :style="windowStyle(act)"
      >
        <ActivityWindow
          :activity="act"
          @titlebar-pointerdown="(evt) => onTitlebarPointerDown(evt, act)"
        />
        <div class="resize-handle corner-se" @pointerdown.stop.prevent="(evt) => onResizePointerDown(evt, act, 'se')"></div>
        <div class="resize-handle corner-sw" @pointerdown.stop.prevent="(evt) => onResizePointerDown(evt, act, 'sw')"></div>
        <div class="resize-handle corner-ne" @pointerdown.stop.prevent="(evt) => onResizePointerDown(evt, act, 'ne')"></div>
        <div class="resize-handle corner-nw" @pointerdown.stop.prevent="(evt) => onResizePointerDown(evt, act, 'nw')"></div>
        <div class="resize-handle edge-e"  @pointerdown.stop.prevent="(evt) => onResizePointerDown(evt, act, 'e')"></div>
        <div class="resize-handle edge-w"  @pointerdown.stop.prevent="(evt) => onResizePointerDown(evt, act, 'w')"></div>
        <div class="resize-handle edge-s"  @pointerdown.stop.prevent="(evt) => onResizePointerDown(evt, act, 's')"></div>
        <div class="resize-handle edge-n"  @pointerdown.stop.prevent="(evt) => onResizePointerDown(evt, act, 'n')"></div>
      </div>
    </div>
  `,
};
