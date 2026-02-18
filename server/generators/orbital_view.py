"""Orbital satellite view with rotating Earth projection."""
import random
import math
from .base import BaseActivity

_TWO_PI = 2 * math.pi


def _make_satellite(orbit_type: str) -> dict:
    """Create a satellite with orbital parameters."""
    if orbit_type == "leo":
        alt = random.uniform(0.05, 0.15)  # normalized altitude above unit sphere
    elif orbit_type == "meo":
        alt = random.uniform(0.2, 0.4)
    else:  # geo
        alt = random.uniform(0.5, 0.7)
    return {
        "inclination": round(random.uniform(0, math.pi), 4),
        "raan": round(random.uniform(0, _TWO_PI), 4),   # right ascension
        "arg_perigee": round(random.uniform(0, _TWO_PI), 4),
        "altitude": round(alt, 4),
        "phase": round(random.uniform(0, _TWO_PI), 4),  # current orbital position
        "speed": round(random.uniform(0.002, 0.008) / max(0.1, alt), 4),
        "label": f"SAT-{random.randint(100, 999)}",
        "orbit_type": orbit_type,
    }


# Strategy configs: how many of each orbit type
_FLEET_CONFIGS = {
    "leo_constellation": {"leo": 20, "meo": 4, "geo": 1},
    "gps_network":       {"leo": 2, "meo": 18, "geo": 4},
    "spy_satellites":    {"leo": 8, "meo": 3, "geo": 2},
    "space_debris":      {"leo": 25, "meo": 8, "geo": 2},
    "comms_relay":       {"leo": 3, "meo": 6, "geo": 12},
}


class OrbitalViewActivity(BaseActivity):
    activity_type = "orbital_view"
    strategies = list(_FLEET_CONFIGS.keys())
    titles = ["ORBITAL VIEW", "SAT TRACKER", "ORBIT MONITOR", "SPACE TRACK", "CONSTELLATION"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        cfg = _FLEET_CONFIGS[self.strategy]
        self._satellites = []
        for orbit_type, count in cfg.items():
            for _ in range(count):
                self._satellites.append(_make_satellite(orbit_type))
        self._rotation = 0.0  # Earth rotation angle

    def _get_positions(self) -> list[dict]:
        """Compute 3D position for each satellite, project to 2D."""
        positions = []
        for sat in self._satellites:
            # Orbital position in orbital plane
            theta = sat["phase"]
            r = 1.0 + sat["altitude"]

            # Position in orbital plane
            x_orb = r * math.cos(theta)
            y_orb = r * math.sin(theta)

            # Rotate by argument of perigee
            ap = sat["arg_perigee"]
            x1 = x_orb * math.cos(ap) - y_orb * math.sin(ap)
            y1 = x_orb * math.sin(ap) + y_orb * math.cos(ap)

            # Tilt by inclination
            inc = sat["inclination"]
            x2 = x1
            y2 = y1 * math.cos(inc)
            z2 = y1 * math.sin(inc)

            # Rotate by RAAN
            raan = sat["raan"]
            x3 = x2 * math.cos(raan) - y2 * math.sin(raan)
            y3 = x2 * math.sin(raan) + y2 * math.cos(raan)
            z3 = z2

            # Apply Earth rotation
            cr = math.cos(self._rotation)
            sr = math.sin(self._rotation)
            xf = x3 * cr - y3 * sr
            yf = x3 * sr + y3 * cr
            zf = z3

            positions.append({
                "x": round(xf, 4),
                "y": round(yf, 4),
                "z": round(zf, 4),
                "label": sat["label"],
                "orbit_type": sat["orbit_type"],
            })
        return positions

    def _get_state(self) -> dict:
        return {
            "satellites": self._get_positions(),
            "rotation": round(self._rotation, 4),
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        # Advance satellite phases
        for sat in self._satellites:
            sat["phase"] = (sat["phase"] + sat["speed"]) % _TWO_PI
        # Rotate Earth slowly
        self._rotation = (self._rotation + 0.005) % _TWO_PI
        return self._get_state()
