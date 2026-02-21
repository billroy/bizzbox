"""Space elevator — orbital tether operations with climber tracking and cable telemetry."""
import random
from .base import BaseActivity


class SpaceElevatorActivity(BaseActivity):
    activity_type = "space_elevator"
    strategies = [
        "earth_equatorial",
        "lunar_tether",
        "mars_elevator",
        "orbital_station",
        "asteroid_mine",
    ]
    titles = [
        "SPACE ELEVATOR", "TETHER OPS", "ORBITAL LIFT",
        "CLIMBER STATUS", "ELEVATOR CTRL", "TETHER MONITOR",
    ]

    _CLIMBER_NAMES = [
        "ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO",
        "FOXTROT", "GOLF", "HOTEL",
    ]

    _CARGO_TYPES = [
        "CREW MODULE", "SUPPLY POD", "FUEL TANK", "SAT DEPLOY",
        "SCIENCE PKG", "MINING EQUIP", "HABITAT MOD", "COMM RELAY",
        "MED SUPPLIES", "WATER CARGO",
    ]

    # Anchor point count per strategy
    _ANCHOR_COUNTS = {
        "earth_equatorial": 4,
        "lunar_tether": 3,
        "mars_elevator": 3,
        "orbital_station": 5,
        "asteroid_mine": 2,
    }

    # Max altitude (km) per strategy
    _MAX_ALT = {
        "earth_equatorial": 35786,
        "lunar_tether": 5000,
        "mars_elevator": 17032,
        "orbital_station": 400,
        "asteroid_mine": 50,
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._max_alt = self._MAX_ALT[self.strategy]
        self._climbers = self._build_climbers()
        self._anchors = self._build_anchors()
        self._counterweight_pos = round(random.uniform(0.85, 0.98), 3)
        self._cable_tension = round(random.uniform(70.0, 95.0), 1)
        self._weather_status = "clear"
        self._wind_speed_kph = round(random.uniform(5.0, 40.0), 1)

    def _build_climbers(self):
        count = random.randint(2, 4)
        names = random.sample(self._CLIMBER_NAMES, count)
        climbers = []
        for name in names:
            alt_frac = random.uniform(0.0, 0.9)
            direction = random.choice(["ascending", "descending", "holding"])
            climbers.append({
                "name": f"CLM-{name}",
                "altitude_frac": round(alt_frac, 4),
                "velocity_kph": round(random.uniform(50.0, 200.0), 1) if direction != "holding" else 0.0,
                "direction": direction,
                "cargo": random.choice(self._CARGO_TYPES),
                "payload_kg": random.randint(500, 15000),
                "status": "nominal",
            })
        return climbers

    def _build_anchors(self):
        count = self._ANCHOR_COUNTS[self.strategy]
        anchors = []
        for i in range(count):
            anchors.append({
                "id": f"ANC-{i+1}",
                "tension_pct": round(random.uniform(80.0, 100.0), 1),
                "status": "secure",
            })
        return anchors

    def _get_state(self):
        return {
            "climbers": [dict(c) for c in self._climbers],
            "anchors": [dict(a) for a in self._anchors],
            "counterweight_pos": self._counterweight_pos,
            "cable_tension": self._cable_tension,
            "weather_status": self._weather_status,
            "wind_speed_kph": self._wind_speed_kph,
            "max_alt_km": self._max_alt,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        # Strip max_alt_km (static); climber names/cargo change rarely but are small
        return {
            "_delta": True,
            "climbers": new_state["climbers"],
            "anchors": new_state["anchors"],
            "counterweight_pos": new_state["counterweight_pos"],
            "cable_tension": new_state["cable_tension"],
            "weather_status": new_state["weather_status"],
            "wind_speed_kph": new_state["wind_speed_kph"],
        }

    def next_frame(self) -> dict:
        # Move climbers
        for climber in self._climbers:
            if climber["direction"] == "ascending":
                step = climber["velocity_kph"] * 0.00005 / max(1, self._max_alt / 35786)
                climber["altitude_frac"] = round(min(1.0, climber["altitude_frac"] + step), 4)
                if climber["altitude_frac"] >= 0.98:
                    climber["direction"] = "holding"
                    climber["velocity_kph"] = 0.0
            elif climber["direction"] == "descending":
                step = climber["velocity_kph"] * 0.00005 / max(1, self._max_alt / 35786)
                climber["altitude_frac"] = round(max(0.0, climber["altitude_frac"] - step), 4)
                if climber["altitude_frac"] <= 0.02:
                    climber["direction"] = "holding"
                    climber["velocity_kph"] = 0.0

            # Resume from holding occasionally
            if climber["direction"] == "holding" and random.random() < 0.01:
                climber["direction"] = random.choice(["ascending", "descending"])
                climber["velocity_kph"] = round(random.uniform(50.0, 200.0), 1)
                climber["cargo"] = random.choice(self._CARGO_TYPES)

            # Velocity drift
            if climber["velocity_kph"] > 0:
                climber["velocity_kph"] = round(
                    max(10.0, min(300.0, climber["velocity_kph"] + random.uniform(-5.0, 5.0))), 1)

            # Status
            if random.random() < 0.01:
                climber["status"] = random.choice(["nominal", "caution", "brake_test"])
            elif climber["status"] != "nominal" and random.random() < 0.1:
                climber["status"] = "nominal"

        # Anchor tension drift
        for anchor in self._anchors:
            anchor["tension_pct"] = round(
                max(60.0, min(100.0, anchor["tension_pct"] + random.uniform(-1.0, 1.0))), 1)
            if anchor["tension_pct"] < 75.0:
                anchor["status"] = "warning"
            elif anchor["tension_pct"] < 85.0:
                anchor["status"] = "stressed"
            else:
                anchor["status"] = "secure"

        # Cable tension
        self._cable_tension = round(
            max(50.0, min(100.0, self._cable_tension + random.uniform(-1.5, 1.5))), 1)

        # Counterweight
        self._counterweight_pos = round(
            max(0.80, min(1.0, self._counterweight_pos + random.uniform(-0.002, 0.002))), 3)

        # Weather
        self._wind_speed_kph = round(max(0.0, min(120.0, self._wind_speed_kph + random.uniform(-3.0, 3.0))), 1)
        if self._wind_speed_kph > 80:
            self._weather_status = "severe"
        elif self._wind_speed_kph > 50:
            self._weather_status = "advisory"
        else:
            self._weather_status = "clear"

        return self._get_state()
