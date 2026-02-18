/**
 * Floating foreground windows layer — absolutely positioned over the grid.
 * Windows are draggable; drags are broadcast to all connected clients via
 * the window:move socket event.
 */
import { store, getForegroundActivities, moveActivity } from '../store.js';
import { scalePosition } from '../layout.js';
import { sendWindowMove } from '../socket.js';
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
    // We track a single drag at a time.
    let drag = null;   // { id, startMouseX, startMouseY, startRefX, startRefY }

    function onTitlebarPointerDown(evt, act) {
      if (!act.position) return;
      // Only primary button
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

      // Capture on the window so mouse-out of element still tracks
      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup',   onPointerUp);
    }

    function onPointerMove(evt) {
      if (!drag) return;
      evt.preventDefault();

      const dx = evt.clientX - drag.startMouseX;
      const dy = evt.clientY - drag.startMouseY;

      // Convert pixel delta to reference coords (1920×1080)
      const scaleX = 1920 / window.innerWidth;
      const scaleY = 1080 / window.innerHeight;
      const refX = Math.round(drag.startRefX + dx * scaleX);
      const refY = Math.round(drag.startRefY + dy * scaleY);

      // Update store immediately for smooth local rendering
      moveActivity(drag.id, { x: refX, y: refY });

      // Throttle socket emits (~30 Hz max)
      const now = Date.now();
      if (!drag.lastEmit || now - drag.lastEmit >= 33) {
        sendWindowMove(drag.id, { x: refX, y: refY });
        drag.lastEmit = now;
      }
    }

    function onPointerUp(evt) {
      if (!drag) return;
      // Final position emit
      const dx = evt.clientX - drag.startMouseX;
      const dy = evt.clientY - drag.startMouseY;
      const scaleX = 1920 / window.innerWidth;
      const scaleY = 1080 / window.innerHeight;
      const refX = Math.round(drag.startRefX + dx * scaleX);
      const refY = Math.round(drag.startRefY + dy * scaleY);
      moveActivity(drag.id, { x: refX, y: refY });
      sendWindowMove(drag.id, { x: refX, y: refY });

      drag = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup',   onPointerUp);
    }

    return { activities, windowStyle, onTitlebarPointerDown };
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
      </div>
    </div>
  `,
};
