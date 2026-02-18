"""Simulated multi-camera security feed generator."""
import random
import math
import time
from .base import BaseActivity

_CAM_LABELS = {
    "building_security": [
        "LOBBY-CAM-01", "STAIRWELL-B2", "PARKING-L3", "SERVER-RM-04",
        "HALLWAY-2F", "ROOF-ACCESS", "ELEVATOR-01", "LOADING-DOCK",
        "RECEPTION-01", "ENTRANCE-N",
    ],
    "traffic_cams": [
        "I-95 MILE 42", "HWY-101 JCT", "BROADWAY/5TH", "TUNNEL-E",
        "BRIDGE-SPAN-2", "TOLL-PLAZA-N", "RAMP-EXIT-12", "DOWNTOWN-4TH",
        "AIRPORT-RD", "HIGHWAY-280",
    ],
    "satellite_feeds": [
        "GEO-SAT-07", "POLAR-ORB-3", "LANDSAT-9", "SENTINEL-2A",
        "WORLDVIEW-4", "GOES-EAST", "HIMAWARI-9", "NOAA-20",
        "TERRASAR-X", "SPOT-7",
    ],
    "drone_surveillance": [
        "DRONE-ALPHA", "DRONE-BRAVO", "DRONE-CHARLIE", "DRONE-DELTA",
        "UAV-RECON-01", "HALE-SURVEY", "QUAD-PATROL", "TILT-WING-2",
        "FIXED-WING-7", "VTOL-OPS-3",
    ],
    "underwater_cams": [
        "DEPTH-200M", "REEF-CAM-03", "TRENCH-PROBE", "ROV-DEEP-1",
        "PIPELINE-MON", "KELP-FOREST", "THERMAL-VENT", "AUV-SCOUT-2",
        "HARBOR-FLOOR", "SHELF-EDGE",
    ],
}

# Each camera can be in these states
_STATES = ["active", "static", "signal_lost"]
_ACTIVE_PROB = 0.85
_STATIC_PROB = 0.10
_LOST_PROB = 0.05

_GRID_SIZES = [(2, 2), (3, 3)]


def _make_camera(strategy: str) -> dict:
    label = random.choice(_CAM_LABELS[strategy])
    r = random.random()
    if r < _ACTIVE_PROB:
        status = "active"
    elif r < _ACTIVE_PROB + _STATIC_PROB:
        status = "static"
    else:
        status = "signal_lost"
    # Fake noise seed for client-side static generation
    return {
        "label": label,
        "status": status,
        "noise_seed": random.randint(0, 99999),
        "brightness": round(random.uniform(0.5, 1.0), 2),
        "motion_level": round(random.uniform(0, 1), 2) if status == "active" else 0,
    }


class CameraFeedActivity(BaseActivity):
    activity_type = "camera_feed"
    strategies = list(_CAM_LABELS.keys())
    titles = ["SECURITY CAM", "SURVEILLANCE", "CAM MONITOR", "FEED STATUS", "VIDEO WALL"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        rows, cols = random.choice(_GRID_SIZES)
        self._grid_rows = rows
        self._grid_cols = cols
        n_cams = rows * cols
        self._cameras = [_make_camera(self.strategy) for _ in range(n_cams)]

    def _get_state(self) -> dict:
        return {
            "cameras": [
                {
                    "label": cam["label"],
                    "status": cam["status"],
                    "noise_seed": cam["noise_seed"],
                    "brightness": cam["brightness"],
                    "motion_level": cam["motion_level"],
                }
                for cam in self._cameras
            ],
            "grid_rows": self._grid_rows,
            "grid_cols": self._grid_cols,
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        for cam in self._cameras:
            # Randomly transition camera states
            r = random.random()
            if cam["status"] == "active":
                if r < 0.02:
                    cam["status"] = "static"
                    cam["noise_seed"] = random.randint(0, 99999)
                elif r < 0.025:
                    cam["status"] = "signal_lost"
                else:
                    cam["motion_level"] = round(random.uniform(0, 1), 2)
                    cam["brightness"] = round(
                        max(0.3, min(1.0, cam["brightness"] + random.gauss(0, 0.03))), 2
                    )
            elif cam["status"] == "static":
                cam["noise_seed"] = random.randint(0, 99999)
                if r < 0.15:
                    cam["status"] = "active"
                    cam["motion_level"] = round(random.uniform(0, 0.5), 2)
            elif cam["status"] == "signal_lost":
                if r < 0.08:
                    cam["status"] = "active"
                    cam["motion_level"] = round(random.uniform(0, 0.3), 2)

        return self._get_state()
