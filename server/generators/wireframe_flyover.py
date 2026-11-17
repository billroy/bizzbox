"""Animated wireframe flyovers of recognizable cities and spacecraft."""
import math
import random

from .base import BaseActivity


class WireframeFlyoverActivity(BaseActivity):
    activity_type = "wireframe_flyover"
    strategies = [
        "downtown_canyon", "urban_transit", "spaceport_approach",
        "capital_ship_flyby", "orbital_shipyard",
    ]
    titles = [
        "WIREFRAME FLYOVER", "URBAN DIGITAL TWIN", "SPACEFRAME RECON",
        "AUTONOMOUS FLIGHT PATH", "STRUCTURAL OVERFLIGHT",
    ]
    update_interval_override = 0.25

    _CONFIG = {
        "downtown_canyon": ("DRONE", "DOWNTOWN DIGITAL TWIN", 1.1, "urban"),
        "urban_transit": ("AIR", "METROPOLITAN TRANSIT GRID", 1.45, "urban"),
        "spaceport_approach": ("AIR", "ORBITAL LAUNCH DISTRICT", 1.7, "spaceport"),
        "capital_ship_flyby": ("DRONE", "CV-88 CAPITAL SHIP", 1.25, "starship"),
        "orbital_shipyard": ("DRONE", "ORBITAL ASSEMBLY YARD", 1.0, "shipyard"),
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._progress = random.random()
        self._seed = random.randint(1000, 999999)
        self._craft, self._site, self._speed, self._scene = self._CONFIG[self.strategy]
        self._structures = self._make_structures()
        self._path = self._make_path()

    def _building(self, rng, x, z, kind=None, scale=1.0):
        kind = kind or rng.choice(["office", "residential", "setback", "spire", "civic"])
        width = rng.uniform(3.8, 7.5) * scale
        depth = rng.uniform(3.8, 7.5) * scale
        height = rng.uniform(8, 30) * scale
        return {
            "x": round(x, 2), "z": round(z, 2), "w": round(width, 2),
            "d": round(depth, 2), "h": round(height, 2), "kind": kind,
            "floors": max(3, int(height / rng.uniform(2.2, 3.1))),
            "setbacks": rng.randint(1, 3) if kind in ("setback", "spire") else 0,
            "roof": rng.choice(["flat", "antenna", "mechanical", "helipad"]),
        }

    def _make_structures(self):
        rng = random.Random(self._seed)
        items = []
        if self._scene == "urban":
            for block in range(15):
                z = block * 8 - 14
                for side in (-1, 1):
                    x = side * rng.uniform(8.5, 12.5)
                    items.append(self._building(rng, x, z))
                    if rng.random() > .5:
                        items.append(self._building(rng, x + side * rng.uniform(5, 8), z + rng.uniform(-2, 2), scale=.65))
            items.extend([
                {"x": 0, "z": 42, "w": 18, "d": 2, "h": 5, "kind": "skybridge", "floors": 1, "setbacks": 0, "roof": "flat"},
                {"x": -17, "z": 67, "w": 10, "d": 10, "h": 42, "kind": "spire", "floors": 17, "setbacks": 3, "roof": "antenna"},
            ])
        elif self._scene == "spaceport":
            for index in range(12):
                side = -1 if index % 2 else 1
                items.append({"x": side * rng.uniform(10, 20), "z": index * 9 - 8, "w": rng.uniform(6, 12),
                              "d": rng.uniform(7, 15), "h": rng.uniform(3, 8), "kind": rng.choice(["hangar", "terminal", "tank_farm"]),
                              "floors": 2, "setbacks": 0, "roof": "mechanical"})
            items.extend([
                {"x": 12, "z": 58, "w": 8, "d": 8, "h": 34, "kind": "launch_tower", "floors": 12, "setbacks": 0, "roof": "crane"},
                {"x": 3, "z": 58, "w": 5, "d": 5, "h": 27, "kind": "rocket", "floors": 5, "setbacks": 0, "roof": "nose"},
            ])
        else:
            for index in range(18):
                z = index * 6 - 12
                half = 5 + math.sin(index / 17 * math.pi) * (9 if self._scene == "starship" else 5)
                items.append({"x": 0, "z": z, "w": half * 2, "d": 6.3, "h": rng.uniform(2.5, 5.5),
                              "kind": "hull", "floors": 2, "setbacks": 0, "roof": "greeble"})
                if index in (4, 8, 12):
                    items.append({"x": rng.choice([-1, 1]) * half * .55, "z": z, "w": 4, "d": 5, "h": rng.uniform(7, 13),
                                  "kind": "superstructure", "floors": 4, "setbacks": 1, "roof": "antenna"})
            if self._scene == "shipyard":
                for z in (2, 32, 62, 92):
                    items.append({"x": -17, "z": z, "w": 3, "d": 4, "h": 20, "kind": "gantry", "floors": 6, "setbacks": 0, "roof": "crane"})
                    items.append({"x": 17, "z": z, "w": 3, "d": 4, "h": 20, "kind": "gantry", "floors": 6, "setbacks": 0, "roof": "crane"})
        return items

    def _make_path(self):
        altitude = 5.0 if self._scene == "urban" else (8.0 if self._scene == "spaceport" else 9.5)
        points = []
        for index in range(28):
            t = index / 27
            x = math.sin(t * math.pi * 3) * (1.8 if self._scene == "urban" else 3.2)
            y = altitude + math.sin(t * math.pi * 2) * (.45 if self._scene == "urban" else 1.2)
            points.append([round(x, 2), round(y, 2), round(t * 118 - 12, 2)])
        return points

    def _state(self):
        return {
            "strategy": self.strategy, "scene": self._scene, "seed": self._seed,
            "craft": self._craft, "site": self._site, "speed": self._speed,
            "progress": round(self._progress, 4), "structures": self._structures,
            "path": self._path, "altitude": round(self._path[0][1], 1),
        }

    def initial_payload(self):
        return self._state()

    def next_frame(self):
        self._progress = (self._progress + self._speed * 0.0025) % 1.0
        return self._state()

    def compute_delta(self, old_state, new_state):
        return {"_delta": True, "progress": new_state["progress"]}
