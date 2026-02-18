"""Color weather radar with line-drawn geography on black background."""
import random
import math
from .base import BaseActivity


class WeatherRadarActivity(BaseActivity):
    activity_type = "weather_radar"
    strategies = ["thunderstorm", "tropical_system", "winter_storm", "scattered_showers", "clear"]
    titles = [
        "WEATHER RADAR", "NEXRAD DISPLAY", "DOPPLER RADAR",
        "PRECIP RADAR", "STORM TRACKER", "WX RADAR",
    ]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._geography = self._generate_geography()
        self._highways = self._generate_highways()
        self._cells = self._generate_cells()
        self._tick = 0

    def _generate_geography(self):
        """Generate random coastlines and state borders as polylines."""
        features = []
        # Coastlines (1-3 wavy lines)
        for _ in range(random.randint(1, 3)):
            pts = []
            x = random.uniform(0.0, 0.3)
            y = random.uniform(0.0, 0.2)
            direction = random.uniform(0.5, 2.5)
            for _ in range(random.randint(8, 16)):
                pts.append({"x": round(x, 3), "y": round(y, 3)})
                x += random.uniform(0.03, 0.08) * math.cos(direction)
                y += random.uniform(0.03, 0.08) * math.sin(direction)
                direction += random.uniform(-0.4, 0.4)
                x = max(0.0, min(1.0, x))
                y = max(0.0, min(1.0, y))
            features.append({"points": pts, "type": "coast"})

        # State borders (2-4 straight-ish lines)
        for _ in range(random.randint(2, 4)):
            pts = []
            x = random.uniform(0.0, 1.0)
            y = random.uniform(0.0, 1.0)
            angle = random.uniform(0, math.pi)
            for _ in range(random.randint(3, 6)):
                pts.append({"x": round(x, 3), "y": round(y, 3)})
                x += 0.15 * math.cos(angle)
                y += 0.15 * math.sin(angle)
                angle += random.uniform(-0.2, 0.2)
                x = max(0.0, min(1.0, x))
                y = max(0.0, min(1.0, y))
            features.append({"points": pts, "type": "border"})
        return features

    def _generate_highways(self):
        """Generate random highway lines."""
        highways = []
        labels = ["I-95", "I-80", "I-10", "I-40", "I-70", "US-1", "US-20",
                  "SR-101", "I-5", "I-75", "US-66", "I-35"]
        for _ in range(random.randint(3, 6)):
            pts = []
            x = random.uniform(0.05, 0.95)
            y = random.uniform(0.05, 0.95)
            angle = random.uniform(0, math.pi * 2)
            for _ in range(random.randint(4, 8)):
                pts.append({"x": round(x, 3), "y": round(y, 3)})
                x += random.uniform(0.08, 0.15) * math.cos(angle)
                y += random.uniform(0.08, 0.15) * math.sin(angle)
                angle += random.uniform(-0.3, 0.3)
                x = max(0.02, min(0.98, x))
                y = max(0.02, min(0.98, y))
            highways.append({
                "points": pts,
                "label": random.choice(labels),
            })
        return highways

    def _generate_cells(self):
        """Generate weather cells based on strategy."""
        cells = []
        if self.strategy == "clear":
            # Very few, weak cells
            count = random.randint(0, 2)
        elif self.strategy == "scattered_showers":
            count = random.randint(4, 8)
        elif self.strategy == "thunderstorm":
            count = random.randint(3, 6)
        elif self.strategy == "tropical_system":
            count = random.randint(5, 10)
        elif self.strategy == "winter_storm":
            count = random.randint(4, 8)
        else:
            count = random.randint(2, 5)

        for _ in range(count):
            cell = self._make_cell()
            cells.append(cell)
        return cells

    def _make_cell(self):
        if self.strategy == "tropical_system":
            # Cells clustered around a center
            cx = random.uniform(0.3, 0.7)
            cy = random.uniform(0.3, 0.7)
            x = cx + random.gauss(0, 0.15)
            y = cy + random.gauss(0, 0.15)
            intensity = random.uniform(0.4, 1.0)
            radius = random.uniform(0.05, 0.15)
        elif self.strategy == "thunderstorm":
            x = random.uniform(0.1, 0.9)
            y = random.uniform(0.1, 0.9)
            intensity = random.uniform(0.5, 1.0)
            radius = random.uniform(0.03, 0.1)
        elif self.strategy == "winter_storm":
            x = random.uniform(0.1, 0.9)
            y = random.uniform(0.1, 0.9)
            intensity = random.uniform(0.2, 0.7)
            radius = random.uniform(0.06, 0.18)
        else:
            x = random.uniform(0.1, 0.9)
            y = random.uniform(0.1, 0.9)
            intensity = random.uniform(0.1, 0.6)
            radius = random.uniform(0.03, 0.08)

        cell_type = "rain"
        if self.strategy == "winter_storm":
            cell_type = random.choice(["snow", "snow", "ice", "rain"])
        elif self.strategy == "thunderstorm" and intensity > 0.7:
            cell_type = "severe"

        return {
            "x": round(max(0.02, min(0.98, x)), 3),
            "y": round(max(0.02, min(0.98, y)), 3),
            "radius": round(radius, 3),
            "intensity": round(intensity, 2),
            "type": cell_type,
            "dx": round(random.uniform(-0.008, 0.008), 4),
            "dy": round(random.uniform(-0.008, 0.008), 4),
        }

    def _get_state(self):
        return {
            "cells": [
                {"x": c["x"], "y": c["y"], "radius": c["radius"],
                 "intensity": c["intensity"], "type": c["type"]}
                for c in self._cells
            ],
            "geography": self._geography,
            "highways": self._highways,
            "timestamp": f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d} "
                         f"{random.randint(0,23):02d}:{random.randint(0,59):02d}Z",
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        self._tick += 1
        # Drift cells
        for c in self._cells:
            c["x"] += c["dx"]
            c["y"] += c["dy"]
            c["x"] = max(0.02, min(0.98, c["x"]))
            c["y"] = max(0.02, min(0.98, c["y"]))
            # Fluctuate intensity
            c["intensity"] += random.uniform(-0.05, 0.05)
            c["intensity"] = round(max(0.0, min(1.0, c["intensity"])), 2)
            # Fluctuate radius
            c["radius"] += random.uniform(-0.005, 0.005)
            c["radius"] = round(max(0.02, min(0.2, c["radius"])), 3)

        # Remove dead cells
        self._cells = [c for c in self._cells if c["intensity"] > 0.02]

        # Spawn new cells occasionally
        if random.random() > 0.6 and len(self._cells) < 12:
            self._cells.append(self._make_cell())

        return self._get_state()
