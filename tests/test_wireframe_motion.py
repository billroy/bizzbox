"""Wireframe motion settings are independent for each activity instance."""
import random

from server.generators.wireframe_3d import Wireframe3DActivity


def test_wireframe_motion_varies_per_instance_and_survives_updates():
    previous_random_state = random.getstate()
    try:
        random.seed(42)
        generators = [Wireframe3DActivity(intensity=5) for _ in range(12)]
    finally:
        random.setstate(previous_random_state)

    states = [gen.initial_payload() for gen in generators]
    profiles = {(state["rot_x"], state["rot_y"], state["spin_x"], state["spin_y"])
                for state in states}
    assert len(profiles) == len(states)
    assert any(state["spin_x"] < 0 for state in states)
    assert any(state["spin_x"] > 0 for state in states)
    assert any(state["spin_y"] < 0 for state in states)
    assert any(state["spin_y"] > 0 for state in states)

    for gen, initial in zip(generators, states):
        frame = gen.next_frame()
        assert (frame["spin_x"], frame["spin_y"]) == (initial["spin_x"], initial["spin_y"])
        assert gen.compute_delta(initial, frame) == {
            "_delta": True, "rot_x": frame["rot_x"], "rot_y": frame["rot_y"]
        }
