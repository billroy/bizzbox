"""T1d — Delta round-trip correctness for generators with compute_delta."""
from server.generators.game_of_life import GameOfLifeActivity
from server.generators.network_topology import NetworkTopologyActivity


def _apply_gol_delta(old_state: dict, delta: dict) -> dict:
    """Python port of the client-side mergeActivityDelta for game_of_life."""
    cells = set(tuple(c) for c in old_state["cells"])
    for c in delta.get("born", []):
        cells.add(tuple(c))
    for c in delta.get("died", []):
        cells.discard(tuple(c))
    return {
        **old_state,
        "cells": [list(c) for c in cells],
        "generation": delta["generation"],
        "population": delta["population"],
    }


def test_game_of_life_delta_roundtrip():
    """Applying born/died deltas to old state must reconstruct new state exactly."""
    gen = GameOfLifeActivity(intensity=5)
    old = gen.initial_payload()

    for _ in range(10):
        new = gen.next_frame()
        delta = gen.compute_delta(old, new)
        if delta is not None:
            reconstructed = _apply_gol_delta(old, delta)
            assert set(tuple(c) for c in reconstructed["cells"]) == \
                   set(tuple(c) for c in new["cells"]), \
                   f"Delta round-trip failed at generation {new['generation']}"
            assert reconstructed["generation"] == new["generation"]
            assert reconstructed["population"] == new["population"]
        old = new


def test_game_of_life_delta_includes_marker():
    """All deltas must include _delta: True."""
    gen = GameOfLifeActivity(intensity=5)
    old = gen.initial_payload()
    for _ in range(5):
        new = gen.next_frame()
        delta = gen.compute_delta(old, new)
        if delta is not None:
            assert delta["_delta"] is True
        old = new


def test_game_of_life_reseed_returns_none_delta():
    """After a reseed (generation reset), compute_delta should return None."""
    gen = GameOfLifeActivity(intensity=5)
    old = gen.initial_payload()
    new = gen.next_frame()

    # Simulate a reseed by creating a state with lower generation
    fake_old = {**new, "generation": 100}
    fake_new = {**new, "generation": 0}
    delta = gen.compute_delta(fake_old, fake_new)
    assert delta is None, "compute_delta should return None when generation resets"


def test_network_topology_delta_keeps_labels_and_edge_endpoints():
    """The client replaces node and edge arrays when applying this delta."""
    gen = NetworkTopologyActivity(intensity=5)
    state = gen.initial_payload()

    for _ in range(10):
        frame = gen.next_frame()
        delta = gen.compute_delta(state, frame)
        state = {**state, **{k: v for k, v in delta.items() if k != "_delta"}}

        assert state == frame
        assert all(node["label"] for node in state["nodes"])
        assert all("from" in edge and "to" in edge for edge in state["edges"])
