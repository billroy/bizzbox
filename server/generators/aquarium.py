"""Aquarium activity — betta fish swimming in a tank with wrap-around movement."""
import random
import math
import uuid
from .base import BaseActivity


class AquariumActivity(BaseActivity):
    activity_type = "aquarium"
    strategies = [
        "tropical_reef", "deep_sea", "koi_pond",
        "jellyfish_drift", "coral_garden",
    ]
    titles = [
        "AQUARIUM", "FISH TANK", "MARINE LIFE",
        "REEF CAM", "AQUATIC VIEW",
    ]

    FISH_TYPES = {
        "tropical_reef":   ["betta", "betta", "angelfish"],
        "deep_sea":        ["betta", "lanternfish", "deep_swimmer"],
        "koi_pond":        ["betta", "koi"],
        "jellyfish_drift": ["jellyfish"],
        "coral_garden":    ["betta", "betta", "angelfish"],
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._frame = 0
        count = random.randint(3, 6)
        self._fish = [self._spawn_fish() for _ in range(count)]
        self._decorations = self._generate_decorations()

    def _spawn_fish(self):
        fish_type = random.choice(self.FISH_TYPES[self.strategy])
        size = random.uniform(0.7, 1.8)
        speed_mult = random.uniform(0.8, 1.5)
        vx = random.choice([-1, 1]) * random.uniform(0.006, 0.012)
        if fish_type == "jellyfish":
            vx *= 0.3
        return {
            "id": uuid.uuid4().hex[:6],
            "x": round(random.uniform(0.05, 0.95), 3),
            "y": round(random.uniform(0.1, 0.85), 3),
            "vx": round(vx, 5),
            "vy": round(random.uniform(-0.004, 0.004), 5),
            "size": round(size, 2),
            "type": fish_type,
            "color_idx": random.randint(0, 5),
            "facing": 1 if vx > 0 else -1,
            "phase": round(random.uniform(0, math.pi * 2), 3),
            "speed_mult": round(speed_mult, 3),
        }

    def _generate_decorations(self):
        plants = []
        for _ in range(random.randint(2, 5)):
            plants.append({
                "x": round(random.uniform(0.05, 0.95), 3),
                "height": round(random.uniform(0.08, 0.25), 3),
                "type": random.randint(0, 2),
            })
        rocks = []
        for _ in range(random.randint(1, 3)):
            rocks.append({
                "x": round(random.uniform(0.1, 0.9), 3),
                "w": round(random.uniform(0.04, 0.10), 3),
                "h": round(random.uniform(0.02, 0.05), 3),
            })
        bubbles = []
        for _ in range(random.randint(2, 5)):
            bubbles.append({
                "x": round(random.uniform(0.1, 0.9), 3),
                "speed": round(random.uniform(0.003, 0.008), 4),
            })
        return {"plants": plants, "rocks": rocks, "bubbles": bubbles}

    def _move_fish(self):
        self._frame += 1
        for f in self._fish:
            # Advance position
            f["x"] += f["vx"] * f["speed_mult"]
            f["y"] += f["vy"] * f["speed_mult"]

            # Vertical sine bobbing (stronger)
            f["y"] += 0.001 * math.sin(self._frame * 0.04 + f["phase"])

            # Random velocity perturbation — 15% chance for more dynamic movement
            if random.random() < 0.15:
                f["vx"] += random.uniform(-0.004, 0.004)
                f["vy"] += random.uniform(-0.003, 0.003)

            # Random direction reversal — 2% chance
            if random.random() < 0.02 and f["type"] != "jellyfish":
                f["vx"] = -f["vx"]

            # Clamp velocities — faster range
            min_vx = 0.004 if f["type"] != "jellyfish" else 0.0005
            max_vx = 0.014 if f["type"] != "jellyfish" else 0.003
            if abs(f["vx"]) < min_vx:
                f["vx"] = min_vx * (1 if f["vx"] >= 0 else -1)
            if abs(f["vx"]) > max_vx:
                f["vx"] = max_vx * (1 if f["vx"] >= 0 else -1)
            # More vertical range
            f["vy"] = max(-0.008, min(0.008, f["vy"]))

            # Keep fish from going too high or low (soft bounce)
            if f["y"] < 0.05:
                f["vy"] = abs(f["vy"]) + 0.003
            elif f["y"] > 0.88:
                f["vy"] = -abs(f["vy"]) - 0.003

            # Wrap-around horizontally
            if f["x"] > 1.12:
                f["x"] = -0.12
            elif f["x"] < -0.12:
                f["x"] = 1.12

            # Update facing
            f["facing"] = 1 if f["vx"] > 0 else -1

            # Round for transmission
            f["x"] = round(f["x"], 4)
            f["y"] = round(f["y"], 4)
            f["vx"] = round(f["vx"], 5)
            f["vy"] = round(f["vy"], 5)

    def _serialize_fish(self):
        return [
            {
                "id": f["id"],
                "x": f["x"],
                "y": f["y"],
                "size": f["size"],
                "type": f["type"],
                "color_idx": f["color_idx"],
                "facing": f["facing"],
                "phase": f["phase"],
                "speed_mult": f["speed_mult"],
            }
            for f in self._fish
        ]

    def _get_state(self):
        return {
            "fish": self._serialize_fish(),
            "decorations": self._decorations,
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        return {
            "_delta": True,
            "fish": new_state["fish"],
        }

    def next_frame(self) -> dict:
        self._move_fish()
        return self._get_state()
