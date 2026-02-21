"""Wildfire command — incident command post for active wildfire management."""
import random
from .base import BaseActivity


class WildfireCommandActivity(BaseActivity):
    activity_type = "wildfire_command"
    strategies = [
        "forest_fire",
        "grassland_fire",
        "urban_interface",
        "mountain_fire",
        "prescribed_burn",
    ]
    titles = [
        "FIRE COMMAND", "WILDFIRE OPS", "INCIDENT CMD",
        "FIRE CONTROL", "SUPPRESSION", "FIRE STATUS",
    ]

    _FIRE_NAMES = {
        "forest_fire":     ["PINE RIDGE", "CEDAR CREEK", "OAK HOLLOW", "TIMBER PEAK"],
        "grassland_fire":  ["PRAIRIE WIND", "SAGE FLATS", "BUFFALO RUN", "DUSTY BASIN"],
        "urban_interface": ["SUMMIT ESTATES", "HILLCREST", "CANYON VIEW", "RIDGE LINE"],
        "mountain_fire":   ["EAGLE PEAK", "SNOWCAP", "GRANITE PASS", "BEAR GULCH"],
        "prescribed_burn": ["SECTOR ALPHA", "CONTROL ZONE", "UNIT BRAVO", "PLOT DELTA"],
    }

    _CREW_TYPES = ["ENGINE", "HOTSHOT", "HELITACK", "DOZER", "HAND CREW", "STRUCTURE"]

    _ZONE_STATUSES = ["active", "contained", "threatened", "cleared", "spotting"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._fire_name = random.choice(self._FIRE_NAMES[self.strategy])
        self._zones = self._build_zones()
        self._crews = self._build_crews()
        self._air_tankers = self._build_tankers()
        self._wind_speed_mph = round(random.uniform(5.0, 30.0), 1)
        self._wind_dir_deg = random.randint(0, 359)
        self._humidity_pct = round(random.uniform(8.0, 45.0), 1)
        self._fuel_moisture_pct = round(random.uniform(3.0, 25.0), 1)
        self._containment_pct = round(random.uniform(5.0, 40.0), 1)
        self._acres_burned = random.randint(50, 5000)
        self._evac_zones = self._build_evac_zones()

    def _build_zones(self):
        count = random.randint(4, 6)
        zones = []
        for i in range(count):
            zones.append({
                "id": f"Z-{i+1}",
                "status": random.choice(self._ZONE_STATUSES),
                "spread_rate_ch_hr": round(random.uniform(0.0, 15.0), 1),
                "flame_length_ft": round(random.uniform(2.0, 50.0), 1),
            })
        return zones

    def _build_crews(self):
        count = random.randint(5, 8)
        crews = []
        for i in range(count):
            ctype = random.choice(self._CREW_TYPES)
            crews.append({
                "id": f"{ctype}-{i+1:02d}",
                "type": ctype,
                "zone": f"Z-{random.randint(1, 5)}",
                "status": random.choice(["deployed", "staging", "resting", "en_route"]),
                "personnel": random.randint(4, 20),
            })
        return crews

    def _build_tankers(self):
        count = random.randint(1, 3)
        tankers = []
        for i in range(count):
            tankers.append({
                "id": f"TANKER-{i+1:02d}",
                "status": random.choice(["en_route", "on_station", "dropping", "rtb"]),
                "eta_min": random.randint(0, 25),
                "payload_gal": random.randint(800, 4000),
            })
        return tankers

    def _build_evac_zones(self):
        count = random.randint(2, 4)
        names = ["SECTOR A", "SECTOR B", "SECTOR C", "SECTOR D", "SECTOR E"]
        evac = []
        for i in range(count):
            evac.append({
                "name": names[i],
                "status": random.choice(["warning", "mandatory", "cleared", "all_clear"]),
                "population": random.randint(50, 2000),
            })
        return evac

    def _get_state(self):
        return {
            "fire_name": self._fire_name,
            "zones": [dict(z) for z in self._zones],
            "crews": [dict(c) for c in self._crews],
            "air_tankers": [dict(t) for t in self._air_tankers],
            "wind_speed_mph": self._wind_speed_mph,
            "wind_dir_deg": self._wind_dir_deg,
            "humidity_pct": self._humidity_pct,
            "fuel_moisture_pct": self._fuel_moisture_pct,
            "containment_pct": self._containment_pct,
            "acres_burned": self._acres_burned,
            "evac_zones": [dict(e) for e in self._evac_zones],
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        # fire_name is static
        return {
            "_delta": True,
            "zones": new_state["zones"],
            "crews": new_state["crews"],
            "air_tankers": new_state["air_tankers"],
            "wind_speed_mph": new_state["wind_speed_mph"],
            "wind_dir_deg": new_state["wind_dir_deg"],
            "humidity_pct": new_state["humidity_pct"],
            "fuel_moisture_pct": new_state["fuel_moisture_pct"],
            "containment_pct": new_state["containment_pct"],
            "acres_burned": new_state["acres_burned"],
            "evac_zones": new_state["evac_zones"],
        }

    def next_frame(self) -> dict:
        # Wind drift
        self._wind_speed_mph = round(max(0.0, min(60.0, self._wind_speed_mph + random.uniform(-1.5, 1.5))), 1)
        self._wind_dir_deg = (self._wind_dir_deg + random.randint(-5, 5)) % 360

        # Humidity and fuel moisture
        self._humidity_pct = round(max(3.0, min(80.0, self._humidity_pct + random.uniform(-1.0, 1.0))), 1)
        self._fuel_moisture_pct = round(max(1.0, min(40.0, self._fuel_moisture_pct + random.uniform(-0.5, 0.5))), 1)

        # Containment progress
        containment_delta = random.uniform(-0.5, 1.5) * (1.0 if self._wind_speed_mph < 25 else -0.5)
        self._containment_pct = round(max(0.0, min(100.0, self._containment_pct + containment_delta * 0.1)), 1)

        # Acres burned growth
        if self._containment_pct < 100:
            growth = random.uniform(0.5, 5.0) * (self._wind_speed_mph / 20.0)
            self._acres_burned = int(self._acres_burned + growth)

        # Zone status drift
        for zone in self._zones:
            zone["spread_rate_ch_hr"] = round(max(0.0, min(25.0, zone["spread_rate_ch_hr"] + random.uniform(-1.0, 1.0))), 1)
            zone["flame_length_ft"] = round(max(0.0, min(80.0, zone["flame_length_ft"] + random.uniform(-2.0, 2.0))), 1)
            if random.random() < 0.03:
                zone["status"] = random.choice(self._ZONE_STATUSES)

        # Crew status drift
        for crew in self._crews:
            if random.random() < 0.04:
                crew["status"] = random.choice(["deployed", "staging", "resting", "en_route"])
            if random.random() < 0.02:
                crew["zone"] = f"Z-{random.randint(1, len(self._zones))}"

        # Air tanker status
        for tanker in self._air_tankers:
            if random.random() < 0.05:
                tanker["status"] = random.choice(["en_route", "on_station", "dropping", "rtb"])
            tanker["eta_min"] = max(0, tanker["eta_min"] + random.randint(-2, 1))

        # Evac zone status
        for ez in self._evac_zones:
            if random.random() < 0.02:
                ez["status"] = random.choice(["warning", "mandatory", "cleared", "all_clear"])

        return self._get_state()
