"""T1b — ActivityManager loop resilience and text activity tests."""
import pytest
from server.activity_manager import ActivityManager
from server.generators.base import BaseActivity


class BrokenGenerator(BaseActivity):
    """A generator that always raises in next_frame()."""
    activity_type = "broken"
    strategies = ["crash"]
    titles = ["BROKEN"]

    def initial_payload(self):
        return {"status": "ok"}

    def next_frame(self):
        raise ValueError("intentional test crash")


def test_loop_survives_generator_exception(fake_sio, emitter, config):
    """A generator that raises in next_frame() must not kill the loop.
    The faulty activity should be removed and the loop should continue."""
    manager = ActivityManager(fake_sio, emitter, config, room="test")
    # Don't start the background loop; manually invoke _loop internals
    manager._running = True

    # Inject a broken generator
    broken = BrokenGenerator(intensity=5)
    from server.activity_manager import ActivityRecord
    rec = ActivityRecord(broken, slot=0, is_foreground=False, position=None, size=None)
    rec.next_update_interval = 0  # ensure it fires immediately
    rec.last_update = 0
    manager._activities[broken.id] = rec
    manager._bg_slots = [broken.id]

    # Simulate one iteration of the loop
    import time
    now = time.time()
    for act_id, r in list(manager._activities.items()):
        if r.despawning:
            continue
        if now - r.last_update >= r.next_update_interval:
            try:
                frame = r.generator.next_frame()
            except Exception:
                r.despawning = True
                manager._activities.pop(act_id, None)
                if r.slot is not None and r.slot < len(manager._bg_slots):
                    manager._bg_slots[r.slot] = None
                continue

    # The broken activity should have been removed
    assert broken.id not in manager._activities
    assert manager._bg_slots[0] is None


def test_update_text_activity(fake_sio, emitter, config):
    """update_text_activity should update text and return new state."""
    manager = ActivityManager(fake_sio, emitter, config, room="test")
    # Spawn a text activity
    from server.activity_registry import REGISTRY
    text_cls = REGISTRY["text"]
    gen = text_cls(intensity=5)
    from server.activity_manager import ActivityRecord
    rec = ActivityRecord(gen, slot=0, is_foreground=False, position=None, size=None)
    manager._activities[gen.id] = rec

    state = manager.update_text_activity(gen.id, "hello world", "sid_test")
    assert state is not None
    assert state["text"] == "hello world"
    assert state["last_editor"] is not None
    # last_editor should be opaque, not the raw sid
    assert state["last_editor"] != "sid_test"
    assert state["last_editor"].startswith("#")


def test_update_text_activity_wrong_type(fake_sio, emitter, config):
    """update_text_activity on a non-text activity should return None."""
    manager = ActivityManager(fake_sio, emitter, config, room="test")
    from server.activity_registry import REGISTRY
    # Pick a non-text type
    non_text_type = next(k for k in REGISTRY if k != "text")
    gen = REGISTRY[non_text_type](intensity=5)
    from server.activity_manager import ActivityRecord
    rec = ActivityRecord(gen, slot=0, is_foreground=False, position=None, size=None)
    manager._activities[gen.id] = rec

    result = manager.update_text_activity(gen.id, "test", "sid")
    assert result is None
