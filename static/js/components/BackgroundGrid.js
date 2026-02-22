/**
 * Fixed tiled background grid layout with slot pinning support.
 */
import { store, getBackgroundSlots, pinSlot, unpinSlot, showToast } from '../store.js';
import { sendPinSlot, sendUnpinSlot } from '../socket.js';
import { ACTIVITY_TYPES } from '../activityTypes.js';
import { copyConfigUrl } from '../configUrl.js';
import ActivityWindow from './ActivityWindow.js';

export default {
  name: 'BackgroundGrid',
  components: { ActivityWindow },
  setup() {
    const { computed, ref } = Vue;
    const gridStyle = computed(() => {
      if (!store.grid) return {};
      return {
        gridTemplateColumns: store.grid.gridTemplateColumns,
        gridTemplateRows:    store.grid.gridTemplateRows,
      };
    });
    const slots = computed(() => getBackgroundSlots());

    // Context menu state
    const ctxMenu = ref({ visible: false, x: 0, y: 0, slotIndex: null });
    const activityTypes = ACTIVITY_TYPES;

    function onSlotContextMenu(evt, slotIndex) {
      if (store.lockMode) return;
      evt.preventDefault();
      ctxMenu.value = {
        visible: true,
        x: evt.clientX,
        y: evt.clientY,
        slotIndex,
      };
      // Close on next click anywhere
      setTimeout(() => {
        window.addEventListener('pointerdown', closeCtxMenu, { once: true });
      }, 0);
    }

    function closeCtxMenu() {
      ctxMenu.value.visible = false;
    }

    function pinToType(type) {
      const slot = ctxMenu.value.slotIndex;
      if (slot === null) return;
      pinSlot(slot, type);
      sendPinSlot(slot, type);
      closeCtxMenu();
    }

    function unpinSlotAction() {
      const slot = ctxMenu.value.slotIndex;
      if (slot === null) return;
      unpinSlot(slot);
      sendUnpinSlot(slot);
      closeCtxMenu();
    }

    function isPinned(slotIndex) {
      return store.pinnedSlots[slotIndex] !== undefined;
    }

    function pinnedType(slotIndex) {
      return store.pinnedSlots[slotIndex] || '';
    }

    function copyLink() {
      copyConfigUrl().then(() => showToast('CONFIG URL COPIED'));
      closeCtxMenu();
    }

    return { gridStyle, slots, store, ctxMenu, activityTypes, onSlotContextMenu, pinToType, unpinSlotAction, isPinned, pinnedType, copyLink };
  },
  template: `
    <div class="background-grid" :style="gridStyle">
      <div
        v-for="{ slot, activity } in slots"
        :key="slot.index"
        class="bg-slot"
        :class="{ 'bg-slot--empty': !activity || !slot.active, 'bg-slot--pinned': isPinned(slot.index) }"
        @contextmenu="(evt) => onSlotContextMenu(evt, slot.index)"
      >
        <ActivityWindow v-if="activity" :activity="activity" :key="activity.id" />
        <div v-if="isPinned(slot.index)" class="pin-indicator" :title="'Pinned: ' + pinnedType(slot.index)">&#x1F4CC;</div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="ctxMenu.visible"
        class="slot-ctx-menu"
        :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
      >
        <div class="ctx-menu-title">PIN SLOT</div>
        <div class="ctx-menu-scroll">
          <div
            v-for="t in activityTypes"
            :key="t"
            class="ctx-menu-item"
            @pointerdown.stop="pinToType(t)"
          >{{ t.toUpperCase().replace(/_/g, ' ') }}</div>
        </div>
        <div
          v-if="isPinned(ctxMenu.slotIndex)"
          class="ctx-menu-item ctx-menu-unpin"
          @pointerdown.stop="unpinSlotAction()"
        >UNPIN</div>
        <div class="ctx-menu-item ctx-menu-link"
             @pointerdown.stop="copyLink()"
        >COPY CONFIG LINK</div>
      </div>
    </Teleport>
  `,
};
