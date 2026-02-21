"""CCTV Mosaic — 2x2 multi-camera surveillance grid generator."""
import random
from .base import BaseActivity

_CAM_LABELS = {
    "building_lobby": ["LOBBY-1", "ELEVATOR-A", "STAIRWELL-B", "ENTRANCE"],
    "parking_garage": ["LEVEL-P1", "RAMP-A", "EXIT-GATE", "LEVEL-P2"],
    "warehouse": ["AISLE-7", "LOADING-DOCK", "FORKLIFT-BAY", "OFFICE-CAM"],
    "prison_block": ["CELL-BLOCK-A", "YARD-NORTH", "CORRIDOR-3", "CONTROL-RM"],
    "casino_floor": ["TABLE-PIT-1", "CAGE-CAM", "SLOT-HALL-E", "ENTRANCE-S"],
}

_SCENE_TYPES = {
    "building_lobby": ["hallway", "elevator", "stairwell", "entrance"],
    "parking_garage": ["lot", "corridor", "entrance", "lot"],
    "warehouse": ["corridor", "entrance", "room", "room"],
    "prison_block": ["corridor", "lot", "corridor", "room"],
    "casino_floor": ["room", "room", "hallway", "entrance"],
}

_STATUS_WEIGHTS = ["active"] * 85 + ["static"] * 10 + ["signal_lost"] * 5


def _make_camera(cam_id: int, strategy: str, index: int) -> dict:
    labels = _CAM_LABELS[strategy]
    scenes = _SCENE_TYPES[strategy]
    status = random.choice(_STATUS_WEIGHTS)
    return {
        "id": cam_id,
        "label": labels[index % len(labels)],
        "status": status,
        "noise_seed": random.randint(0, 99999),
        "brightness": round(random.uniform(0.5, 1.0), 2),
        "motion_detected": (random.random() < 0.3) if status == "active" else False,
        "scene_type": scenes[index % len(scenes)],
    }


class CctvMosaicActivity(BaseActivity):
    activity_type = "cctv_mosaic"
    strategies = list(_CAM_LABELS.keys())
    titles = [
        "CCTV MOSAIC", "SURVEILLANCE", "SECURITY MONITOR",
        "MULTI-CAM VIEW", "VIDEO WALL", "LIVE FEEDS",
        "WATCH STATION",
    ]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._cameras = [
            _make_camera(i, self.strategy, i) for i in range(4)
        ]

    def _get_state(self) -> dict:
        return {
            "cameras": [
                {
                    "id": cam["id"],
                    "label": cam["label"],
                    "status": cam["status"],
                    "noise_seed": cam["noise_seed"],
                    "brightness": cam["brightness"],
                    "motion_detected": cam["motion_detected"],
                    "scene_type": cam["scene_type"],
                }
                for cam in self._cameras
            ],
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        # Strip strategy, camera id/label/scene_type (static)
        cameras = []
        for c in new_state["cameras"]:
            cameras.append({
                "status": c["status"],
                "noise_seed": c["noise_seed"],
                "brightness": c["brightness"],
                "motion_detected": c["motion_detected"],
            })
        return {
            "_delta": True,
            "cameras": cameras,
        }

    def next_frame(self) -> dict:
        for cam in self._cameras:
            r = random.random()
            if cam["status"] == "active":
                # Small chance to degrade
                if r < 0.02:
                    cam["status"] = "static"
                    cam["noise_seed"] = random.randint(0, 99999)
                    cam["motion_detected"] = False
                elif r < 0.025:
                    cam["status"] = "signal_lost"
                    cam["motion_detected"] = False
                else:
                    # Drift brightness slightly
                    cam["brightness"] = round(
                        max(0.3, min(1.0, cam["brightness"] + random.gauss(0, 0.03))), 2
                    )
                    # Toggle motion randomly — 30 % chance of motion
                    cam["motion_detected"] = random.random() < 0.3
            elif cam["status"] == "static":
                cam["noise_seed"] = random.randint(0, 99999)
                cam["motion_detected"] = False
                if r < 0.15:
                    cam["status"] = "active"
                    cam["brightness"] = round(random.uniform(0.5, 1.0), 2)
            elif cam["status"] == "signal_lost":
                cam["motion_detected"] = False
                if r < 0.08:
                    cam["status"] = "active"
                    cam["brightness"] = round(random.uniform(0.5, 1.0), 2)

        return self._get_state()
