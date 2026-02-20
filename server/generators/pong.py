"""
Self-playing Pong activity generator.
Two AI paddles volley a ball back and forth with adjustable difficulty.
"""
import random
import math

from .base import BaseActivity


class PongActivity(BaseActivity):
    activity_type = "pong"
    strategies = [
        "rally",          # long rallies, both paddles are good
        "mismatch",       # one paddle is much better
        "multiball",      # two balls at once
        "speedup",        # ball accelerates each hit
    ]
    titles = [
        "PONG",
        "TABLE TENNIS",
        "ARCADE PONG",
        "RALLY SIM",
        "PADDLE MATCH",
    ]

    # Logical field dimensions (normalized)
    FIELD_W = 1000
    FIELD_H = 600
    PADDLE_W = 12
    PADDLE_H = 80
    BALL_R = 8

    def __init__(self, activity_id: str = None, intensity: int = 5):
        super().__init__(activity_id, intensity)
        self.score_left = 0
        self.score_right = 0
        self.balls = []
        self.paddle_left_y = self.FIELD_H / 2
        self.paddle_right_y = self.FIELD_H / 2
        self.rally_count = 0
        self.max_rally = 0
        self._speed_mult = 1.0

        # AI tracking error (lower = better)
        if self.strategy == "mismatch":
            self._left_skill = random.uniform(0.6, 0.8)
            self._right_skill = random.uniform(0.2, 0.4)
        else:
            self._left_skill = random.uniform(0.5, 0.7)
            self._right_skill = random.uniform(0.5, 0.7)

        self._reset_ball()
        if self.strategy == "multiball":
            self._add_ball()

    def _reset_ball(self):
        """Reset primary ball to center with random direction."""
        angle = random.uniform(-math.pi / 4, math.pi / 4)
        direction = random.choice([-1, 1])
        base_speed = 4.0 + self.intensity * 0.5
        self._speed_mult = 1.0
        self.balls = [{
            "x": self.FIELD_W / 2,
            "y": self.FIELD_H / 2,
            "vx": direction * base_speed * math.cos(angle),
            "vy": base_speed * math.sin(angle),
        }]
        self.rally_count = 0
        if self.strategy == "multiball":
            self._add_ball()

    def _add_ball(self):
        """Add an extra ball."""
        angle = random.uniform(-math.pi / 4, math.pi / 4)
        direction = random.choice([-1, 1])
        base_speed = 4.0 + self.intensity * 0.5
        self.balls.append({
            "x": self.FIELD_W / 2,
            "y": self.FIELD_H / 2,
            "vx": direction * base_speed * math.cos(angle),
            "vy": base_speed * math.sin(angle),
        })

    def _move_paddle(self, paddle_y: float, target_y: float, skill: float) -> float:
        """Move paddle toward target with skill-based speed."""
        speed = 3.0 + self.intensity * 0.4
        # Add tracking error
        error = random.gauss(0, (1 - skill) * 40)
        target = target_y + error
        diff = target - paddle_y
        move = min(abs(diff), speed) * (1 if diff > 0 else -1)
        new_y = paddle_y + move
        half = self.PADDLE_H / 2
        return max(half, min(self.FIELD_H - half, new_y))

    def _step(self):
        """Advance simulation by one tick."""
        # Find the ball closest to each paddle for AI targeting
        left_target = self.FIELD_H / 2
        right_target = self.FIELD_H / 2
        for ball in self.balls:
            if ball["vx"] < 0:
                left_target = ball["y"]
            else:
                right_target = ball["y"]

        self.paddle_left_y = self._move_paddle(
            self.paddle_left_y, left_target, self._left_skill)
        self.paddle_right_y = self._move_paddle(
            self.paddle_right_y, right_target, self._right_skill)

        speed_factor = self._speed_mult if self.strategy == "speedup" else 1.0

        scored = False
        for ball in self.balls:
            ball["x"] += ball["vx"] * speed_factor
            ball["y"] += ball["vy"] * speed_factor

            # Top/bottom bounce
            if ball["y"] <= self.BALL_R:
                ball["y"] = self.BALL_R
                ball["vy"] = abs(ball["vy"])
            elif ball["y"] >= self.FIELD_H - self.BALL_R:
                ball["y"] = self.FIELD_H - self.BALL_R
                ball["vy"] = -abs(ball["vy"])

            # Left paddle hit
            if (ball["x"] - self.BALL_R <= self.PADDLE_W + 20 and
                    ball["vx"] < 0 and
                    abs(ball["y"] - self.paddle_left_y) < self.PADDLE_H / 2 + self.BALL_R):
                ball["x"] = self.PADDLE_W + 20 + self.BALL_R
                ball["vx"] = abs(ball["vx"])
                # Add spin based on where ball hits paddle
                offset = (ball["y"] - self.paddle_left_y) / (self.PADDLE_H / 2)
                ball["vy"] += offset * 2
                self.rally_count += 1
                if self.strategy == "speedup":
                    self._speed_mult = min(2.5, self._speed_mult + 0.1)

            # Right paddle hit
            elif (ball["x"] + self.BALL_R >= self.FIELD_W - self.PADDLE_W - 20 and
                  ball["vx"] > 0 and
                  abs(ball["y"] - self.paddle_right_y) < self.PADDLE_H / 2 + self.BALL_R):
                ball["x"] = self.FIELD_W - self.PADDLE_W - 20 - self.BALL_R
                ball["vx"] = -abs(ball["vx"])
                offset = (ball["y"] - self.paddle_right_y) / (self.PADDLE_H / 2)
                ball["vy"] += offset * 2
                self.rally_count += 1
                if self.strategy == "speedup":
                    self._speed_mult = min(2.5, self._speed_mult + 0.1)

            # Scoring
            if ball["x"] < 0:
                self.score_right += 1
                scored = True
            elif ball["x"] > self.FIELD_W:
                self.score_left += 1
                scored = True

        if scored:
            self.max_rally = max(self.max_rally, self.rally_count)
            self._reset_ball()

            # Reset scores after reaching 11
            if self.score_left >= 11 or self.score_right >= 11:
                self.score_left = 0
                self.score_right = 0
                self.max_rally = 0
                self.strategy = random.choice(self.strategies)
                # Re-randomize skills
                if self.strategy == "mismatch":
                    self._left_skill = random.uniform(0.6, 0.8)
                    self._right_skill = random.uniform(0.2, 0.4)
                    if random.random() < 0.5:
                        self._left_skill, self._right_skill = self._right_skill, self._left_skill
                else:
                    self._left_skill = random.uniform(0.5, 0.7)
                    self._right_skill = random.uniform(0.5, 0.7)

    def _get_state(self) -> dict:
        # Send velocity in field-units per second so the client can
        # extrapolate the ball position smoothly between server frames.
        speed_factor = self._speed_mult if self.strategy == "speedup" else 1.0
        steps_per_frame = 3
        update_rate = max(1, self.intensity)
        vel_scale = speed_factor * steps_per_frame * update_rate
        return {
            "balls": [{"x": b["x"], "y": b["y"],
                       "vx": round(b["vx"] * vel_scale, 2),
                       "vy": round(b["vy"] * vel_scale, 2)}
                     for b in self.balls],
            "paddle_left_y": round(self.paddle_left_y, 1),
            "paddle_right_y": round(self.paddle_right_y, 1),
            "score_left": self.score_left,
            "score_right": self.score_right,
            "rally": self.rally_count,
            "max_rally": self.max_rally,
            "strategy": self.strategy,
            "field_w": self.FIELD_W,
            "field_h": self.FIELD_H,
            "paddle_w": self.PADDLE_W,
            "paddle_h": self.PADDLE_H,
            "ball_r": self.BALL_R,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        # Multiple steps per frame for smooth motion
        for _ in range(3):
            self._step()
        return self._get_state()
