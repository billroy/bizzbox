"""
Manages channels and per-client ActivityManager instances.

Synced mode:  multiple channels, each with its own ActivityManager and Socket.IO room.
              Clients join one channel at a time; changes broadcast within that channel only.
Unsynced mode: each client sid gets its own ActivityManager instance (channels disabled).
"""
import time

from flask_socketio import join_room, leave_room
from .activity_manager import ActivityManager
from .event_emitter import EventEmitter
from .presentation import PresentationState, normalize_playlist, normalize_interval
from .presentation_store import PresentationStore


class ChannelState:
    """Per-channel runtime state — acts as the 'config' object for its ActivityManager."""

    def __init__(self, channel_id: int, config):
        self.channel_id = channel_id
        self.name = f"Channel {channel_id}"
        self.room = f"channel:{channel_id}"

        # Per-channel config (copied from startup defaults)
        self.style = config.style
        self.intensity = config.intensity
        self.sync_mode = "synced"       # channels are always synced within
        self.muted = config.muted
        self.grid_cols = config.grid_cols
        self.grid_rows = config.grid_rows
        self.fg_target = config.fg_target

        # ActivityManager for this channel (set after construction)
        self.manager: ActivityManager | None = None

        # Connected clients currently viewing this channel
        self.viewers: set[str] = set()
        self.presentation = PresentationState()


class SyncManager:
    def __init__(self, socketio, emitter: EventEmitter, config):
        self._sio = socketio
        self._emitter = emitter
        self._config = config
        self._presentation_store = (
            PresentationStore(config.presentation_state_path)
            if config.presentation_state_path else None
        )

        # ── Channel state (synced mode) ──────────────────────
        self._channels: dict[int, ChannelState] = {}
        self._next_channel_id: int = 0          # incremented before use
        self._sid_to_channel: dict[str, int] = {}
        self._total_clients: int = 0
        self._monitor_sids: set[str] = set()   # phantom-viewer-free monitors

        # ── Unsynced mode (unchanged) ────────────────────────
        self._client_managers: dict[str, ActivityManager] = {}
        # Text broadcast debounce: activity_id → monotonic timestamp
        self._text_last_broadcast: dict[str, float] = {}

        if config.sync_mode == "synced":
            self._create_channel()  # Channel 1
            self._restore_presentations()
            self._sio.start_background_task(self._presentation_loop)

    # ── Channel lifecycle ─────────────────────────────────────

    def _create_channel(self) -> ChannelState:
        """Create a new channel with random content and start its ActivityManager."""
        self._next_channel_id += 1
        cid = self._next_channel_id

        ch = ChannelState(cid, self._config)
        ch.manager = ActivityManager(
            self._sio, self._emitter, ch, room=ch.room
        )
        ch.manager.start()
        self._channels[cid] = ch
        return ch

    def create_channel_for_client(self, sid: str) -> int | None:
        """Create a new channel and switch the requesting client to it.
        Returns the new channel_id, or None if at max capacity."""
        if len(self._channels) >= self._config.max_channels:
            return None

        ch = self._create_channel()
        self._switch_client(sid, ch.channel_id)
        self._broadcast_channel_list()
        return ch.channel_id

    def switch_channel(self, sid: str, channel_id: int):
        """Switch a client to a different channel."""
        if channel_id not in self._channels:
            return
        current = self._sid_to_channel.get(sid)
        if current == channel_id:
            return  # already there
        if self.is_monitor(sid):
            self._switch_monitor(sid, channel_id)
        else:
            self._switch_client(sid, channel_id)
            self._broadcast_channel_list()

    def _switch_client(self, sid: str, new_channel_id: int):
        """Move a client from its current channel to a new one."""
        old_channel_id = self._sid_to_channel.get(sid)
        new_ch = self._channels[new_channel_id]

        # Leave old channel
        if old_channel_id is not None and old_channel_id in self._channels:
            old_ch = self._channels[old_channel_id]
            old_ch.viewers.discard(sid)
            leave_room(old_ch.room, sid=sid)
            # Broadcast updated viewer count to old channel
            self._emitter.emit_viewer_count(
                len(old_ch.viewers), self._total_clients, old_ch.room
            )

        # Join new channel
        new_ch.viewers.add(sid)
        join_room(new_ch.room, sid=sid)
        self._sid_to_channel[sid] = new_channel_id

        # Send channel switch confirmation
        self._emitter.emit_channel_switched(sid, new_ch.channel_id, new_ch.name)

        # Send full state for the new channel
        self._emitter.emit_sync_init(sid, self._full_channel_state(new_ch))

        # Broadcast updated viewer count to new channel
        self._emitter.emit_viewer_count(
            len(new_ch.viewers), self._total_clients, new_ch.room
        )

    def get_channel_list(self) -> list[dict]:
        """Return list of all channels with viewer counts, sorted by id."""
        return sorted(
            [
                {"id": ch.channel_id, "name": ch.name, "viewers": len(ch.viewers)}
                for ch in self._channels.values()
            ],
            key=lambda c: c["id"],
        )

    def _broadcast_channel_list(self):
        """Emit the full channel list to ALL connected clients."""
        self._emitter.emit_channel_list(
            self.get_channel_list(),
            self._total_clients,
            self._config.max_channels,
        )

    # ── Per-channel config setters ────────────────────────────

    def set_channel_style(self, sid: str, style: str):
        ch = self._get_channel_for_sid(sid)
        if ch:
            ch.style = style

    def set_channel_intensity(self, sid: str, value: int):
        ch = self._get_channel_for_sid(sid)
        if ch:
            ch.intensity = value

    def set_channel_mute(self, sid: str, muted: bool):
        ch = self._get_channel_for_sid(sid)
        if ch:
            ch.muted = muted

    def set_channel_layout(self, sid: str, cols: int, rows: int):
        ch = self._get_channel_for_sid(sid)
        if ch:
            ch.grid_cols = cols
            ch.grid_rows = rows

    def set_channel_fg_target(self, sid: str, value: int):
        ch = self._get_channel_for_sid(sid)
        if ch:
            ch.fg_target = value

    # ── Connection handlers ───────────────────────────────────

    def handle_connect(self, sid: str):
        self._total_clients += 1

        if self._config.sync_mode == "synced":
            # Join Channel 1 by default
            first_channel_id = min(self._channels.keys())
            ch = self._channels[first_channel_id]
            ch.viewers.add(sid)
            join_room(ch.room, sid=sid)
            self._sid_to_channel[sid] = first_channel_id

            # Send full state for this channel
            self._emitter.emit_sync_init(sid, self._full_channel_state(ch))

            # Broadcast viewer counts to the channel
            self._emitter.emit_viewer_count(
                len(ch.viewers), self._total_clients, ch.room
            )
            # Broadcast channel list to all
            self._broadcast_channel_list()
        else:
            # Unsynced: each client gets own manager in their own room (sid is also a room)
            manager = ActivityManager(
                self._sio, self._emitter, self._config, room=sid
            )
            self._client_managers[sid] = manager
            manager.start()
            state = manager.get_full_state()
            self._emitter.emit_sync_init(sid, state)
            self._emitter.emit_client_count(self._total_clients, room=sid)

    def handle_disconnect(self, sid: str):
        self._total_clients = max(0, self._total_clients - 1)

        if self._config.sync_mode == "synced":
            channel_id = self._sid_to_channel.pop(sid, None)
            if channel_id is not None and channel_id in self._channels:
                ch = self._channels[channel_id]
                ch.viewers.discard(sid)
                # Broadcast updated viewer count to that channel
                self._emitter.emit_viewer_count(
                    len(ch.viewers), self._total_clients, ch.room
                )
            # Broadcast channel list to all (viewer counts changed)
            self._broadcast_channel_list()
        else:
            manager = self._client_managers.pop(sid, None)
            if manager:
                manager.stop()
            self._emitter.emit_client_count(self._total_clients, room=sid)

    # ── Monitor mode (phantom-viewer-free) ───────────────────

    def is_monitor(self, sid: str) -> bool:
        """Return True if this sid is a monitor connection."""
        return sid in self._monitor_sids

    def handle_monitor_connect(self, sid: str):
        """Connect a monitor — joins channel 1 room without affecting viewer counts."""
        self._monitor_sids.add(sid)

        if self._config.sync_mode == "synced" and self._channels:
            first_channel_id = min(self._channels.keys())
            ch = self._channels[first_channel_id]
            join_room(ch.room, sid=sid)
            self._sid_to_channel[sid] = first_channel_id

            # Send full state for this channel
            self._emitter.emit_sync_init(sid, self._full_channel_state(ch))

            # Send channel list to monitor only
            self._sio.emit("channel:list", {
                "channels": self.get_channel_list(),
                "totalClients": self._total_clients,
                "maxChannels": self._config.max_channels,
            }, room=sid)

    def handle_monitor_disconnect(self, sid: str):
        """Disconnect a monitor — leaves room without affecting viewer counts."""
        self._monitor_sids.discard(sid)
        channel_id = self._sid_to_channel.pop(sid, None)
        if channel_id is not None and channel_id in self._channels:
            ch = self._channels[channel_id]
            leave_room(ch.room, sid=sid)

    def _switch_monitor(self, sid: str, new_channel_id: int):
        """Move a monitor to a different channel without affecting viewer counts."""
        old_channel_id = self._sid_to_channel.get(sid)
        new_ch = self._channels[new_channel_id]

        # Leave old room
        if old_channel_id is not None and old_channel_id in self._channels:
            old_ch = self._channels[old_channel_id]
            leave_room(old_ch.room, sid=sid)

        # Join new room
        join_room(new_ch.room, sid=sid)
        self._sid_to_channel[sid] = new_channel_id

        # Send channel switch confirmation + full state
        self._emitter.emit_channel_switched(sid, new_ch.channel_id, new_ch.name)
        self._emitter.emit_sync_init(sid, self._full_channel_state(new_ch))

    # ── Room / manager helpers ────────────────────────────────

    def _get_channel_for_sid(self, sid: str) -> ChannelState | None:
        """Look up the ChannelState for a connected client."""
        channel_id = self._sid_to_channel.get(sid)
        if channel_id is not None:
            return self._channels.get(channel_id)
        return None

    def _get_manager_for_sid(self, sid: str) -> ActivityManager | None:
        """Return the ActivityManager for the given client."""
        if self._config.sync_mode == "synced":
            ch = self._get_channel_for_sid(sid)
            return ch.manager if ch else None
        else:
            return self._client_managers.get(sid)

    def get_room_for_client(self, sid: str) -> str:
        """Return the effective emit room for a configure event from this sid."""
        if self._config.sync_mode == "synced":
            ch = self._get_channel_for_sid(sid)
            return ch.room if ch else "channel:1"
        return sid

    def _full_channel_state(self, channel: ChannelState, scene_applied: bool = False) -> dict:
        state = channel.manager.get_full_state()
        state["channel"] = {"id": channel.channel_id, "name": channel.name}
        state["presentation"] = channel.presentation.public_state(channel.channel_id)
        if scene_applied:
            state["scene_applied"] = True
        return state

    def _broadcast_presentation(self, channel: ChannelState):
        self._emitter.emit_presentation_state(
            channel.room, channel.presentation.public_state(channel.channel_id)
        )

    def _persist_presentation(self, channel: ChannelState):
        if not self._presentation_store:
            return
        if channel.presentation.active:
            self._presentation_store.save(
                channel.channel_id, channel.presentation.storage_state()
            )
        else:
            self._presentation_store.delete(channel.channel_id)

    def _restore_presentations(self):
        if not self._presentation_store:
            return
        now_monotonic = time.monotonic()
        now_epoch = time.time()
        for channel_id, stored in self._presentation_store.load_all().items():
            if channel_id < 1 or channel_id > self._config.max_channels:
                continue
            while self._next_channel_id < channel_id:
                self._create_channel()
            channel = self._channels[channel_id]
            if not channel.presentation.restore(stored, now_monotonic, now_epoch):
                self._presentation_store.delete(channel_id)
                continue
            scene = channel.presentation.playlist[channel.presentation.current_index]
            self._apply_scene_to_channel(channel, scene, emit=False)
            self._persist_presentation(channel)

    def _presentation_loop(self):
        while True:
            self.process_presentations()
            self._sio.sleep(0.05)

    def process_presentations(self, now_monotonic: float | None = None,
                              now_epoch: float | None = None):
        """Advance all channel presentations; explicit times make this deterministic in tests."""
        now_monotonic = time.monotonic() if now_monotonic is None else now_monotonic
        now_epoch = time.time() if now_epoch is None else now_epoch
        for channel in self._channels.values():
            action = channel.presentation.tick(now_monotonic, now_epoch)
            if action is None:
                continue
            action_type, scene = action
            if action_type == "scene" and scene is not None:
                self._apply_scene_to_channel(channel, scene)
            else:
                self._broadcast_presentation(channel)
            self._persist_presentation(channel)

    def start_presentation(self, sid: str, raw_scenes: object, interval_seconds,
                           filter_label: str = "all", if_inactive: bool = False) -> bool:
        channel = self._get_channel_for_sid(sid)
        if not channel or (if_inactive and channel.presentation.active):
            return False
        scenes = normalize_playlist(raw_scenes)
        if not scenes:
            return False
        scene = channel.presentation.start(
            scenes, normalize_interval(interval_seconds), filter_label,
            time.monotonic(), time.time(),
        )
        self._apply_scene_to_channel(channel, scene)
        self._persist_presentation(channel)
        return True

    def schedule_presentation(self, sid: str, interval_seconds) -> bool:
        channel = self._get_channel_for_sid(sid)
        if not channel or not channel.presentation.active:
            return False
        channel.presentation.schedule(interval_seconds, time.monotonic(), time.time())
        self._persist_presentation(channel)
        self._broadcast_presentation(channel)
        return True

    def stop_presentation(self, sid: str) -> bool:
        channel = self._get_channel_for_sid(sid)
        if not channel or not channel.presentation.active:
            return False
        channel.presentation.stop()
        self._persist_presentation(channel)
        self._broadcast_presentation(channel)
        return True

    # ── Operations (delegate to the correct ActivityManager) ──

    def move_window(self, sid: str, activity_id: str, position: dict):
        manager = self._get_manager_for_sid(sid)
        if manager:
            manager.move_window(activity_id, position)

    def replace_window(self, sid: str, activity_id: str, new_type: str = None):
        manager = self._get_manager_for_sid(sid)
        if manager:
            manager.replace_window(activity_id, new_type)

    def close_window(self, sid: str, activity_id: str):
        manager = self._get_manager_for_sid(sid)
        if manager:
            manager.close_window(activity_id)

    def randomize_all(self, sid: str):
        manager = self._get_manager_for_sid(sid)
        if manager:
            manager.randomize_all()

    def spawn_window(self, sid: str, activity_type: str = None):
        manager = self._get_manager_for_sid(sid)
        if manager:
            manager.spawn_foreground(activity_type)

    def set_fg_target(self, sid: str, target: int):
        manager = self._get_manager_for_sid(sid)
        if manager:
            manager.set_fg_target(target)

    def resize_window(self, sid: str, activity_id: str, size: dict, position: dict):
        manager = self._get_manager_for_sid(sid)
        if manager:
            manager.resize_window(activity_id, size, position)

    def set_layout(self, sid: str, cols: int, rows: int):
        manager = self._get_manager_for_sid(sid)
        if manager:
            manager.set_grid(cols, rows)

    def set_activity_filter(self, sid: str, allowed_types: list[str] | None):
        allowed = set(allowed_types) if allowed_types else None
        manager = self._get_manager_for_sid(sid)
        if manager:
            manager.set_activity_filter(allowed)

    def apply_scene(self, sid: str, style: str, intensity: int, cols: int,
                    rows: int, fg_target: int, allowed_types: set[str] | None,
                    slots: list[str], scene_meta: dict | None = None):
        """Apply scene configuration and replace its activities as one update."""
        manager = self._get_manager_for_sid(sid)
        if not manager:
            return
        channel = self._get_channel_for_sid(sid)
        scene_config = manager._config
        scene_config.style = style
        scene_config.intensity = intensity
        scene_config.grid_cols = cols
        scene_config.grid_rows = rows
        manager.apply_scene(cols, rows, fg_target, allowed_types, slots)
        if channel:
            if scene_meta and channel.presentation.active:
                for index, scene in enumerate(channel.presentation.playlist):
                    if scene.get("name") == scene_meta.get("name"):
                        channel.presentation.current_index = index
                        channel.presentation.next_index = (index + 1) % len(channel.presentation.playlist)
                        self._persist_presentation(channel)
                        break
            self._sio.emit("sync:init", self._full_channel_state(channel, True), room=manager._room)
        else:
            state = manager.get_full_state()
            state["scene_applied"] = True
            self._sio.emit("sync:init", state, room=manager._room)

    def _apply_scene_to_channel(self, channel: ChannelState, scene: dict, emit: bool = True):
        allowed = set(scene["filter"]) if scene.get("filter") else None
        manager = channel.manager
        channel.style = scene["style"]
        channel.intensity = scene["intensity"]
        channel.grid_cols = scene["cols"]
        channel.grid_rows = scene["rows"]
        manager.apply_scene(
            scene["cols"], scene["rows"], 0, allowed, scene.get("slots", [])
        )
        if emit:
            self._sio.emit(
                "sync:init", self._full_channel_state(channel, True), room=channel.room
            )

    def configure_slots(self, sid: str, slots: list[str]):
        manager = self._get_manager_for_sid(sid)
        if manager:
            manager.configure_slots(slots)

    def pin_slot(self, sid: str, slot: int, type_name: str):
        manager = self._get_manager_for_sid(sid)
        if manager:
            manager.pin_slot(slot, type_name)

    def unpin_slot(self, sid: str, slot: int):
        manager = self._get_manager_for_sid(sid)
        if manager:
            manager.unpin_slot(slot)

    def update_text(self, sid: str, activity_id: str, text: str):
        """Update text content for a Text activity and broadcast to channel."""
        manager = self._get_manager_for_sid(sid)
        if not manager:
            return
        state = manager.update_text_activity(activity_id, text, sid)
        if state is None:
            return
        # Debounce broadcasts: max 10 Hz per activity
        now = time.monotonic()
        last = self._text_last_broadcast.get(activity_id, 0)
        if now - last < 0.1:
            return
        self._text_last_broadcast[activity_id] = now
        room = self.get_room_for_client(sid)
        self._emitter.emit_update(room, activity_id, state, skip_sid=sid)
