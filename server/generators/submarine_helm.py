"""Submarine helm — deep sea vessel control with depth gauge, ballast, sonar contacts, and reactor."""
import random
import math
from .base import BaseActivity


class SubmarineHelmActivity(BaseActivity):
    activity_type = "submarine_helm"
    strategies = [
        "attack_sub",
        "research_vessel",
        "cargo_submersible",
        "deep_explorer",
        "stealth_patrol",
    ]
    titles = [
        "HELM CONTROL", "SUB HELM", "DIVE CONTROL",
        "CONN STATION", "HELM OPS", "SUBMARINE",
    ]

    _MAX_DEPTH = {
        "attack_sub": 300,
        "research_vessel": 6000,
        "cargo_submersible": 200,
        "deep_explorer": 11000,
        "stealth_patrol": 400,
    }

    _CONTACT_TYPES = {
        "attack_sub":        ["surface_vessel", "submarine", "torpedo", "whale", "unknown"],
        "research_vessel":   ["whale", "fish_school", "thermal_vent", "wreck", "unknown"],
        "cargo_submersible": ["surface_vessel", "submarine", "buoy", "unknown"],
        "deep_explorer":     ["thermal_vent", "wreck", "creature", "geological", "unknown"],
        "stealth_patrol":    ["submarine", "surface_vessel", "torpedo", "mine", "unknown"],
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._max_depth = self._MAX_DEPTH[self.strategy]
        self._depth_m = round(random.uniform(50.0, self._max_depth * 0.6), 1)
        self._target_depth = round(random.uniform(50.0, self._max_depth * 0.8), 1)
        self._speed_knots = round(random.uniform(3.0, 20.0), 1)
        self._heading_deg = random.randint(0, 359)
        self._trim_deg = round(random.uniform(-5.0, 5.0), 1)
        self._ballast_fwd_pct = round(random.uniform(30.0, 70.0), 1)
        self._ballast_aft_pct = round(random.uniform(30.0, 70.0), 1)
        self._hull_pressure_pct = round(random.uniform(40.0, 80.0), 1)
        self._reactor_output_pct = round(random.uniform(50.0, 95.0), 1)
        self._o2_pct = round(random.uniform(19.0, 21.5), 1)
        self._sweep_angle = 0.0
        self._contacts = self._build_contacts()

    def _build_contacts(self):
        types = self._CONTACT_TYPES[self.strategy]
        count = random.randint(2, 5)
        contacts = []
        for i in range(count):
            contacts.append({
                "id": f"CON-{i+1:02d}",
                "bearing": random.randint(0, 359),
                "range_m": random.randint(200, 8000),
                "type": random.choice(types),
                "depth_m": round(random.uniform(0, self._max_depth * 0.5), 0),
                "confidence": random.randint(20, 90),
            })
        return contacts

    def _get_state(self):
        return {
            "depth_m": self._depth_m,
            "target_depth_m": self._target_depth,
            "max_depth_m": self._max_depth,
            "speed_knots": self._speed_knots,
            "heading_deg": self._heading_deg,
            "trim_deg": self._trim_deg,
            "ballast_fwd_pct": self._ballast_fwd_pct,
            "ballast_aft_pct": self._ballast_aft_pct,
            "hull_pressure_pct": self._hull_pressure_pct,
            "reactor_output_pct": self._reactor_output_pct,
            "o2_pct": self._o2_pct,
            "sweep_angle": round(self._sweep_angle, 1),
            "contacts": [dict(c) for c in self._contacts],
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        # Strip max_depth_m (static)
        return {
            "_delta": True,
            "depth_m": new_state["depth_m"],
            "target_depth_m": new_state["target_depth_m"],
            "speed_knots": new_state["speed_knots"],
            "heading_deg": new_state["heading_deg"],
            "trim_deg": new_state["trim_deg"],
            "ballast_fwd_pct": new_state["ballast_fwd_pct"],
            "ballast_aft_pct": new_state["ballast_aft_pct"],
            "hull_pressure_pct": new_state["hull_pressure_pct"],
            "reactor_output_pct": new_state["reactor_output_pct"],
            "o2_pct": new_state["o2_pct"],
            "sweep_angle": new_state["sweep_angle"],
            "contacts": new_state["contacts"],
        }

    def next_frame(self) -> dict:
        # Depth approaches target
        diff = self._target_depth - self._depth_m
        self._depth_m = round(max(0.0, min(self._max_depth,
            self._depth_m + diff * 0.01 + random.uniform(-1.0, 1.0))), 1)

        # Occasionally change target depth
        if random.random() < 0.005:
            self._target_depth = round(random.uniform(30.0, self._max_depth * 0.9), 1)

        # Hull pressure tracks depth
        self._hull_pressure_pct = round(
            max(0.0, min(100.0, (self._depth_m / self._max_depth) * 100.0 + random.uniform(-2, 2))), 1)

        # Speed drift
        self._speed_knots = round(max(0.0, min(30.0, self._speed_knots + random.uniform(-0.5, 0.5))), 1)

        # Heading drift
        self._heading_deg = (self._heading_deg + random.randint(-2, 2)) % 360

        # Trim
        self._trim_deg = round(max(-15.0, min(15.0, self._trim_deg + random.uniform(-0.3, 0.3))), 1)

        # Ballast
        self._ballast_fwd_pct = round(max(0.0, min(100.0, self._ballast_fwd_pct + random.uniform(-1.0, 1.0))), 1)
        self._ballast_aft_pct = round(max(0.0, min(100.0, self._ballast_aft_pct + random.uniform(-1.0, 1.0))), 1)

        # Reactor output
        self._reactor_output_pct = round(max(20.0, min(100.0, self._reactor_output_pct + random.uniform(-1.0, 1.0))), 1)

        # O2
        self._o2_pct = round(max(16.0, min(22.0, self._o2_pct + random.uniform(-0.1, 0.1))), 1)

        # Sonar sweep
        self._sweep_angle = (self._sweep_angle + 6) % 360

        # Evolve contacts
        for c in self._contacts:
            c["bearing"] = (c["bearing"] + random.randint(-3, 3)) % 360
            c["range_m"] = max(100, min(15000, c["range_m"] + random.randint(-100, 100)))
            if random.random() < 0.02:
                c["confidence"] = max(0, c["confidence"] - random.randint(5, 15))
            elif random.random() < 0.05:
                c["confidence"] = min(100, c["confidence"] + random.randint(1, 5))

        # Remove dead contacts
        self._contacts = [c for c in self._contacts if c["confidence"] > 0]

        # New contacts
        if random.random() < 0.03 and len(self._contacts) < 7:
            types = self._CONTACT_TYPES[self.strategy]
            self._contacts.append({
                "id": f"CON-{random.randint(10,99)}",
                "bearing": random.randint(0, 359),
                "range_m": random.randint(500, 10000),
                "type": random.choice(types),
                "depth_m": round(random.uniform(0, self._max_depth * 0.5), 0),
                "confidence": random.randint(10, 40),
            })

        # Ensure minimum contacts
        while len(self._contacts) < 2:
            types = self._CONTACT_TYPES[self.strategy]
            self._contacts.append({
                "id": f"CON-{random.randint(10,99)}",
                "bearing": random.randint(0, 359),
                "range_m": random.randint(500, 8000),
                "type": random.choice(types),
                "depth_m": round(random.uniform(0, self._max_depth * 0.5), 0),
                "confidence": random.randint(20, 50),
            })

        return self._get_state()
