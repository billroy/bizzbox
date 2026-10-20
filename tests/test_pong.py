"""Pong server motion must agree with the client's velocity prediction."""

from server.generators.pong import PongActivity


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
