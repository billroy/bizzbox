"""Geographic map with moving markers generator."""
import random
import math
from .base import BaseActivity


class GeoMapActivity(BaseActivity):
    activity_type = "geo_map"
    strategies = ["flight_tracker", "shipping_lanes", "military_ops", "pandemic_spread", "asset_tracking"]
    titles = [
        "GEO TRACKER", "WORLD MAP", "TACTICAL DISPLAY",
        "ASSET MAP", "GLOBAL MONITOR", "MISSION MAP",
        "LOGISTICS TRACKER",
    ]

    MARKER_LABELS = {
        "flight_tracker":  ["UAL{n}", "DAL{n}", "BAW{n}", "AFR{n}", "CARGO-{n}", "MIL-{n}"],
        "shipping_lanes":  ["MSC-{n}", "EVER-{n}", "YANG-{n}", "CARGO-{n}", "TANKER-{n}"],
        "military_ops":    ["BRAVO-{n}", "DELTA-{n}", "ALPHA-{n}", "RECON-{n}", "SUPPLY-{n}"],
        "pandemic_spread": ["REGION-{n}", "CLUSTER-{n}", "HOTSPOT-{n}", "CONTAINED-{n}"],
        "asset_tracking":  ["PKG-{n}", "TRUCK-{n}", "DEPOT-{n}", "DRONE-{n}", "VAN-{n}"],
    }

    def _format_label(self, template):
        return template.replace("{n}", str(random.randint(100, 9999)))

    def _make_marker(self):
        labels = self.MARKER_LABELS[self.strategy]
        angle = random.uniform(0, math.pi * 2)
        speed = random.uniform(0.002, 0.012)
        return {
            "id": random.randint(1000, 9999),
            "x": round(random.uniform(0.05, 0.95), 3),
            "y": round(random.uniform(0.1, 0.9), 3),
            "label": self._format_label(random.choice(labels)),
            "angle": round(angle, 3),
            "speed": round(speed, 4),
            "active": True,
            "trail": [],
            "size": round(random.uniform(0.8, 2.0), 2) if self.strategy == "pandemic_spread" else 1.0,
        }

    # Simplified continent outlines as normalized [0,1] polygon coordinate arrays
    # These are very rough approximations for visual effect only
    LAND_MASSES = [
        # North America (rough)
        [0.05, 0.1, 0.28, 0.08, 0.32, 0.18, 0.26, 0.35, 0.2, 0.45, 0.14, 0.4, 0.05, 0.3],
        # South America (rough)
        [0.18, 0.47, 0.28, 0.44, 0.32, 0.55, 0.28, 0.75, 0.2, 0.78, 0.15, 0.65, 0.18, 0.47],
        # Europe (rough)
        [0.42, 0.1, 0.55, 0.08, 0.58, 0.18, 0.52, 0.25, 0.45, 0.22, 0.42, 0.1],
        # Africa (rough)
        [0.44, 0.25, 0.56, 0.24, 0.58, 0.38, 0.55, 0.58, 0.48, 0.65, 0.42, 0.55, 0.4, 0.4, 0.44, 0.25],
        # Asia (rough)
        [0.55, 0.08, 0.85, 0.1, 0.88, 0.25, 0.82, 0.35, 0.72, 0.38, 0.65, 0.3, 0.58, 0.18, 0.55, 0.08],
        # Australia (rough)
        [0.74, 0.55, 0.88, 0.52, 0.9, 0.65, 0.82, 0.72, 0.74, 0.68, 0.72, 0.58, 0.74, 0.55],
    ]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        count = random.randint(4, 10)
        self._markers = [self._make_marker() for _ in range(count)]

    def _get_state(self):
        return {
            "markers": self._markers,
            "land_masses": self.LAND_MASSES,
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        for m in self._markers:
            # Move marker along its heading
            dx = m["speed"] * math.cos(m["angle"])
            dy = m["speed"] * math.sin(m["angle"])
            m["x"] = round((m["x"] + dx) % 1.0, 3)
            m["y"] = round(max(0.05, min(0.95, m["y"] + dy * 0.3)), 3)
            # Slight direction drift
            m["angle"] = round(m["angle"] + random.uniform(-0.08, 0.08), 3)
            # Update trail (keep last 8 positions)
            m["trail"].append({"x": m["x"], "y": m["y"]})
            if len(m["trail"]) > 8:
                m["trail"] = m["trail"][-8:]
            # Pandemic: size fluctuates
            if self.strategy == "pandemic_spread":
                m["size"] = round(max(0.3, min(3.0, m["size"] + random.uniform(-0.1, 0.15))), 2)
        # Occasionally add/remove marker
        if len(self._markers) < 12 and random.random() > 0.8:
            self._markers.append(self._make_marker())
        if len(self._markers) > 3 and random.random() > 0.9:
            self._markers.pop(random.randrange(len(self._markers)))
        return self._get_state()
