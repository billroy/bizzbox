"""
BizzBox — Flask/SocketIO server entry point.
Parses CLI args, sets up Flask-SocketIO, handles all socket events.
"""
import argparse
import os
import secrets
import time

import gevent.monkey
gevent.monkey.patch_all()

from flask import Flask, render_template, redirect, request
from flask_socketio import SocketIO

from server.config import AppConfig
from server.event_emitter import EventEmitter
from server.sync_manager import SyncManager
from server.scene_slugs import SCENE_SLUGS


def _safe_int(val, default: int) -> int:
    """Convert val to int, returning default on failure."""
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


# ── Per-SID token-bucket rate limiter ──────────────────────
_rate_buckets: dict[str, dict] = {}  # sid → {tokens, last_refill}

RATE_LIMIT = {
    "default":           (20, 20),   # (bucket_size, refill_per_sec)
    "configure:slots":   (2,  1),
    "window:randomize":  (3,  1),
    "channel:create":    (2,  0.5),
    "text:update":       (10, 10),
}


def _check_rate(sid: str, event: str) -> bool:
    """Return True if the event is allowed, False if rate-limited."""
    size, rate = RATE_LIMIT.get(event, RATE_LIMIT["default"])
    now = time.monotonic()
    b = _rate_buckets.setdefault(sid, {"tokens": size, "last": now})
    elapsed = now - b["last"]
    b["tokens"] = min(size, b["tokens"] + elapsed * rate)
    b["last"] = now
    if b["tokens"] >= 1:
        b["tokens"] -= 1
        return True
    return False


def _cleanup_rate_bucket(sid: str):
    """Remove rate-limit state for a disconnected client."""
    _rate_buckets.pop(sid, None)


def create_app(config: AppConfig):
    app = Flask(__name__)
    secret = os.environ.get("SECRET_KEY")
    if not secret:
        secret = secrets.token_hex(32)
        print("⚠️  SECRET_KEY not set — using random per-process key")
    app.config["SECRET_KEY"] = secret
    app.config["TEMPLATES_AUTO_RELOAD"] = True
    app.jinja_env.auto_reload = True

    socketio = SocketIO(
        app,
        async_mode="gevent",
        cors_allowed_origins="*",
        logger=False,
        engineio_logger=False,
    )

    emitter = EventEmitter(socketio)
    sync_manager = SyncManager(socketio, emitter, config)

    @app.route("/<slug>")
    def scene_vanity(slug):
        scene_name = SCENE_SLUGS.get(slug.lower())
        if scene_name:
            qs = request.query_string.decode()
            sep = "&" if qs else ""
            return redirect(f"/?scene={scene_name}{sep}{qs}", code=302)
        return render_template("index.html")

    @app.route("/")
    def index():
        return render_template("index.html")

    @socketio.on("connect")
    def on_connect(auth=None):
        from flask import request
        if request.args.get("monitor") == "true":
            sync_manager.handle_monitor_connect(request.sid)
        else:
            sync_manager.handle_connect(request.sid)

    @socketio.on("disconnect")
    def on_disconnect():
        from flask import request
        _cleanup_rate_bucket(request.sid)
        if sync_manager.is_monitor(request.sid):
            sync_manager.handle_monitor_disconnect(request.sid)
        else:
            sync_manager.handle_disconnect(request.sid)

    # ── Channel events ────────────────────────────────────────

    @socketio.on("channel:create")
    def on_channel_create(data=None):
        from flask import request
        if not _check_rate(request.sid, "channel:create"):
            return
        sync_manager.create_channel_for_client(request.sid)

    @socketio.on("channel:switch")
    def on_channel_switch(data):
        from flask import request
        channel_id = _safe_int(data.get("channelId"), 1)
        sync_manager.switch_channel(request.sid, channel_id)

    # ── Configure events ──────────────────────────────────────

    @socketio.on("configure:style")
    def on_style(data):
        from flask import request
        style = data.get("style", "dark")
        sync_manager.set_channel_style(request.sid, style)
        room = sync_manager.get_room_for_client(request.sid)
        emitter.broadcast_style(style, room=room)

    @socketio.on("configure:intensity")
    def on_intensity(data):
        from flask import request
        value = max(1, min(20, _safe_int(data.get("value"), 5)))
        sync_manager.set_channel_intensity(request.sid, value)
        room = sync_manager.get_room_for_client(request.sid)
        emitter.broadcast_intensity(value, room=room)

    @socketio.on("configure:mute")
    def on_mute(data):
        from flask import request
        muted = bool(data.get("muted", False))
        sync_manager.set_channel_mute(request.sid, muted)
        room = sync_manager.get_room_for_client(request.sid)
        emitter.broadcast_mute(muted, room=room)

    @socketio.on("configure:sync")
    def on_sync(data):
        # Sync mode changes are informational only at runtime (mode is set at startup)
        pass

    @socketio.on("configure:layout")
    def on_layout(data):
        from flask import request
        cols = max(1, min(10, _safe_int(data.get("cols"), 6)))
        rows = max(1, min(10, _safe_int(data.get("rows"), 4)))
        sync_manager.set_channel_layout(request.sid, cols, rows)
        room = sync_manager.get_room_for_client(request.sid)
        sync_manager.set_layout(request.sid, cols, rows)
        emitter.broadcast_layout(cols, rows, room=room)

    @socketio.on("configure:fg_count")
    def on_fg_count(data):
        from flask import request
        value = max(0, min(20, _safe_int(data.get("value"), 0)))
        sync_manager.set_channel_fg_target(request.sid, value)
        room = sync_manager.get_room_for_client(request.sid)
        sync_manager.set_fg_target(request.sid, value)
        emitter.broadcast_fg_target(value, room=room)

    @socketio.on("configure:activity_filter")
    def on_activity_filter(data):
        from flask import request
        allowed = data.get("allowed")  # list of type names or None
        sync_manager.set_activity_filter(request.sid, allowed)

    @socketio.on("configure:slots")
    def on_configure_slots(data):
        from flask import request
        if not _check_rate(request.sid, "configure:slots"):
            return
        slots = data.get("slots")  # list of type_name strings, indexed by slot
        if slots and isinstance(slots, list):
            if len(slots) > 500:
                return
            sync_manager.configure_slots(request.sid, slots)

    @socketio.on("text:update")
    def on_text_update(data):
        from flask import request
        if not _check_rate(request.sid, "text:update"):
            return
        activity_id = data.get("id", "")
        text = data.get("text", "")
        if activity_id and isinstance(text, str):
            sync_manager.update_text(request.sid, activity_id, text)

    @socketio.on("window:replace")
    def on_window_replace(data):
        from flask import request
        activity_id = data.get("id", "")
        new_type = data.get("type")  # None means random
        if activity_id:
            sync_manager.replace_window(request.sid, activity_id, new_type)

    @socketio.on("window:close")
    def on_window_close(data):
        from flask import request
        activity_id = data.get("id", "")
        if activity_id:
            sync_manager.close_window(request.sid, activity_id)

    @socketio.on("window:randomize")
    def on_window_randomize(data=None):
        from flask import request
        if not _check_rate(request.sid, "window:randomize"):
            return
        sync_manager.randomize_all(request.sid)

    @socketio.on("window:spawn")
    def on_window_spawn(data):
        from flask import request
        new_type = data.get("type")  # None means random
        sync_manager.spawn_window(request.sid, new_type)

    @socketio.on("window:resize")
    def on_window_resize(data):
        from flask import request
        activity_id = data.get("id", "")
        size = data.get("size", {})
        position = data.get("position", {})
        if activity_id and isinstance(size, dict) and isinstance(position, dict):
            sync_manager.resize_window(request.sid, activity_id, size, position)

    @socketio.on("window:move")
    def on_window_move(data):
        from flask import request
        activity_id = data.get("id", "")
        position = data.get("position", {})
        if activity_id and isinstance(position, dict):
            sync_manager.move_window(request.sid, activity_id, position)

    @socketio.on("window:focus")
    def on_window_focus(data):
        from flask import request
        activity_id = data.get("id", "")
        if activity_id:
            room = sync_manager.get_room_for_client(request.sid)
            socketio.emit("window:focus", {"id": activity_id}, room=room)

    @socketio.on("window:pin")
    def on_window_pin(data):
        from flask import request
        slot = data.get("slot")
        type_name = data.get("type")
        if slot is not None and type_name:
            safe_slot = _safe_int(slot, -1)
            if safe_slot < 0:
                return
            sync_manager.pin_slot(request.sid, safe_slot, type_name)
            room = sync_manager.get_room_for_client(request.sid)
            socketio.emit("window:pin", {"slot": safe_slot, "type": type_name}, room=room)

    @socketio.on("window:unpin")
    def on_window_unpin(data):
        from flask import request
        slot = data.get("slot")
        if slot is not None:
            safe_slot = _safe_int(slot, -1)
            if safe_slot < 0:
                return
            sync_manager.unpin_slot(request.sid, safe_slot)
            room = sync_manager.get_room_for_client(request.sid)
            socketio.emit("window:unpin", {"slot": safe_slot}, room=room)

    return app, socketio


def main():
    parser = argparse.ArgumentParser(description="BizzBox — cinematic busybox display")
    parser.add_argument("--intensity",  type=int, default=5,
                        help="Mean activity updates per second (1=serene, 10+=frenetic)")
    parser.add_argument("--sync-mode",  choices=["synced", "unsynced"], default="synced",
                        help="synced=all clients see same show, unsynced=each client independent")
    parser.add_argument("--host",       default="0.0.0.0",
                        help="Bind host")
    parser.add_argument("--port",       type=int,
                        default=int(os.environ.get("PORT", 5000)),
                        help="Bind port (defaults to $PORT env or 5000)")
    parser.add_argument("--fg-target",  type=int, default=5,
                        help="Target foreground window count (0-20)")
    parser.add_argument("--style",      default="dark",
                        choices=["dark", "light", "brutalist", "neon", "rainbow",
                                 "sunshine", "red", "black", "lcars", "amber",
                                 "arctic", "synthwave", "military", "ocean",
                                 "forest", "copper", "vapor", "infrared",
                                 "phosphor", "blueprint", "sunset", "matrix", "frost"],
                        help="Initial styling mode")
    parser.add_argument("--max-channels", type=int, default=10,
                        help="Maximum number of channels (1-50)")
    args = parser.parse_args()

    config = AppConfig(
        intensity=args.intensity,
        sync_mode=args.sync_mode,
        host=args.host,
        port=args.port,
        style=args.style,
        fg_target=args.fg_target,
        max_channels=max(1, min(50, args.max_channels)),
    )

    print(f"🎬 BizzBox starting — intensity={config.intensity}, "
          f"mode={config.sync_mode}, style={config.style}, "
          f"port={config.port}")

    app, socketio = create_app(config)
    socketio.run(app, host=config.host, port=config.port)


if __name__ == "__main__":
    main()
