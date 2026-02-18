"""Fake facial recognition / object detection overlay generator."""
import random
from .base import BaseActivity


class FacialRecognitionActivity(BaseActivity):
    activity_type = "facial_recognition"
    strategies = ["crowd_surveillance", "biometric_auth", "object_detection", "satellite_imagery", "medical_scan"]
    titles = [
        "BIOMETRIC SCAN", "FACE RECOGNITION", "OBJECT DETECTION",
        "SURVEILLANCE FEED", "PATTERN ANALYSIS", "IDENTITY VERIFY",
        "THREAT ASSESSMENT",
    ]

    OBJ_LABELS = {
        "crowd_surveillance": ["ID-{n}", "UNKNOWN", "FLAGGED-{n}", "CLEARED-{n}", "WATCHLIST"],
        "biometric_auth": ["SCANNING", "MATCH: {n}%", "LIVENESS OK", "SPOOFING?", "VERIFIED"],
        "object_detection": ["PERSON", "VEHICLE", "WEAPON?", "DEVICE", "BAG", "UNKNOWN"],
        "satellite_imagery": ["STRUCTURE", "VEHICLE CLUSTER", "ANOMALY", "PERSONNEL", "EQUIPMENT"],
        "medical_scan": ["REGION-A", "ANOMALY", "NORMAL TISSUE", "LESION?", "CALCIFICATION"],
    }

    def _rand_face(self):
        x = round(random.uniform(0.05, 0.75), 3)
        y = round(random.uniform(0.05, 0.65), 3)
        w = round(random.uniform(0.12, 0.22), 3)
        h = round(w * random.uniform(1.1, 1.4), 3)
        labels = self.OBJ_LABELS[self.strategy]
        label = random.choice(labels)
        import random as r
        label = label.replace("{n}", str(r.randint(1000, 9999)))
        return {
            "x": x, "y": y, "w": w, "h": h,
            "label": label,
            "confidence": round(random.uniform(0.55, 0.99), 2),
            "landmarks": self._rand_landmarks(x, y, w, h),
            "track_id": random.randint(100, 999),
        }

    def _rand_landmarks(self, x, y, w, h):
        if self.strategy != "biometric_auth":
            return []
        return [
            {"x": round(x + w * 0.3, 3), "y": round(y + h * 0.35, 3)},  # left eye
            {"x": round(x + w * 0.7, 3), "y": round(y + h * 0.35, 3)},  # right eye
            {"x": round(x + w * 0.5, 3), "y": round(y + h * 0.55, 3)},  # nose
            {"x": round(x + w * 0.35, 3), "y": round(y + h * 0.75, 3)}, # left mouth
            {"x": round(x + w * 0.65, 3), "y": round(y + h * 0.75, 3)}, # right mouth
        ]

    SCENE_LABELS = {
        "crowd_surveillance": ["PLAZA SECTOR B", "ENTRANCE GATE 3", "CONCOURSE LEVEL 2"],
        "biometric_auth": ["ACCESS CONTROL ZONE", "SECURE ENTRY", "CHECKPOINT ALPHA"],
        "object_detection": ["CAMERA 07", "SECTOR NORTH", "PERIMETER FEED"],
        "satellite_imagery": ["GRID REF 47.3°N 8.5°E", "SECTOR 7 OVERHEAD", "ALT: 480km"],
        "medical_scan": ["SCAN ID: MRI-20240213-07", "AXIAL T2 WEIGHTED", "CONTRAST ENHANCED"],
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        count = {"biometric_auth": 1, "crowd_surveillance": 4}.get(self.strategy, 2)
        self._faces = [self._rand_face() for _ in range(random.randint(1, count + 2))]
        self._scene_label = random.choice(self.SCENE_LABELS[self.strategy])
        self._scan_line = 0.0

    def _get_state(self):
        return {
            "faces": self._faces,
            "scene_label": self._scene_label,
            "scan_line": round(self._scan_line, 3),
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        # Drift existing boxes slightly
        for f in self._faces:
            f["x"] = round(max(0.01, min(0.85, f["x"] + random.uniform(-0.015, 0.015))), 3)
            f["y"] = round(max(0.01, min(0.85, f["y"] + random.uniform(-0.015, 0.015))), 3)
            f["confidence"] = round(max(0.3, min(0.99, f["confidence"] + random.uniform(-0.05, 0.05))), 2)
        # Occasionally add/remove a detection
        if len(self._faces) < 6 and random.random() > 0.7:
            self._faces.append(self._rand_face())
        if len(self._faces) > 1 and random.random() > 0.8:
            self._faces.pop(random.randrange(len(self._faces)))
        # Advance scan line
        self._scan_line = (self._scan_line + random.uniform(0.05, 0.15)) % 1.0
        return self._get_state()
