"""Rotating wireframe globe with animated connection arcs."""
import random
import math
from .base import BaseActivity

_TWO_PI = 2 * math.pi

# City nodes per strategy
_CITIES = {
    "cdn_network": [
        ("NYC", 40.7, -74.0), ("LON", 51.5, -0.1), ("TYO", 35.7, 139.7),
        ("SFO", 37.8, -122.4), ("SIN", 1.3, 103.8), ("SYD", -33.9, 151.2),
        ("FRA", 50.1, 8.7), ("SAO", -23.5, -46.6), ("MUM", 19.1, 72.9),
        ("SEA", 47.6, -122.3), ("AMS", 52.4, 4.9), ("HKG", 22.3, 114.2),
    ],
    "cyber_attacks": [
        ("WASH", 38.9, -77.0), ("BEIJING", 39.9, 116.4), ("MOSCOW", 55.8, 37.6),
        ("LONDON", 51.5, -0.1), ("TEL AVIV", 32.1, 34.8), ("PYONGYANG", 39.0, 125.7),
        ("TEHRAN", 35.7, 51.4), ("BERLIN", 52.5, 13.4), ("TOKYO", 35.7, 139.7),
        ("DELHI", 28.6, 77.2), ("SYDNEY", -33.9, 151.2), ("BRASILIA", -15.8, -47.9),
    ],
    "trade_routes": [
        ("SHANGHAI", 31.2, 121.5), ("ROTTERDAM", 51.9, 4.5), ("SINGAPORE", 1.3, 103.8),
        ("DUBAI", 25.2, 55.3), ("LOS ANGELES", 34.1, -118.2), ("HAMBURG", 53.6, 10.0),
        ("BUSAN", 35.2, 129.1), ("HONG KONG", 22.3, 114.2), ("MUMBAI", 19.1, 72.9),
        ("SANTOS", -23.9, -46.3), ("ANTWERP", 51.2, 4.4), ("TOKYO", 35.7, 139.7),
    ],
    "submarine_cables": [
        ("NYC", 40.7, -74.0), ("CORNWALL", 50.3, -5.0), ("MARSEILLE", 43.3, 5.4),
        ("ALEXANDRIA", 31.2, 29.9), ("MUMBAI", 19.1, 72.9), ("SINGAPORE", 1.3, 103.8),
        ("TOKYO", 35.7, 139.7), ("SAN JOSE", 37.3, -121.9), ("SYDNEY", -33.9, 151.2),
        ("FORTALEZA", -3.7, -38.5), ("DAKAR", 14.7, -17.4), ("CAPE TOWN", -33.9, 18.4),
    ],
    "airline_routes": [
        ("JFK", 40.6, -73.8), ("LHR", 51.5, -0.5), ("DXB", 25.3, 55.4),
        ("SIN", 1.4, 104.0), ("HND", 35.5, 139.8), ("LAX", 33.9, -118.4),
        ("CDG", 49.0, 2.5), ("FRA", 50.0, 8.6), ("ICN", 37.5, 126.5),
        ("SYD", -33.9, 151.2), ("GRU", -23.4, -46.5), ("ATL", 33.6, -84.4),
    ],
}

_MAX_ARCS = 8
_ARC_LIFETIME = 40  # frames before an arc fades


def _latlon_to_xyz(lat_deg, lon_deg):
    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    x = math.cos(lat) * math.cos(lon)
    y = math.cos(lat) * math.sin(lon)
    z = math.sin(lat)
    return (x, y, z)


class GlobeArcsActivity(BaseActivity):
    activity_type = "globe_arcs"
    strategies = list(_CITIES.keys())
    titles = ["GLOBE NET", "CYBER MAP", "TRADE MAP", "CABLE MAP", "AIR ROUTES"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        cities = _CITIES[self.strategy]
        self._nodes = [
            {"name": name, "lat": lat, "lon": lon, "xyz": _latlon_to_xyz(lat, lon)}
            for name, lat, lon in cities
        ]
        # Create initial arcs
        self._arcs = [self._make_arc() for _ in range(random.randint(3, _MAX_ARCS))]
        self._rotation = 0.0

    def _make_arc(self) -> dict:
        src, dst = random.sample(range(len(self._nodes)), 2)
        return {
            "src": src,
            "dst": dst,
            "age": 0,
            "progress": round(random.uniform(0, 0.8), 3),
        }

    def _rotate_point(self, xyz):
        """Apply Y-axis rotation."""
        x, y, z = xyz
        c = math.cos(self._rotation)
        s = math.sin(self._rotation)
        return (x * c - y * s, x * s + y * c, z)

    def _get_state(self) -> dict:
        # Project all nodes
        nodes = []
        for node in self._nodes:
            rx, ry, rz = self._rotate_point(node["xyz"])
            nodes.append({
                "name": node["name"],
                "x": round(rx, 4),
                "y": round(ry, 4),
                "z": round(rz, 4),
            })

        arcs = []
        for arc in self._arcs:
            arcs.append({
                "src": arc["src"],
                "dst": arc["dst"],
                "progress": round(arc["progress"], 3),
                "age": arc["age"],
            })

        return {
            "nodes": nodes,
            "arcs": arcs,
            "rotation": round(self._rotation, 4),
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        # Strip strategy (static), strip node names (static)
        nodes = [{"x": n["x"], "y": n["y"], "z": n["z"]} for n in new_state["nodes"]]
        return {
            "_delta": True,
            "nodes": nodes,
            "arcs": new_state["arcs"],
            "rotation": new_state["rotation"],
        }

    def next_frame(self) -> dict:
        # Rotate globe
        self._rotation = (self._rotation + 0.008) % _TWO_PI

        # Update arcs
        new_arcs = []
        for arc in self._arcs:
            arc["age"] += 1
            arc["progress"] = min(1.0, arc["progress"] + random.uniform(0.02, 0.06))
            if arc["age"] < _ARC_LIFETIME:
                new_arcs.append(arc)
        self._arcs = new_arcs

        # Spawn new arcs
        if len(self._arcs) < _MAX_ARCS and random.random() < 0.2:
            self._arcs.append(self._make_arc())

        return self._get_state()
