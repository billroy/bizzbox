"""Fake 3D radar/scope sweep generator."""
import random
import math
from .base import BaseActivity


class RadarActivity(BaseActivity):
    activity_type = "radar"
    strategies = ["air_traffic", "submarine_sonar", "weather_radar", "missile_defense", "astronomy"]
    titles = [
        "RADAR SWEEP", "SECTOR SCAN", "RANGE FINDER",
        "TRACKING RADAR", "PHASED ARRAY", "SONAR DISPLAY",
        "CELESTIAL RADAR",
    ]

    BLIP_LABELS = {
        "air_traffic": [
            "UAL2847", "DAL441", "AAL103", "SWA1923", "BAW287",
            "AFR447", "KLM652", "JAL717", "UNKNOWN", "MIL-7749",
        ],
        "submarine_sonar": [
            "CONTACT-ALPHA", "CONTACT-BRAVO", "SURFACE-VESSEL",
            "UNKNOWN-SUB", "BIOLOGICS", "DIESEL-CONTACT", "CAVITATION",
        ],
        "weather_radar": [
            "CELL-A", "CELL-B", "STORM-FRONT", "HIGH-PRESSURE",
            "PRECIP-ZONE", "TORNADO-WARN", "GUST-FRONT",
        ],
        "missile_defense": [
            "TRK-047", "TRK-048", "ICBM-CLASS", "MRBM-TRACK",
            "DECOY-?", "INTERCEPTOR", "DEBRIS-FIELD",
        ],
        "astronomy": [
            "2024-BX1", "433 EROS", "COMET-C/2024", "ASTEROID-B612",
            "DEBRIS-47291", "SATELLITE", "NEO-TRACK",
        ],
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._sweep_angle = random.uniform(0, math.pi * 2)
        self._sweep_speed = random.uniform(0.8, 2.0)  # rad/sec
        self._blips = self._make_blips()
        self._range_rings = random.randint(3, 5)

    def _make_blips(self):
        labels = self.BLIP_LABELS[self.strategy]
        count = random.randint(3, 8)
        blips = []
        for _ in range(count):
            angle = random.uniform(0, math.pi * 2)
            distance = random.uniform(0.1, 0.9)
            blips.append({
                "angle": round(angle, 3),
                "distance": round(distance, 3),
                "label": random.choice(labels),
                "age": random.randint(0, 100),
                "intensity": round(random.uniform(0.4, 1.0), 2),
            })
        return blips

    def _get_state(self):
        return {
            "blips": self._blips,
            "sweep_angle": round(self._sweep_angle % (math.pi * 2), 4),
            "sweep_speed": round(self._sweep_speed, 3),
            "range_rings": self._range_rings,
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        # Advance sweep
        self._sweep_angle += self._sweep_speed * 0.2
        # Age blips, fade old ones
        for b in self._blips:
            b["age"] += random.randint(1, 5)
        # Remove very old blips
        self._blips = [b for b in self._blips if b["age"] < 200]
        # Add new blips near sweep angle
        if random.random() > 0.4:
            angle = self._sweep_angle + random.uniform(-0.3, 0.3)
            distance = random.uniform(0.1, 0.9)
            labels = self.BLIP_LABELS[self.strategy]
            self._blips.append({
                "angle": round(angle % (math.pi * 2), 3),
                "distance": round(distance, 3),
                "label": random.choice(labels) if random.random() > 0.3 else "???",
                "age": 0,
                "intensity": round(random.uniform(0.6, 1.0), 2),
            })
        # Limit blip count
        if len(self._blips) > 12:
            self._blips = sorted(self._blips, key=lambda b: b["age"])[:12]
        return self._get_state()
