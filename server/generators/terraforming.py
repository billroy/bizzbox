"""Terraforming console — planetary atmosphere processor with long-term environmental data."""
import random
from .base import BaseActivity


class TerraformingActivity(BaseActivity):
    activity_type = "terraforming"
    strategies = [
        "mars_colony",
        "venus_aerostat",
        "titan_outpost",
        "exoplanet_seed",
        "lunar_dome",
    ]
    titles = [
        "TERRAFORM", "ATMO PROCESSOR", "PLANETARY OPS",
        "ENVIRONMENT", "ATMO CONTROL", "TERRA SYSTEMS",
    ]

    _GAS_PROFILES = {
        "mars_colony": [
            ("O2", 0.1, 21.0), ("CO2", 95.0, 40.0), ("N2", 2.7, 78.0),
            ("Ar", 1.6, 0.9), ("H2O", 0.03, 1.0),
        ],
        "venus_aerostat": [
            ("O2", 0.0, 21.0), ("CO2", 96.5, 30.0), ("N2", 3.5, 65.0),
            ("SO2", 0.015, 0.0), ("H2O", 0.002, 2.0),
        ],
        "titan_outpost": [
            ("N2", 95.0, 78.0), ("CH4", 5.0, 0.0), ("O2", 0.0, 21.0),
            ("H2", 0.1, 0.0), ("C2H6", 0.001, 0.0),
        ],
        "exoplanet_seed": [
            ("O2", 2.0, 21.0), ("CO2", 60.0, 0.04), ("N2", 30.0, 78.0),
            ("H2O", 5.0, 1.0), ("CH4", 3.0, 0.0),
        ],
        "lunar_dome": [
            ("O2", 20.0, 21.0), ("N2", 78.0, 78.0), ("CO2", 0.5, 0.04),
            ("Ar", 0.9, 0.9), ("H2O", 0.4, 1.0),
        ],
    }

    _ZONE_NAMES = ["ALPHA", "BETA", "GAMMA", "DELTA", "EPSILON", "ZETA"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._gases = self._init_gases()
        self._surface_temp = round(random.uniform(-60.0, 120.0), 1)
        self._target_temp = round(random.uniform(15.0, 25.0), 1)
        self._ice_cap_pct = round(random.uniform(10.0, 90.0), 1)
        self._seismic_level = round(random.uniform(0.0, 3.0), 2)
        self._mirror_alignment = round(random.uniform(85.0, 100.0), 1)
        self._progress_pct = round(random.uniform(1.0, 65.0), 2)
        self._zones = self._build_zones()

    def _init_gases(self):
        profile = self._GAS_PROFILES[self.strategy]
        gases = []
        for name, start, target in profile:
            current = start + (target - start) * random.uniform(0.05, 0.5)
            gases.append({
                "name": name,
                "current_pct": round(current, 3),
                "target_pct": round(target, 3),
            })
        return gases

    def _build_zones(self):
        count = random.randint(4, 6)
        zones = []
        for i in range(count):
            zones.append({
                "name": self._ZONE_NAMES[i],
                "temp": round(self._surface_temp + random.uniform(-20, 20), 1),
                "status": "processing",
            })
        return zones

    def _get_state(self):
        return {
            "gases": [dict(g) for g in self._gases],
            "surface_temp": self._surface_temp,
            "target_temp": self._target_temp,
            "ice_cap_pct": self._ice_cap_pct,
            "seismic_level": self._seismic_level,
            "mirror_alignment": self._mirror_alignment,
            "progress_pct": self._progress_pct,
            "zones": [dict(z) for z in self._zones],
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        # Very slow progress advance
        self._progress_pct = round(min(100.0, self._progress_pct + random.uniform(0.001, 0.01)), 4)

        # Drift gas composition toward targets
        for gas in self._gases:
            diff = gas["target_pct"] - gas["current_pct"]
            step = diff * 0.001 + random.uniform(-0.005, 0.005)
            gas["current_pct"] = round(max(0.0, gas["current_pct"] + step), 3)

        # Surface temp drift toward target
        diff = self._target_temp - self._surface_temp
        self._surface_temp = round(self._surface_temp + diff * 0.002 + random.uniform(-0.5, 0.5), 1)

        # Ice cap melt
        if self._surface_temp > 0:
            self._ice_cap_pct = round(max(0.0, self._ice_cap_pct - random.uniform(0.0, 0.05)), 1)
        else:
            self._ice_cap_pct = round(min(100.0, self._ice_cap_pct + random.uniform(0.0, 0.02)), 1)

        # Seismic drift
        self._seismic_level = round(max(0.0, min(8.0, self._seismic_level + random.uniform(-0.2, 0.2))), 2)

        # Mirror alignment
        self._mirror_alignment = round(max(70.0, min(100.0, self._mirror_alignment + random.uniform(-0.5, 0.5))), 1)

        # Zone temperature drift
        for zone in self._zones:
            zone["temp"] = round(zone["temp"] + random.uniform(-0.8, 0.8), 1)
            if random.random() < 0.02:
                zone["status"] = random.choice(["processing", "stable", "warning", "offline"])
            elif zone["status"] not in ("processing", "stable") and random.random() < 0.1:
                zone["status"] = "processing"

        return self._get_state()
