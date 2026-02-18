"""
BizzBox — Flask/SocketIO server entry point.
Parses CLI args, sets up Flask-SocketIO, handles all socket events.
"""
import argparse
import os

import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template
from flask_socketio import SocketIO

from server.config import AppConfig
from server.event_emitter import EventEmitter
from server.sync_manager import SyncManager


def create_app(config: AppConfig):
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "bizzbox-dev-secret")
    app.config["TEMPLATES_AUTO_RELOAD"] = True
    app.jinja_env.auto_reload = True

    socketio = SocketIO(
        app,
        async_mode="eventlet",
        cors_allowed_origins="*",
        logger=False,
        engineio_logger=False,
    )

    emitter = EventEmitter(socketio)
    sync_manager = SyncManager(socketio, emitter, config)

    @app.route("/")
    def index():
        return render_template("index.html")

    @socketio.on("connect")
    def on_connect(auth=None):
        from flask import request
        sync_manager.handle_connect(request.sid)

    @socketio.on("disconnect")
    def on_disconnect():
        from flask import request
        sync_manager.handle_disconnect(request.sid)

    @socketio.on("configure:style")
    def on_style(data):
        from flask import request
        style = data.get("style", "dark")
        config.style = style
        room = sync_manager.get_room_for_client(request.sid)
        emitter.broadcast_style(style, room=room)

    @socketio.on("configure:intensity")
    def on_intensity(data):
        from flask import request
        value = max(1, min(20, int(data.get("value", config.intensity))))
        config.intensity = value
        room = sync_manager.get_room_for_client(request.sid)
        emitter.broadcast_intensity(value, room=room)

    @socketio.on("configure:mute")
    def on_mute(data):
        from flask import request
        muted = bool(data.get("muted", False))
        config.muted = muted
        room = sync_manager.get_room_for_client(request.sid)
        emitter.broadcast_mute(muted, room=room)

    @socketio.on("configure:sync")
    def on_sync(data):
        # Sync mode changes are informational only at runtime (mode is set at startup)
        pass

    @socketio.on("configure:layout")
    def on_layout(data):
        from flask import request
        cols = max(1, min(6, int(data.get("cols", config.grid_cols))))
        rows = max(1, min(8, int(data.get("rows", config.grid_rows))))
        config.grid_cols = cols
        config.grid_rows = rows
        room = sync_manager.get_room_for_client(request.sid)
        sync_manager.set_layout(request.sid, cols, rows)
        emitter.broadcast_layout(cols, rows, room=room)

    @socketio.on("configure:fg_count")
    def on_fg_count(data):
        from flask import request
        value = max(0, min(20, int(data.get("value", config.fg_target))))
        config.fg_target = value
        room = sync_manager.get_room_for_client(request.sid)
        sync_manager.set_fg_target(request.sid, value)
        emitter.broadcast_fg_target(value, room=room)

    @socketio.on("configure:activity_filter")
    def on_activity_filter(data):
        from flask import request
        allowed = data.get("allowed")  # list of type names or None
        sync_manager.set_activity_filter(request.sid, allowed)

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
                        choices=["dark", "light", "brutalist", "neon", "rainbow", "sunshine", "red", "black", "lcars"],
                        help="Initial styling mode")
    args = parser.parse_args()

    config = AppConfig(
        intensity=args.intensity,
        sync_mode=args.sync_mode,
        host=args.host,
        port=args.port,
        style=args.style,
        fg_target=args.fg_target,
    )

    print(f"🎬 BizzBox starting — intensity={config.intensity}, "
          f"mode={config.sync_mode}, style={config.style}, "
          f"port={config.port}")

    app, socketio = create_app(config)
    socketio.run(app, host=config.host, port=config.port)


if __name__ == "__main__":
    main()
