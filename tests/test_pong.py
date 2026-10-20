"""Pong server motion must agree with the client's velocity prediction."""

import pytest

from server.generators.pong import PongActivity


@pytest.mark.parametrize("strategy", PongActivity.strategies)
def test_pong_starts_and_resets_with_one_ball(monkeypatch, strategy):
    monkeypatch.setattr(PongActivity, "strategies", [strategy])
    game = PongActivity()

    assert len(game.initial_payload()["balls"]) == 1

    game.balls[0]["x"] = game.FIELD_W + 1
    game.balls[0]["y"] = game.BALL_R
    game.balls[0]["vx"] = 1
    game._step()

    assert len(game.balls) == 1
    assert game.score_left == 1


def test_pong_velocity_matches_distance_between_updates():
    game = PongActivity(intensity=5)
    game.strategy = "rally"
    game.balls = [{"x": 500.0, "y": 300.0, "vx": 7.0, "vy": 0.0}]

    start = game.initial_payload()
    end = game.next_frame()
    elapsed = game.update_interval_override

    assert end["balls"][0]["x"] - start["balls"][0]["x"] == 21.0
    assert start["balls"][0]["vx"] * elapsed == 21.0


def test_pong_ball_reaches_and_bounces_off_paddle():
    game = PongActivity(intensity=5)
    game.strategy = "rally"
    game.balls = [{"x": 500.0, "y": 300.0, "vx": 7.0, "vy": 0.0}]

    for _ in range(25):
        frame = game.next_frame()
        if frame["rally"]:
            break

    assert frame["rally"] == 1
    assert frame["balls"][0]["vx"] < 0
