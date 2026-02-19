"""ATC-style flight tracker with moving aircraft, trails, and data tags."""
import random
import math
from .base import BaseActivity


class FlightTrackerActivity(BaseActivity):
    activity_type = "flight_tracker"
    strategies = [
        "major_airport", "military_airspace", "oceanic_tracking",
        "approach_control", "emergency_divert",
    ]
    titles = [
        "ATC RADAR", "FLIGHT TRACKER", "AIR TRAFFIC",
        "APPROACH CONTROL", "AIRSPACE MONITOR", "SECTOR SCAN",
        "RADAR CONTACT",
    ]

    CALLSIGN_PREFIXES = {
        "major_airport": ["UAL", "DAL", "AAL", "SWA", "JBU", "NKS", "SKW", "ASA"],
        "military_airspace": [
            "VIPER-", "EAGLE-", "SHADOW-", "RAPTOR-", "GHOST-",
            "COBRA-", "FALCON-", "HAWK-", "STORM-", "BLADE-",
        ],
        "oceanic_tracking": ["BAW", "AFR", "QFA", "DLH", "SIA", "CPA", "UAE", "JAL"],
        "approach_control": ["UAL", "DAL", "AAL", "SWA", "JBU", "FFT", "RPA", "ENY"],
        "emergency_divert": ["UAL", "DAL", "AAL", "SWA", "N", "MEDEVAC-", "GUARD-"],
    }

    CENTER_LABELS = {
        "major_airport":     ["KJFK APP", "KLAX APP", "KORD APP", "KATL APP", "KDFW APP"],
        "military_airspace": ["NORAD SEC-4", "NELLIS MOA", "EDWARDS CTR", "AREA 51 RDR"],
        "oceanic_tracking":  ["SHANWICK OCA", "GANDER OCA", "NZZO OCA", "SANTA MARIA OCA"],
        "approach_control":  ["SOCAL APP", "NORCAL APP", "NY TRACON", "POTOMAC APP"],
        "emergency_divert":  ["EMERG CTRL", "GUARD FREQ", "SAR COORD", "MAYDAY CTRL"],
    }

    RANGE_NM = {
        "major_airport":     (60, 120),
        "military_airspace": (100, 250),
        "oceanic_tracking":  (150, 250),
        "approach_control":  (40, 80),
        "emergency_divert":  (80, 160),
    }

    AIRCRAFT_TYPES = {
        "major_airport":     ["commercial", "commercial", "commercial", "cargo", "private"],
        "military_airspace": ["military", "military", "military", "private"],
        "oceanic_tracking":  ["commercial", "commercial", "cargo", "cargo"],
        "approach_control":  ["commercial", "commercial", "private", "cargo"],
        "emergency_divert":  ["commercial", "commercial", "military", "private", "cargo"],
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._center_label = random.choice(self.CENTER_LABELS[self.strategy])
        rng = self.RANGE_NM[self.strategy]
        self._range_nm = random.randint(rng[0], rng[1])
        self._aircraft = []
        # Seed initial aircraft
        count = random.randint(5, 12)
        for _ in range(count):
            self._aircraft.append(self._spawn_aircraft(edge=False))

    def _make_callsign(self):
        prefixes = self.CALLSIGN_PREFIXES[self.strategy]
        prefix = random.choice(prefixes)
        if self.strategy == "military_airspace":
            return f"{prefix}{random.randint(1, 9):02d}"
        else:
            return f"{prefix}{random.randint(100, 9999)}"

    def _spawn_aircraft(self, edge=True):
        if edge:
            # Spawn on a random edge
            side = random.randint(0, 3)
            if side == 0:    # top
                x, y = random.uniform(0.05, 0.95), 0.0
                heading = random.uniform(150, 210)
            elif side == 1:  # right
                x, y = 1.0, random.uniform(0.05, 0.95)
                heading = random.uniform(200, 340)
            elif side == 2:  # bottom
                x, y = random.uniform(0.05, 0.95), 1.0
                heading = random.uniform(330, 390) % 360
            else:            # left
                x, y = 0.0, random.uniform(0.05, 0.95)
                heading = random.uniform(20, 160)
        else:
            x = random.uniform(0.1, 0.9)
            y = random.uniform(0.1, 0.9)
            heading = random.uniform(0, 360)

        ac_type = random.choice(self.AIRCRAFT_TYPES[self.strategy])

        # Altitude depends on type
        if ac_type == "commercial":
            altitude = random.randint(250, 410) * 100
        elif ac_type == "military":
            altitude = random.randint(150, 500) * 100
        elif ac_type == "cargo":
            altitude = random.randint(300, 400) * 100
        else:  # private
            altitude = random.randint(80, 180) * 100

        # Speed depends on type
        if ac_type == "commercial":
            speed = random.randint(420, 520)
        elif ac_type == "military":
            speed = random.randint(350, 650)
        elif ac_type == "cargo":
            speed = random.randint(400, 480)
        else:
            speed = random.randint(150, 280)

        # Emergency status
        is_emergency = False
        if self.strategy == "emergency_divert":
            is_emergency = random.random() < 0.25
        else:
            is_emergency = random.random() < 0.05

        return {
            "callsign": self._make_callsign(),
            "x": round(x, 4),
            "y": round(y, 4),
            "altitude": altitude,
            "heading": round(heading % 360, 1),
            "speed": speed,
            "type": ac_type,
            "status": "emergency" if is_emergency else "normal",
            "trail": [],
        }

    def _move_aircraft(self):
        speed_factor = 0.006
        for ac in self._aircraft:
            # Append current position to trail
            ac["trail"].append([round(ac["x"], 4), round(ac["y"], 4)])
            if len(ac["trail"]) > 8:
                ac["trail"] = ac["trail"][-8:]

            # Move along heading
            heading_rad = math.radians(ac["heading"])
            factor = speed_factor * (ac["speed"] / 450)
            ac["x"] += math.sin(heading_rad) * factor
            ac["y"] -= math.cos(heading_rad) * factor
            ac["x"] = round(ac["x"], 4)
            ac["y"] = round(ac["y"], 4)

            # Random heading change (20% chance)
            if random.random() < 0.20:
                ac["heading"] = round((ac["heading"] + random.uniform(-5, 5)) % 360, 1)

            # Slight altitude variation
            if random.random() < 0.1:
                ac["altitude"] += random.choice([-100, 0, 0, 100])
                ac["altitude"] = max(1000, min(50000, ac["altitude"]))

    def _cull_and_spawn(self):
        # Remove aircraft that left bounds
        self._aircraft = [
            ac for ac in self._aircraft
            if -0.1 <= ac["x"] <= 1.1 and -0.1 <= ac["y"] <= 1.1
        ]

        # Maintain 5-12 aircraft
        while len(self._aircraft) < 5:
            self._aircraft.append(self._spawn_aircraft(edge=True))

        if len(self._aircraft) < 12 and random.random() < 0.15:
            self._aircraft.append(self._spawn_aircraft(edge=True))

        # Cap at 12
        if len(self._aircraft) > 12:
            self._aircraft = self._aircraft[:12]

    def _serialize_aircraft(self):
        return [
            {
                "callsign": ac["callsign"],
                "x": ac["x"],
                "y": ac["y"],
                "altitude": ac["altitude"],
                "heading": ac["heading"],
                "speed": ac["speed"],
                "type": ac["type"],
                "status": ac["status"],
                "trail": ac["trail"],
            }
            for ac in self._aircraft
        ]

    def _get_state(self):
        return {
            "aircraft": self._serialize_aircraft(),
            "range_nm": self._range_nm,
            "center_label": self._center_label,
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        self._move_aircraft()
        self._cull_and_spawn()
        return self._get_state()
