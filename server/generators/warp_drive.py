"""Warp drive / FTL engine core monitoring with plasma containment and antimatter injection."""
import random
import math
from .base import BaseActivity


class WarpDriveActivity(BaseActivity):
    activity_type = "warp_drive"
    strategies = [
        "federation_starship",
        "freighter_hauler",
        "warship_battlecruiser",
        "exploration_vessel",
        "colony_transport",
    ]
    titles = [
        "WARP CORE", "FTL DRIVE", "PROPULSION", "DRIVE CORE",
        "WARP SYSTEMS", "ENGINE ROOM", "MAIN DRIVE",
    ]

    _READING_TEMPLATES = {
        "federation_starship": [
            ("plasma_temp_mk", 1200.0, 3200.0),
            ("containment_pct", 85.0, 100.0),
            ("antimatter_flow", 10.0, 95.0),
            ("dilithium_stress", 5.0, 78.0),
            ("warp_factor", 1.0, 9.9),
            ("core_freq_thz", 21.0, 47.0),
        ],
        "freighter_hauler": [
            ("plasma_temp_mk", 800.0, 1800.0),
            ("containment_pct", 75.0, 98.0),
            ("antimatter_flow", 5.0, 60.0),
            ("dilithium_stress", 10.0, 55.0),
            ("warp_factor", 1.0, 5.5),
            ("fuel_reserve_pct", 15.0, 95.0),
        ],
        "warship_battlecruiser": [
            ("plasma_temp_mk", 1500.0, 4000.0),
            ("containment_pct", 80.0, 100.0),
            ("antimatter_flow", 20.0, 100.0),
            ("dilithium_stress", 15.0, 90.0),
            ("warp_factor", 1.0, 9.99),
            ("weapons_draw_gw", 0.5, 12.0),
        ],
        "exploration_vessel": [
            ("plasma_temp_mk", 900.0, 2500.0),
            ("containment_pct", 90.0, 100.0),
            ("antimatter_flow", 8.0, 70.0),
            ("dilithium_stress", 3.0, 50.0),
            ("warp_factor", 1.0, 8.0),
            ("sensor_power_gw", 0.2, 5.0),
        ],
        "colony_transport": [
            ("plasma_temp_mk", 600.0, 1500.0),
            ("containment_pct", 88.0, 100.0),
            ("antimatter_flow", 5.0, 45.0),
            ("dilithium_stress", 5.0, 40.0),
            ("warp_factor", 1.0, 4.0),
            ("life_support_pct", 85.0, 100.0),
        ],
    }

    # Concentric ring definitions: (base_radius_frac, pulse_speed, label)
    _RINGS = [
        (0.15, 1.0, "INNER COIL"),
        (0.28, 0.7, "PLASMA RING"),
        (0.40, 0.5, "CONTAINMENT"),
        (0.52, 0.3, "OUTER FIELD"),
        (0.64, 0.2, "WARP BUBBLE"),
    ]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._phase = random.uniform(0.0, math.tau)
        self._readings = self._init_readings()
        self._ring_states = self._init_rings()
        self._alert = None
        self._alert_frames = 0

    def _init_readings(self):
        readings = {}
        for key, lo, hi in self._READING_TEMPLATES[self.strategy]:
            readings[key] = round(random.uniform(lo, hi), 2)
        return readings

    def _init_rings(self):
        rings = []
        for base_r, speed, label in self._RINGS:
            rings.append({
                "radius_frac": base_r,
                "pulse_speed": speed,
                "label": label,
                "status": "nominal",
                "intensity": round(random.uniform(0.5, 1.0), 2),
            })
        return rings

    def _drift_readings(self):
        for key, lo, hi in self._READING_TEMPLATES[self.strategy]:
            span = hi - lo
            step = span * 0.015 * random.uniform(-1.0, 1.0)
            val = self._readings[key] + step
            val = max(lo, min(hi, val))
            self._readings[key] = round(val, 2)

    def _get_state(self):
        return {
            "readings": dict(self._readings),
            "rings": [dict(r) for r in self._ring_states],
            "phase": round(self._phase, 4),
            "alert": self._alert,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        self._phase += 0.06 + 0.02 * (self.intensity / 10.0)
        if self._phase > math.tau * 100:
            self._phase -= math.tau * 100

        self._drift_readings()

        # Drift ring intensities
        for ring in self._ring_states:
            ring["intensity"] = round(
                max(0.2, min(1.0, ring["intensity"] + random.uniform(-0.05, 0.05))), 2
            )

        # Containment warning logic
        containment_key = "containment_pct"
        if containment_key in self._readings:
            cval = self._readings[containment_key]
            if cval < 88.0:
                self._alert = "CONTAINMENT WARNING"
                # Push a random ring to unstable
                ring = random.choice(self._ring_states)
                ring["status"] = "unstable"
            elif cval < 92.0:
                self._alert = "CONTAINMENT ADVISORY"
            else:
                self._alert = None
                for ring in self._ring_states:
                    if ring["status"] == "unstable" and random.random() < 0.3:
                        ring["status"] = "nominal"

        # Occasional ring flicker
        if random.random() < 0.03 * (self.intensity / 10.0):
            ring = random.choice(self._ring_states)
            ring["status"] = "flicker" if ring["status"] == "nominal" else "nominal"

        return self._get_state()
