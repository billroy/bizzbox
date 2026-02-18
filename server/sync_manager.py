"""
Manages per-client vs. shared ActivityManager instances based on sync mode.

Synced mode:  one global ActivityManager, all clients in room "broadcast"
Unsynced mode: each client sid gets its own ActivityManager instance
"""
from flask_socketio import join_room
from .activity_manager import ActivityManager
from .event_emitter import EventEmitter


class SyncManager:
    def __init__(self, socketio, emitter: EventEmitter, config):
        self._sio = socketio
        self._emitter = emitter
        self._config = config
        self._client_count = 0

        # Synced mode: single global manager
        self._global_manager: ActivityManager | None = None
        # Unsynced mode: per-sid managers
        self._client_managers: dict[str, ActivityManager] = {}

        if config.sync_mode == "synced":
            self._init_global()

    def _init_global(self):
        self._global_manager = ActivityManager(
            self._sio, self._emitter, self._config, room="broadcast"
        )
        self._global_manager.start()

    def handle_connect(self, sid: str):
        self._client_count += 1

        if self._config.sync_mode == "synced":
            # Add client to broadcast room (must be called within Flask-SocketIO request context)
            join_room("broadcast")
            # Send current state to just this client
            state = self._global_manager.get_full_state()
            self._emitter.emit_sync_init(sid, state)
        else:
            # Unsynced: each client gets own manager in their own room (sid is also a room)
            manager = ActivityManager(
                self._sio, self._emitter, self._config, room=sid
            )
            self._client_managers[sid] = manager
            manager.start()
            state = manager.get_full_state()
            self._emitter.emit_sync_init(sid, state)

        # Broadcast updated client count
        self._emitter.emit_client_count(
            self._client_count,
            room="broadcast" if self._config.sync_mode == "synced" else sid
        )

    def handle_disconnect(self, sid: str):
        self._client_count = max(0, self._client_count - 1)

        if self._config.sync_mode == "unsynced":
            manager = self._client_managers.pop(sid, None)
            if manager:
                manager.stop()

        # Mirror handle_connect: broadcast updated count to remaining clients
        room = "broadcast" if self._config.sync_mode == "synced" else sid
        self._emitter.emit_client_count(self._client_count, room=room)

    def get_room_for_client(self, sid: str) -> str:
        """Return the effective emit room for a configure event from this sid."""
        if self._config.sync_mode == "synced":
            return "broadcast"
        return sid

    def move_window(self, sid: str, activity_id: str, position: dict):
        """Handle a window:move event — update position in the appropriate manager."""
        if self._config.sync_mode == "synced":
            if self._global_manager:
                self._global_manager.move_window(activity_id, position)
        else:
            manager = self._client_managers.get(sid)
            if manager:
                manager.move_window(activity_id, position)

    def replace_window(self, sid: str, activity_id: str, new_type: str = None):
        """Handle a window:replace event — replace activity type in the appropriate manager."""
        if self._config.sync_mode == "synced":
            if self._global_manager:
                self._global_manager.replace_window(activity_id, new_type)
        else:
            manager = self._client_managers.get(sid)
            if manager:
                manager.replace_window(activity_id, new_type)

    def close_window(self, sid: str, activity_id: str):
        """Handle a window:close event — despawn without replacement."""
        if self._config.sync_mode == "synced":
            if self._global_manager:
                self._global_manager.close_window(activity_id)
        else:
            manager = self._client_managers.get(sid)
            if manager:
                manager.close_window(activity_id)

    def spawn_window(self, sid: str, activity_type: str = None):
        """Handle a window:spawn event — spawn a new foreground window."""
        if self._config.sync_mode == "synced":
            if self._global_manager:
                self._global_manager.spawn_foreground(activity_type)
        else:
            manager = self._client_managers.get(sid)
            if manager:
                manager.spawn_foreground(activity_type)

    def set_fg_target(self, sid: str, target: int):
        """Handle a configure:fg_count event — adjust foreground window count."""
        if self._config.sync_mode == "synced":
            if self._global_manager:
                self._global_manager.set_fg_target(target)
        else:
            manager = self._client_managers.get(sid)
            if manager:
                manager.set_fg_target(target)

    def resize_window(self, sid: str, activity_id: str, size: dict, position: dict):
        """Handle a window:resize event — update size/position in the appropriate manager."""
        if self._config.sync_mode == "synced":
            if self._global_manager:
                self._global_manager.resize_window(activity_id, size, position)
        else:
            manager = self._client_managers.get(sid)
            if manager:
                manager.resize_window(activity_id, size, position)

    def set_layout(self, sid: str, cols: int, rows: int):
        """Handle a configure:layout event — resize grid in the appropriate manager."""
        if self._config.sync_mode == "synced":
            if self._global_manager:
                self._global_manager.set_grid(cols, rows)
        else:
            manager = self._client_managers.get(sid)
            if manager:
                manager.set_grid(cols, rows)
