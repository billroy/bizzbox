"""
Activity lifecycle engine.
Manages spawn/despawn/update cycles for one set of clients (either global synced,
or per-client in unsynced mode).
"""
import random
import math
import time
import uuid

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
        self.lifespan = max(5.0, random.gauss(30.0, 15.0))
        self.despawning = False
        self.last_update = time.time()
        self.next_update_interval = 0.0   # set on first tick
        self.last_state: dict = {}         # cache of most-recently-emitted frame


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
        self._fg_count = max(0, random.randint(5, 10) - self._bg_count)

        # Slot → activity_id mapping (None = empty)
        self._bg_slots: list[str | None] = [None] * self._bg_count
        # All live activities
        self._activities: dict[str, ActivityRecord] = {}
        # Pending replacements: (slot_or_None, is_foreground, replace_at_time)
        self._pending_replacements: list[tuple] = []

    def _draw_update_interval(self) -> float:
        """Draw next update interval from N(1/intensity, 1/(intensity*4)), min 0.05s."""
        intensity = max(1, self._config.intensity)
        mean = 1.0 / intensity
        sd = mean / 4.0
        return max(0.05, random.gauss(mean, sd))

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
        gen = registry.make_activity(activity_type=activity_type, intensity=self._config.intensity)
        if position is None or size is None:
            position, size = (self._fg_geometry() if is_foreground else (None, None))
        payload = gen.spawn_payload(slot=slot, is_foreground=is_foreground,
                                    position=position, size=size)
        rec = ActivityRecord(gen, slot, is_foreground, position, size)
        rec.next_update_interval = self._draw_update_interval()
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
        import eventlet
        while self._running:
            now = time.time()
            self._process_replacements(now)
            for act_id, rec in list(self._activities.items()):
                if rec.despawning:
                    continue
                # Update check
                if now - rec.last_update >= rec.next_update_interval:
                    frame = rec.generator.next_frame()
                    rec.last_state = frame
                    self._emitter.emit_update(self._room, act_id, frame)
                    rec.last_update = now
                    rec.next_update_interval = self._draw_update_interval()
                # Despawn check
                if now - rec.spawn_time >= rec.lifespan:
                    self._initiate_despawn(rec, now)
            eventlet.sleep(0.033)  # ~30 Hz

    def _initiate_despawn(self, rec: ActivityRecord, now: float):
        rec.despawning = True
        self._emitter.emit_despawn(self._room, rec.id)
        # Schedule replacement after fade completes
        # Tuple: (slot, is_fg, replace_at, old_id, explicit_type, position, size)
        replace_at = now + REPLACE_DELAY
        self._pending_replacements.append(
            (rec.slot, rec.is_foreground, replace_at, rec.id, None, None, None)
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
        preserving slot, position, and size."""
        rec = self._activities.get(activity_id)
        if not rec or rec.despawning:
            return
        slot = rec.slot
        is_fg = rec.is_foreground
        pos = dict(rec.position) if rec.position else None
        sz = dict(rec.size) if rec.size else None

        rec.despawning = True
        self._emitter.emit_despawn(self._room, rec.id)
        replace_at = time.time() + REPLACE_DELAY
        self._pending_replacements.append(
            (slot, is_fg, replace_at, rec.id, new_type, pos, sz)
        )

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
            # Also remove any pending replacements for removed slots
            self._pending_replacements = [
                r for r in self._pending_replacements
                if not (r[0] is not None and r[0] >= new_count)
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
                "state": rec.last_state or rec.generator.initial_payload(),
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
                "grid_cols": self._grid_cols,
                "grid_rows": self._grid_rows,
            },
            "activities": activities,
        }
