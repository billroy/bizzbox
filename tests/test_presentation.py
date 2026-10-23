"""Server-authoritative presentation lifecycle and channel persistence."""
from app import create_app
from server.config import AppConfig
from server.presentation import PresentationState, normalize_playlist
from server.sync_manager import SyncManager


SCENES = [
    {
        "name": "One", "style": "dark", "cols": 2, "rows": 2,
        "intensity": 5, "ambientPreset": None, "filter": ["radar"],
    },
    {
        "name": "Two", "style": "neon", "cols": 3, "rows": 2,
        "intensity": 8, "ambientPreset": "server_room", "filter": ["terminal"],
    },
]


def _event(events, name):
    return next(event for event in events if event["name"] == name)


def test_presentation_state_runs_blackout_apply_reveal_cycle():
    presentation = PresentationState()
    scenes = normalize_playlist(SCENES)
    first = presentation.start(scenes, 15, "all", 100.0, 1_000.0)

    assert first["name"] == "One"
    assert presentation.public_state(1, 1_000.0)["nextTransitionAt"] == 1_015_000

    assert presentation.tick(114.99, 1_014.99) is None
    assert presentation.tick(115.0, 1_015.0) == ("state", None)
    assert presentation.phase == "blackout"

    action, scene = presentation.tick(115.3, 1_015.3)
    assert action == "scene"
    assert scene["name"] == "Two"
    assert presentation.phase == "reveal"
    assert presentation.public_state(1, 1_015.3)["nextTransitionAt"] == 1_030_300

    assert presentation.tick(115.6, 1_015.6) == ("state", None)
    assert presentation.phase == "idle"


def test_new_channel_presentation_interval_survives_browser_connection_reset():
    app, socketio = create_app(AppConfig())
    controller = socketio.test_client(app)
    try:
        controller.get_received()
        controller.emit("channel:create")
        created = controller.get_received()
        switched = _event(created, "channel:switched")
        channel_id = switched["args"][0]["channelId"]
        assert channel_id == 2

        controller.emit("presentation:start", {
            "scenes": SCENES,
            "intervalSeconds": 60,
            "filter": "all",
        })
        started = _event(controller.get_received(), "sync:init")["args"][0]
        assert started["channel"]["id"] == channel_id
        assert started["presentation"]["active"] is True
        assert started["presentation"]["intervalSeconds"] == 60

        controller.emit("presentation:schedule", {"intervalSeconds": 15})
        scheduled = _event(controller.get_received(), "presentation:state")["args"][0]
        assert scheduled["channelId"] == channel_id
        assert scheduled["active"] is True
        assert scheduled["intervalSeconds"] == 15
        controller.disconnect()

        replacement = socketio.test_client(app)
        try:
            replacement.get_received()
            replacement.emit("channel:switch", {"channelId": channel_id})
            reset_state = _event(replacement.get_received(), "sync:init")["args"][0]
            assert reset_state["presentation"]["active"] is True
            assert reset_state["presentation"]["intervalSeconds"] == 15

            replacement.emit("presentation:stop")
            stopped = _event(replacement.get_received(), "presentation:state")["args"][0]
            assert stopped["active"] is False
            assert stopped["nextTransitionAt"] is None
        finally:
            replacement.disconnect()
    finally:
        if controller.is_connected():
            controller.disconnect()


def test_presentation_state_is_isolated_by_channel():
    app, socketio = create_app(AppConfig())
    first = socketio.test_client(app)
    second = socketio.test_client(app)
    try:
        first.get_received()
        second.get_received()
        first.emit("channel:create")
        channel_id = _event(first.get_received(), "channel:switched")["args"][0]["channelId"]
        first.emit("presentation:start", {"scenes": SCENES, "intervalSeconds": 30})
        first.get_received()

        # The client left behind on Channel 1 never receives Channel 2 presentation state.
        assert not any(event["name"].startswith("presentation:") for event in second.get_received())

        second.emit("channel:switch", {"channelId": channel_id})
        joined = _event(second.get_received(), "sync:init")["args"][0]
        assert joined["presentation"]["active"] is True
        assert joined["presentation"]["intervalSeconds"] == 30
    finally:
        first.disconnect()
        second.disconnect()


def test_active_new_channel_presentation_survives_server_recreation(
        tmp_path, fake_sio, emitter):
    state_path = tmp_path / "presentation.sqlite3"
    config = AppConfig(presentation_state_path=str(state_path))
    original = SyncManager(fake_sio, emitter, config)
    channel = original._create_channel()
    original._sid_to_channel["controller"] = channel.channel_id

    assert original.start_presentation("controller", SCENES, 60)
    assert original.schedule_presentation("controller", 15)

    restored = SyncManager(fake_sio, emitter, config)
    restored_channel = restored._channels[channel.channel_id]
    assert restored_channel.presentation.active is True
    assert restored_channel.presentation.interval_seconds == 15
    assert restored_channel.presentation.playlist[0]["name"] == "One"

    restored._sid_to_channel["replacement"] = channel.channel_id
    assert restored.stop_presentation("replacement")

    stopped = SyncManager(fake_sio, emitter, config)
    assert channel.channel_id not in stopped._channels
