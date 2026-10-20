"""Scene changes replace all activities, including delayed replacements."""
import time

from server.activity_manager import ActivityManager
from server.sync_manager import SyncManager


def test_scene_switch_discards_old_activities_and_replacements(fake_sio, emitter, config):
    config.grid_cols = 3
    config.grid_rows = 2
    manager = ActivityManager(fake_sio, emitter, config, "channel:1")
    manager.apply_scene(3, 2, 0, {"tic_tac_toe"}, [])
    old_ids = set(manager._activities)
    old_activity = next(iter(manager._activities.values()))
    manager.replace_window(old_activity.id, "tic_tac_toe")
    assert manager._pending_replacements

    manager.apply_scene(2, 2, 1, {"radar"}, [])
    assert len(manager._activities) == 5
    assert all(rec.generator.activity_type == "radar"
               for rec in manager._activities.values())
    assert not old_ids.intersection(manager._activities)
    assert manager._pending_replacements == []
    assert manager._pending_closures == []
    manager._process_replacements(time.time() + 2)
    assert len(manager._activities) == 5


def test_unfiltered_scene_clears_previous_pins_and_activities(fake_sio, emitter, config):
    manager = ActivityManager(fake_sio, emitter, config, "channel:1")
    manager.apply_scene(2, 2, 0, {"tic_tac_toe"}, ["tic_tac_toe"] * 4)
    old_ids = set(manager._activities)

    manager.apply_scene(3, 2, 0, None, [])
    assert manager._allowed_types is None
    assert manager._pinned_slots == {}
    assert len(manager._activities) == 6
    assert not old_ids.intersection(manager._activities)
    assert all(rec.slot == i for i, rec in enumerate(manager._activities.values()))


def test_scene_sync_replaces_room_state(fake_sio, emitter, config):
    sync = SyncManager(fake_sio, emitter, config)
    sync._sid_to_channel["viewer"] = 1
    manager = sync._channels[1].manager
    old_ids = set(manager._activities)

    sync.apply_scene("viewer", "neon", 8, 2, 2, 0, {"tic_tac_toe"}, [])
    events = [event for event in fake_sio.emitted if event["event"] == "sync:init"]
    assert len(events) == 1
    assert events[0]["room"] == "channel:1"
    state = events[0]["data"]
    assert state["scene_applied"] is True
    assert state["session"]["style"] == "neon"
    assert state["layout"]["background_count"] == 4
    assert {activity["type"] for activity in state["activities"]} == {"tic_tac_toe"}
    assert not old_ids.intersection(activity["id"] for activity in state["activities"])
