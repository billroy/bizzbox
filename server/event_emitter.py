"""Centralized SocketIO emit helpers — nothing else calls socketio.emit directly."""


class EventEmitter:
    def __init__(self, socketio):
        self._sio = socketio

    def emit_spawn(self, room: str, payload: dict):
        self._sio.emit("activity:spawn", payload, room=room)

    def emit_update(self, room: str, activity_id: str, state: dict):
        self._sio.emit("activity:update", {"id": activity_id, "state": state}, room=room)

    def emit_despawn(self, room: str, activity_id: str):
        self._sio.emit("activity:despawn", {"id": activity_id}, room=room)

    def emit_sync_init(self, sid: str, payload: dict):
        self._sio.emit("sync:init", payload, room=sid)

    def broadcast_style(self, style: str, room: str = "broadcast"):
        self._sio.emit("configure:style", {"style": style}, room=room)

    def broadcast_intensity(self, value: int, room: str = "broadcast"):
        self._sio.emit("configure:intensity", {"value": value}, room=room)

    def broadcast_mute(self, muted: bool, room: str = "broadcast"):
        self._sio.emit("configure:mute", {"muted": muted}, room=room)

    def broadcast_sync(self, mode: str, room: str = "broadcast"):
        self._sio.emit("configure:sync", {"mode": mode}, room=room)

    def emit_client_count(self, count: int, room: str = "broadcast"):
        self._sio.emit("client:connect", {"count": count}, room=room)

    def broadcast_window_move(self, activity_id: str, position: dict, room: str = "broadcast"):
        self._sio.emit("window:move", {"id": activity_id, "position": position}, room=room)

    def broadcast_window_resize(self, activity_id: str, size: dict, position: dict, room: str = "broadcast"):
        self._sio.emit("window:resize", {"id": activity_id, "size": size, "position": position}, room=room)

    def broadcast_layout(self, cols: int, rows: int, room: str = "broadcast"):
        self._sio.emit("configure:layout", {"cols": cols, "rows": rows}, room=room)
