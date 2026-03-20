"""T1a — Smoke tests for all registered activity generators."""
import pytest
from server.activity_registry import REGISTRY


@pytest.mark.parametrize("type_name,cls", sorted(REGISTRY.items()))
def test_generator_smoke(type_name, cls):
    """Each generator must produce valid initial_payload and next_frame dicts,
    and compute_delta (if overridden) must return None or a dict with _delta=True."""
    gen = cls(intensity=5)
    payload = gen.initial_payload()
    assert isinstance(payload, dict), f"{type_name}.initial_payload() must return dict"

    prev = payload
    for _ in range(10):
        frame = gen.next_frame()
        assert isinstance(frame, dict), f"{type_name}.next_frame() must return dict"

        # Test compute_delta if the subclass overrides it
        if type(gen).compute_delta is not cls.__bases__[0].compute_delta:
            delta = gen.compute_delta(prev, frame)
            if delta is not None:
                assert isinstance(delta, dict)
                assert delta.get("_delta") is True, \
                    f"{type_name}.compute_delta() must include '_delta': True"
        prev = frame


@pytest.mark.parametrize("type_name,cls", sorted(REGISTRY.items()))
def test_generator_spawn_payload(type_name, cls):
    """spawn_payload must include id, type, title, and state keys."""
    gen = cls(intensity=5)
    payload = gen.spawn_payload(slot=0, is_foreground=False, position=None, size=None)
    assert "id" in payload
    assert payload["type"] == type_name
    assert "title" in payload
    assert "state" in payload
