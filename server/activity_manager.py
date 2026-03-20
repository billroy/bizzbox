"""
Activity lifecycle engine.
Manages spawn/despawn/update cycles for one set of clients (either global synced,
or per-client in unsynced mode).
"""
import logging
import random
import math
import time
import uuid

logger = logging.getLogger(__name__)

from . import activity_registry as registry
from .event_emitter import EventEmitter

# Logical reference viewport (server normalizes positions to this)
REF_W = 1920
REF_H = 1080

# Foreground window size range as fraction of viewport
FG_SIZE_MIN = 0.25
FG_SIZE_MAX = 0.333

FADE_DURATION = 0.5   # seconds — must match client CSS
REPLACE_DELAY = 0.65  # slightly longer than fade so new activity spawns after old fades


class ActivityRecord:
    def __init__(self, generator, slot, is_foreground, position, size):
        self.id = generator.id
        self.generator = generator
        self.slot = slot                   # background slot index or None
        self.is_foreground = is_foreground
        self.position = position           # {x, y} in ref coords or None
        self.size = size                   # {w, h} in ref coords or None
        self.spawn_time = time.time()
        self.lifespan = max(5.0, random.gauss(120.0, 15.0))
        self.despawning = False
        self.last_update = time.time()
        self.next_update_interval = 0.0   # set on first tick
        self.last_state: dict | None = None  # cache of most-recently-emitted frame
        self.frame_count: int = 0          # counts frames for keyframe interval


class ActivityManager:
    def __init__(self, socketio, emitter: EventEmitter, config, room: str):
        self._sio = socketio
        self._emitter = emitter
        self._config = config
        self._room = room
        self._running = False

        # Grid-based background count from config
        self._grid_cols = config.grid_cols
        self._grid_rows = config.grid_rows
        self._bg_count = self._grid_cols * self._grid_rows
        self._fg_count = self._config.fg_target

        # Slot → activity_id mapping (None = empty)
        self._bg_slots: list[str | None] = [None] * self._bg_count
        # All live activities
        self._activities: dict[str, ActivityRecord] = {}
        # Pending replacements: (slot_or_None, is_foreground, replace_at_time)
        self._pending_replacements: list[tuple] = []
        # Pending closures (despawn without replacement): (old_id, remove_at)
        self._pending_closures: list[tuple] = []
        # Activity type filter (None = all allowed)
        self._allowed_types: set[str] | None = None
        # Pinned background slots: slot_index → activity type name
        self._pinned_slots: dict[int, str] = {}

    def _draw_update_interval(self) -> float:
        """Draw next update interval from N(2.5/intensity, ...), min 0.05s.

        At intensity 5 this yields ~2 Hz (0.5 s mean), which is sufficient for
        most data-display generators.  Client-side renderers interpolate between
        server frames, so visual smoothness is unaffected.  Individual generators
        can override via ``update_interval_override``.
        """
        intensity = max(1, self._config.intensity)
        mean = 2.5 / intensity
        sd = mean / 4.0
        return max(0.05, random.gauss(mean, sd))

    def _live_fg_count(self) -> int:
        """Count non-despawning foreground activities."""
        return sum(1 for rec in self._activities.values()
                   if rec.is_foreground and not rec.despawning)

    def _fg_geometry(self) -> tuple[dict, dict]:
        """Pick random foreground position/size in reference coords."""
        w_frac = random.uniform(FG_SIZE_MIN, FG_SIZE_MAX)
        h_frac = random.uniform(FG_SIZE_MIN, FG_SIZE_MAX)
        w = int(REF_W * w_frac)
        h = int(REF_H * h_frac)
        x = random.randint(0, REF_W - w)
        y = random.randint(0, REF_H - h)
        return {"x": x, "y": y}, {"w": w, "h": h}

    def _spawn_activity(self, slot: int | None, is_foreground: bool,
                        activity_type: str = None, position: dict = None, size: dict = None):
        """Create and register a new activity, emitting activity:spawn."""
        # Hard dedup for background slots: exclude types already visible.
        # Falls back to allowing duplicates if more slots than unique types.
        exclude = None
        if not is_foreground and activity_type is None:
            visible = {r.generator.activity_type for r in self._activities.values()
                       if not r.despawning}
            exclude = visible or None
        gen = registry.make_activity(activity_type=activity_type, intensity=self._config.intensity,
                                     allowed_types=self._allowed_types,
                                     exclude_types=exclude)
        if position is None or size is None:
            position, size = (self._fg_geometry() if is_foreground else (None, None))
        payload = gen.spawn_payload(slot=slot, is_foreground=is_foreground,
                                    position=position, size=size)
        rec = ActivityRecord(gen, slot, is_foreground, position, size)
        override = gen.update_interval_override
        rec.next_update_interval = override if override is not None else self._draw_update_interval()
        self._activities[gen.id] = rec
        if slot is not None:
            self._bg_slots[slot] = gen.id
        self._emitter.emit_spawn(self._room, payload)
        return rec

    def start(self):
        """Initial spawn of all activities and start the lifecycle loop."""
        # Spawn background activities
        for slot in range(self._bg_count):
            self._spawn_activity(slot, is_foreground=False)
        # Spawn foreground activities
        for _ in range(self._fg_count):
            self._spawn_activity(slot=None, is_foreground=True)
        self._running = True
        self._sio.start_background_task(self._loop)

    def stop(self):
        self._running = False

    def _loop(self):
        import gevent
        while self._running:
            now = time.time()
            self._process_replacements(now)
            self._process_closures(now)
            for act_id, rec in list(self._activities.items()):
                if rec.despawning:
                    continue
                # Update check
                if now - rec.last_update >= rec.next_update_interval:
                    try:
                        frame = rec.generator.next_frame()
                    except Exception:
                        logger.exception(
                            "Generator %s (%s) crashed in next_frame(); removing activity %s",
                            rec.generator.activity_type, type(rec.generator).__name__, act_id,
                        )
                        rec.despawning = True
                        self._emitter.emit_despawn(self._room, act_id)
                        self._activities.pop(act_id, None)
                        if rec.slot is not None and rec.slot < len(self._bg_slots):
                            self._bg_slots[rec.slot] = None
                        continue
                    rec.frame_count += 1
                    emit_state = frame  # default: full frame

                    # Try delta compression (skip every 30th frame = keyframe)
                    if rec.last_state and rec.frame_count % 30 != 0:
                        delta = rec.generator.compute_delta(rec.last_state, frame)
                        if delta is not None:
                            emit_state = delta

                    rec.last_state = frame
                    self._emitter.emit_update(self._room, act_id, emit_state)
                    rec.last_update = now
                    override = rec.generator.update_interval_override
                    rec.next_update_interval = override if override is not None else self._draw_update_interval()
                # Despawn check
                if now - rec.spawn_time >= rec.lifespan:
                    self._initiate_despawn(rec, now)
            gevent.sleep(0.033)  # ~30 Hz

    def _initiate_despawn(self, rec: ActivityRecord, now: float):
        rec.despawning = True
        self._emitter.emit_despawn(self._room, rec.id)
        replace_at = now + REPLACE_DELAY

        if rec.is_foreground:
            # Only auto-replace if we'd be below target after this despawn
            if self._live_fg_count() < self._config.fg_target:
                self._pending_replacements.append(
                    (rec.slot, rec.is_foreground, replace_at, rec.id, None, None, None)
                )
            else:
                self._pending_closures.append((rec.id, replace_at))
        else:
            # Background activities always get replaced; use pinned type if set
            pinned_type = self._pinned_slots.get(rec.slot)
            self._pending_replacements.append(
                (rec.slot, rec.is_foreground, replace_at, rec.id, pinned_type, None, None)
            )

    def _process_replacements(self, now: float):
        remaining = []
        for entry in self._pending_replacements:
            slot, is_fg, replace_at, old_id, explicit_type, pos, sz = entry
            if now >= replace_at:
                # Remove old activity from records
                self._activities.pop(old_id, None)
                if slot is not None:
                    self._bg_slots[slot] = None
                # Spawn replacement (with optional explicit type and geometry)
                self._spawn_activity(slot, is_fg, activity_type=explicit_type,
                                     position=pos, size=sz)
            else:
                remaining.append(entry)
        self._pending_replacements = remaining

    def _process_closures(self, now: float):
        remaining = []
        for old_id, remove_at in self._pending_closures:
            if now >= remove_at:
                self._activities.pop(old_id, None)
            else:
                remaining.append((old_id, remove_at))
        self._pending_closures = remaining

    def move_window(self, activity_id: str, position: dict):
        """Update stored position for a foreground window and broadcast the move."""
        rec = self._activities.get(activity_id)
        if rec and rec.is_foreground:
            # Clamp to reference viewport
            x = max(0, min(REF_W - 100, int(position.get("x", 0))))
            y = max(0, min(REF_H - 50,  int(position.get("y", 0))))
            rec.position = {"x": x, "y": y}
            self._emitter.broadcast_window_move(activity_id, rec.position, room=self._room)

    def replace_window(self, activity_id: str, new_type: str = None):
        """Replace an activity with a new one of the specified (or random) type,
        preserving slot, position, and size. Respects pinned slot types."""
        rec = self._activities.get(activity_id)
        if not rec or rec.despawning:
            return
        slot = rec.slot
        is_fg = rec.is_foreground
        pos = dict(rec.position) if rec.position else None
        sz = dict(rec.size) if rec.size else None

        # If no explicit type requested and slot is pinned, use pinned type
        effective_type = new_type
        if effective_type is None and slot is not None:
            effective_type = self._pinned_slots.get(slot)

        rec.despawning = True
        self._emitter.emit_despawn(self._room, rec.id)
        replace_at = time.time() + REPLACE_DELAY
        self._pending_replacements.append(
            (slot, is_fg, replace_at, rec.id, effective_type, pos, sz)
        )

    def close_window(self, activity_id: str):
        """Close a foreground window — despawn without replacement."""
        rec = self._activities.get(activity_id)
        if not rec or rec.despawning or not rec.is_foreground:
            return
        rec.despawning = True
        self._emitter.emit_despawn(self._room, rec.id)
        self._pending_closures.append((rec.id, time.time() + REPLACE_DELAY))

    def spawn_foreground(self, activity_type: str = None):
        """Spawn a new foreground window with random geometry."""
        self._spawn_activity(slot=None, is_foreground=True, activity_type=activity_type)

    def randomize_all(self):
        """Replace every activity with a new random type, preserving slot/position/size."""
        for rec in list(self._activities.values()):
            if not rec.despawning:
                self.replace_window(rec.id, None)

    def set_fg_target(self, target: int):
        """Set target foreground count. Spawn or close windows to match."""
        target = max(0, min(20, target))
        self._config.fg_target = target
        self._fg_count = target

        # Cancel any pending foreground replacements that would exceed target
        current = self._live_fg_count()
        pending_fg = sum(1 for r in self._pending_replacements if r[1] is True)
        if current + pending_fg > target:
            self._pending_replacements = [
                r for r in self._pending_replacements if not r[1]
            ]

        current = self._live_fg_count()
        if current > target:
            # Close excess windows (most recently spawned first)
            excess = current - target
            fg_recs = sorted(
                [r for r in self._activities.values()
                 if r.is_foreground and not r.despawning],
                key=lambda r: r.spawn_time,
                reverse=True
            )
            for rec in fg_recs[:excess]:
                self.close_window(rec.id)
        elif current < target:
            # Spawn additional windows
            for _ in range(target - current):
                self._spawn_activity(slot=None, is_foreground=True)

    def resize_window(self, activity_id: str, size: dict, position: dict):
        """Update stored size/position for a foreground window and broadcast."""
        rec = self._activities.get(activity_id)
        if rec and rec.is_foreground:
            w = max(200, min(REF_W, int(size.get("w", rec.size["w"]))))
            h = max(120, min(REF_H, int(size.get("h", rec.size["h"]))))
            x = max(0, min(REF_W - w, int(position.get("x", rec.position["x"]))))
            y = max(0, min(REF_H - h, int(position.get("y", rec.position["y"]))))
            rec.size = {"w": w, "h": h}
            rec.position = {"x": x, "y": y}
            self._emitter.broadcast_window_resize(
                activity_id, rec.size, rec.position, room=self._room
            )

    def set_grid(self, cols: int, rows: int):
        """Resize the background grid, despawning excess or spawning new slots."""
        new_count = cols * rows
        old_count = self._bg_count

        # Despawn activities in slots beyond the new count
        for slot_idx in range(new_count, old_count):
            act_id = self._bg_slots[slot_idx] if slot_idx < len(self._bg_slots) else None
            if act_id and act_id in self._activities:
                rec = self._activities[act_id]
                if not rec.despawning:
                    rec.despawning = True
                    self._emitter.emit_despawn(self._room, rec.id)
                    # Remove immediately (no replacement scheduled)
                    self._activities.pop(act_id, None)
            # Also remove any pending replacements/closures for removed slots
            self._pending_replacements = [
                r for r in self._pending_replacements
                if not (r[0] is not None and r[0] >= new_count)
            ]
            self._pending_closures = [
                (oid, t) for oid, t in self._pending_closures
                if oid != act_id
            ]

        # Resize the slots list
        if new_count > old_count:
            self._bg_slots = self._bg_slots[:old_count] + [None] * (new_count - old_count)
        else:
            self._bg_slots = self._bg_slots[:new_count]

        self._bg_count = new_count
        self._grid_cols = cols
        self._grid_rows = rows

        # Spawn activities for newly empty slots
        for slot_idx in range(old_count, new_count):
            self._spawn_activity(slot_idx, is_foreground=False)

    def update_text_activity(self, activity_id: str, text: str, sid: str) -> dict | None:
        """Update text for a text activity. Returns new state, or None if invalid."""
        rec = self._activities.get(activity_id)
        if rec is None or rec.generator.activity_type != "text":
            return None
        rec.generator.set_text(text, sid)
        state = rec.generator.next_frame()
        rec.last_state = state
        return state

    def pin_slot(self, slot: int, type_name: str):
        """Pin a background slot to always respawn with the given activity type."""
        self._pinned_slots[slot] = type_name

    def unpin_slot(self, slot: int):
        """Remove pin from a background slot."""
        self._pinned_slots.pop(slot, None)

    def set_activity_filter(self, allowed_types: set[str] | None, despawn: bool = True):
        """Set the activity type filter. None or empty set means all allowed.
        If despawn=True, immediately recycles background activities that don't
        match the new filter. Set despawn=False when restoring a client's saved
        prefs on join so we don't kill activities other clients are viewing."""
        self._allowed_types = allowed_types if allowed_types else None
        # Force-recycle background slots whose type isn't in the new allowed set
        if self._allowed_types and despawn:
            now = time.time()
            for act_id, rec in list(self._activities.items()):
                if rec.despawning or rec.is_foreground:
                    continue
                if rec.generator.activity_type not in self._allowed_types:
                    self._initiate_despawn(rec, now)

    def configure_slots(self, slots: list[str]):
        """Bulk-pin and replace all background slots with specified types.

        ``slots`` is a list where index = slot number, value = activity type name.
        Slots beyond current grid size are ignored.  Unknown types are skipped.
        """
        from server.activity_registry import REGISTRY
        # Pin each slot (skip unknown types)
        self._pinned_slots.clear()
        for i, type_name in enumerate(slots):
            if i < self._bg_count and type_name and type_name in REGISTRY:
                self._pinned_slots[i] = type_name

        # Replace background activities whose type doesn't match the pin
        for slot_idx in range(min(len(slots), self._bg_count)):
            if slot_idx not in self._pinned_slots:
                continue  # unknown type was skipped
            act_id = self._bg_slots[slot_idx]
            if act_id and act_id in self._activities:
                rec = self._activities[act_id]
                if not rec.despawning and rec.generator.activity_type != self._pinned_slots[slot_idx]:
                    self.replace_window(act_id, self._pinned_slots[slot_idx])

    def get_full_state(self) -> dict:
        """Return complete state for sync:init payload."""
        activities = []
        for rec in self._activities.values():
            if rec.despawning:
                continue
            activities.append({
                "id": rec.id,
                "type": rec.generator.activity_type,
                "title": rec.generator.title,
                "slot": rec.slot,
                "is_foreground": rec.is_foreground,
                "position": rec.position,
                "size": rec.size,
                "strategy": rec.generator.strategy,
                "state": rec.last_state if rec.last_state is not None else rec.generator.initial_payload(),
            })
        return {
            "session": {
                "style": self._config.style,
                "intensity": self._config.intensity,
                "sync_mode": self._config.sync_mode,
                "muted": self._config.muted,
            },
            "layout": {
                "background_count": self._bg_count,
                "foreground_count": self._fg_count,
                "fg_target": self._config.fg_target,
                "grid_cols": self._grid_cols,
                "grid_rows": self._grid_rows,
            },
            "activities": activities,
            "pinned_slots": {str(k): v for k, v in self._pinned_slots.items()},
        }
