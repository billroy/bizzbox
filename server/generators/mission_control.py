"""Mission control — rocket launch countdown console with GO/NO-GO polling and telemetry."""
import random
from .base import BaseActivity


class MissionControlActivity(BaseActivity):
    activity_type = "mission_control"
    strategies = [
        "orbital_launch",
        "lunar_mission",
        "mars_transfer",
        "satellite_deploy",
        "crew_rescue",
    ]
    titles = [
        "MISSION CTRL", "LAUNCH OPS", "FLIGHT CONTROL",
        "CONTROL ROOM", "LAUNCH STATUS", "MISSION OPS",
    ]

    _VEHICLE_NAMES = {
        "orbital_launch":   ["ATLAS-V", "FALCON-9", "VULCAN", "ELECTRON", "ARIANE-6"],
        "lunar_mission":    ["ARTEMIS-IV", "STARSHIP-L", "GATEWAY-X", "ORION-VII"],
        "mars_transfer":    ["ARES-I", "MARS EXPRESS", "HORIZON-1", "RED ARROW"],
        "satellite_deploy": ["SAT-LIFT-3", "PEGASUS-XL", "MINOTAUR", "VEGA-C"],
        "crew_rescue":      ["DRAGON-R", "SOYUZ-MS", "CREW-STARLINER", "LIFEBOAT-1"],
    }

    # Stations for GO/NO-GO poll
    _STATIONS = [
        "BOOSTER", "RETRO", "FIDO", "GUIDANCE", "SURGEON",
        "EECOM", "GNC", "TELMU", "CONTROL", "NETWORK",
        "RECOVERY", "FAO", "PAO", "RANGE",
    ]

    _ABORT_MODES = ["RTLS", "TAL", "ATO", "AOA", "NOMINAL"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._vehicle = random.choice(self._VEHICLE_NAMES[self.strategy])
        self._t_minus = random.randint(30, 600)  # countdown seconds
        self._counting = True
        self._hold = False
        self._stations = self._build_stations()
        self._telemetry = self._init_telemetry()
        self._stage = 0
        self._max_stages = random.randint(2, 3)
        self._altitude_km = 0.0
        self._velocity_ms = 0.0
        self._downrange_km = 0.0
        self._abort_mode = "NOMINAL"
        self._propellant_pct = 100.0
        self._events_log = self._init_log()

    def _build_stations(self):
        stations = []
        for name in self._STATIONS:
            stations.append({
                "name": name,
                "status": "GO",
            })
        return stations

    def _init_telemetry(self):
        return {
            "altitude_km": 0.0,
            "velocity_ms": 0.0,
            "downrange_km": 0.0,
            "acceleration_g": 0.0,
            "dynamic_pressure_kpa": 0.0,
            "propellant_pct": 100.0,
            "stage": 0,
        }

    def _init_log(self):
        return [
            "MISSION CONTROL ONLINE",
            f"VEHICLE: {self._vehicle}",
            "SYSTEMS CHECK IN PROGRESS",
        ]

    def _get_state(self):
        return {
            "vehicle": self._vehicle,
            "t_minus": self._t_minus,
            "counting": self._counting,
            "hold": self._hold,
            "stations": [dict(s) for s in self._stations],
            "telemetry": dict(self._telemetry),
            "abort_mode": self._abort_mode,
            "events_log": list(self._events_log[-10:]),
            "max_stages": self._max_stages,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        # Station GO/NO-GO drift
        for station in self._stations:
            if random.random() < 0.008:
                station["status"] = random.choice(["GO", "GO", "GO", "STANDBY", "NO-GO"])
            elif station["status"] != "GO" and random.random() < 0.05:
                station["status"] = "GO"

        # Check for any NO-GO
        any_nogo = any(s["status"] == "NO-GO" for s in self._stations)

        if self._counting and not self._hold:
            if any_nogo and self._t_minus > 0:
                self._hold = True
                self._events_log.append("** HOLD HOLD HOLD **")
            elif self._t_minus > 0:
                self._t_minus -= 1
                # Countdown milestones
                if self._t_minus == 120:
                    self._events_log.append("T-2:00 — TERMINAL COUNT")
                elif self._t_minus == 30:
                    self._events_log.append("T-0:30 — AUTO SEQUENCE START")
                elif self._t_minus == 10:
                    self._events_log.append("T-0:10 — GO FOR LAUNCH")
                elif self._t_minus == 3:
                    self._events_log.append("IGNITION SEQUENCE START")
                elif self._t_minus == 0:
                    self._events_log.append("** LIFTOFF! **")
                    self._counting = False
            else:
                self._counting = False

        # Resume from hold
        if self._hold and not any_nogo and random.random() < 0.05:
            self._hold = False
            self._events_log.append("HOLD RELEASED — RESUMING COUNT")

        # Post-launch telemetry
        if not self._counting and self._t_minus <= 0:
            # Accelerating
            accel = 1.2 + 0.3 * self._telemetry["stage"] + random.uniform(-0.1, 0.1)
            self._telemetry["acceleration_g"] = round(accel, 2)
            self._telemetry["velocity_ms"] = round(
                self._telemetry["velocity_ms"] + accel * 9.8 * 0.5, 1)
            self._telemetry["altitude_km"] = round(
                self._telemetry["altitude_km"] + self._telemetry["velocity_ms"] * 0.001, 2)
            self._telemetry["downrange_km"] = round(
                self._telemetry["downrange_km"] + self._telemetry["velocity_ms"] * 0.0008, 2)

            # Dynamic pressure (rises then falls)
            if self._telemetry["altitude_km"] < 15:
                self._telemetry["dynamic_pressure_kpa"] = round(
                    min(35.0, self._telemetry["dynamic_pressure_kpa"] + random.uniform(0.5, 2.0)), 1)
            else:
                self._telemetry["dynamic_pressure_kpa"] = round(
                    max(0.0, self._telemetry["dynamic_pressure_kpa"] - random.uniform(0.3, 1.5)), 1)

            # Propellant burn
            self._telemetry["propellant_pct"] = round(
                max(0.0, self._telemetry["propellant_pct"] - random.uniform(0.3, 0.8)), 1)

            # Stage separation
            if self._telemetry["propellant_pct"] <= 5.0 and self._telemetry["stage"] < self._max_stages:
                self._telemetry["stage"] += 1
                self._telemetry["propellant_pct"] = 100.0
                self._events_log.append(f"STAGE {self._telemetry['stage']} SEPARATION — CONFIRMED")

            # Abort mode updates
            if self._telemetry["altitude_km"] < 50:
                self._abort_mode = "RTLS"
            elif self._telemetry["altitude_km"] < 150:
                self._abort_mode = "TAL"
            elif self._telemetry["velocity_ms"] < 7000:
                self._abort_mode = "ATO"
            else:
                self._abort_mode = "NOMINAL"

            # Milestone events
            if 14.5 < self._telemetry["altitude_km"] < 15.5:
                if "MAX-Q" not in str(self._events_log[-3:]):
                    self._events_log.append("MAX-Q — THROTTLE UP")

        # Reset when mission complete (altitude very high)
        if self._telemetry["altitude_km"] > 400:
            self._events_log.append("ORBIT INSERTION CONFIRMED")
            self._events_log.append("--- RESETTING SIMULATION ---")
            self._t_minus = random.randint(30, 600)
            self._counting = True
            self._hold = False
            self._telemetry = self._init_telemetry()
            self._abort_mode = "NOMINAL"
            self._vehicle = random.choice(self._VEHICLE_NAMES[self.strategy])
            self._stations = self._build_stations()

        if len(self._events_log) > 15:
            self._events_log = self._events_log[-15:]

        return self._get_state()
