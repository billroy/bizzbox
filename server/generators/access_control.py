"""Physical access control generator — badge events, clearances, zone activity."""
import random
from datetime import datetime, timezone, timedelta
from .base import BaseActivity


class AccessControlActivity(BaseActivity):
    activity_type = "access_control"
    strategies = [
        "corporate_hq",
        "military_base",
        "research_lab",
        "data_center",
        "embassy_compound",
    ]
    titles = [
        "ACCESS CONTROL SYSTEM",
        "BADGE READER MONITOR",
        "PHYSICAL SECURITY OPS",
        "PERIMETER ACCESS LOG",
        "ENTRY/EXIT MONITOR",
        "SECURITY CHECKPOINT",
        "FACILITY ACCESS CONTROL",
    ]

    BUFFER_SIZE = 15

    # Per-strategy configuration
    STRATEGY_CFG = {
        "corporate_hq": {
            "zones": [
                "LOBBY", "FLOOR-2", "FLOOR-3", "FLOOR-7", "EXEC-SUITE",
                "SERVER-RM", "CAFETERIA", "PARKING-A", "PARKING-B", "ROOF",
            ],
            "clearances": ["EMPLOYEE", "CONTRACTOR", "VISITOR", "MANAGER", "EXECUTIVE"],
            "first_names": [
                "James", "Sarah", "Michael", "Emily", "David", "Jessica",
                "Robert", "Ashley", "William", "Amanda", "Christopher", "Megan",
                "Daniel", "Stephanie", "Matthew", "Rebecca", "Andrew", "Lauren",
                "Joshua", "Samantha", "Tyler", "Rachel", "Brandon", "Nicole",
            ],
            "last_names": [
                "Smith", "Johnson", "Williams", "Brown", "Jones", "Davis",
                "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas",
                "Jackson", "White", "Harris", "Martin", "Thompson", "Garcia",
                "Martinez", "Robinson", "Clark", "Rodriguez", "Lewis", "Lee",
            ],
        },
        "military_base": {
            "zones": [
                "MAIN-GATE", "BARRACKS-A", "ARMORY", "HQ-BUILDING",
                "MOTOR-POOL", "INTEL-SCIF", "COMMS-CENTER", "MED-BAY",
                "FLIGHT-LINE", "SECURE-VAULT",
            ],
            "clearances": ["E-1", "E-4", "E-6", "O-3", "O-5", "TS", "TS/SCI", "SCI-TK"],
            "first_names": [
                "John", "Mark", "Kevin", "Brian", "Steven", "Timothy",
                "Patrick", "Gregory", "Nathan", "Zachary", "Scott", "Eric",
                "Alan", "Derek", "Jason", "Ryan", "Craig", "Kyle",
            ],
            "last_names": [
                "Rodriguez", "Murphy", "O'Brien", "Johnson", "Williams",
                "Davis", "Thompson", "Anderson", "Wilson", "Taylor",
                "Harris", "Martinez", "Jackson", "White", "Clark",
                "Walker", "Hall", "Allen", "Young", "Wright",
            ],
        },
        "research_lab": {
            "zones": [
                "RECEPTION", "BSL-2-LAB", "BSL-3-LAB", "CLEAN-ROOM",
                "CHEM-STORAGE", "SERVER-CLUSTER", "ARCHIVE", "CONFERENCE",
                "LOADING-DOCK", "RADIOLOGICAL",
            ],
            "clearances": ["VISITOR", "RESEARCHER", "SR-RESEARCHER", "PI", "DIR", "CLASSIFIED"],
            "first_names": [
                "Elena", "Marcus", "Priya", "Chen", "Yuki", "Aisha",
                "Dmitri", "Fatima", "Raj", "Mei", "Olga", "Hassan",
                "Ana", "Lars", "Kenji", "Ingrid", "Carlos", "Nadia",
            ],
            "last_names": [
                "Petrov", "Okonkwo", "Nakamura", "Patel", "Lindqvist",
                "Al-Hassan", "Zhang", "Ferreira", "Kovacs", "Reyes",
                "Mueller", "Singh", "Tanaka", "Osei", "Kim",
                "Fischer", "Andersen", "Hernandez", "Yamamoto", "Nkrumah",
            ],
        },
        "data_center": {
            "zones": [
                "SECURITY-DESK", "CAGE-A1", "CAGE-B3", "CAGE-C7",
                "MEET-ME-ROOM", "NOC", "POWER-ROOM", "COOLING-PLANT",
                "LOADING-AREA", "CROSS-CONNECT",
            ],
            "clearances": ["VENDOR", "COLOCATION", "OPERATOR", "ADMIN", "SUPERADMIN"],
            "first_names": [
                "Alex", "Jordan", "Morgan", "Taylor", "Casey", "Riley",
                "Quinn", "Avery", "Blake", "Cameron", "Drew", "Finley",
                "Harper", "Hayden", "Jamie", "Jesse", "Logan", "Parker",
            ],
            "last_names": [
                "Chen", "Park", "Singh", "Kim", "Gupta", "Nguyen",
                "Patel", "Ahmed", "Liu", "Wang", "Sharma", "Ali",
                "Hassan", "Kumar", "Zhang", "Ito", "Yoon", "Tanaka",
            ],
        },
        "embassy_compound": {
            "zones": [
                "OUTER-GATE", "VEHICLE-LOCK", "CONSULAR-HALL", "CHANCERY",
                "COMM-VAULT", "AMBASSADOR-WING", "RESIDENTIAL", "ROOF-POST",
                "BASEMENT-INTEL", "EMERGENCY-EXIT",
            ],
            "clearances": [
                "DIPLOMATIC", "STAFF", "LOCAL-HIRE", "ATTACHE",
                "CONSUL", "TS/SCI", "SCI-TK/HCS",
            ],
            "first_names": [
                "William", "Catherine", "Elizabeth", "Charles", "Alexandra",
                "Nicholas", "Sophia", "James", "Victoria", "Edward",
                "Charlotte", "George", "Eleanor", "Henry", "Margaret",
            ],
            "last_names": [
                "Harrison", "Whitfield", "Ashworth", "Pemberton", "Sinclair",
                "Blackwood", "Forsythe", "Whitmore", "Langley", "Ashford",
                "Beckford", "Cromwell", "Harrington", "Stanhope", "Wentworth",
            ],
        },
    }

    ACTION_WEIGHTS = {
        "GRANTED":  80,
        "DENIED":   10,
        "TAILGATE": 5,
        "FORCED":   5,
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        cfg = self.STRATEGY_CFG[self.strategy]
        self._zones = cfg["zones"]
        self._clearances = cfg["clearances"]
        self._first_names = cfg["first_names"]
        self._last_names = cfg["last_names"]

        self._entries_today = random.randint(20, 200)
        self._denied_count = random.randint(0, 8)
        self._zones_active = random.randint(1, min(6, len(self._zones)))
        self._active_zones = set(random.sample(self._zones, self._zones_active))

        self._second_of_day = random.randint(6 * 3600, 20 * 3600)

        # Pre-fill buffer
        self._events = []
        for _ in range(self.BUFFER_SIZE):
            self._events.append(self._make_event())

    def _make_badge_id(self):
        prefix = random.choice(["B", "C", "E", "V", "M"])
        return f"{prefix}-{random.randint(1000, 9999)}"

    def _make_name(self):
        first = random.choice(self._first_names)
        last = random.choice(self._last_names)
        return f"{first} {last}"

    def _make_timestamp(self):
        h = self._second_of_day // 3600
        m = (self._second_of_day % 3600) // 60
        s = self._second_of_day % 60
        self._second_of_day += random.randint(3, 60)
        if self._second_of_day >= 86400:
            self._second_of_day -= 86400
        return f"{h:02d}:{m:02d}:{s:02d}"

    def _pick_action(self):
        actions = list(self.ACTION_WEIGHTS.keys())
        weights = list(self.ACTION_WEIGHTS.values())
        return random.choices(actions, weights=weights, k=1)[0]

    def _make_event(self):
        action = self._pick_action()
        zone = random.choice(self._zones)
        clearance = random.choice(self._clearances)

        if action == "GRANTED":
            self._entries_today += 1
            self._active_zones.add(zone)
        elif action == "DENIED":
            self._denied_count += 1
        elif action in ("TAILGATE", "FORCED"):
            self._denied_count += 1

        # Recalculate zones_active
        self._zones_active = len(self._active_zones)

        return {
            "timestamp": self._make_timestamp(),
            "badge_id":  self._make_badge_id(),
            "name":      self._make_name(),
            "clearance": clearance,
            "zone":      zone,
            "action":    action,
        }

    def _get_state(self):
        return {
            "events":        list(self._events),
            "entries_today": self._entries_today,
            "denied_count":  self._denied_count,
            "zones_active":  self._zones_active,
            "strategy":      self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        # Add 1 new event, drop oldest to maintain buffer size
        new_event = self._make_event()
        self._events.append(new_event)
        self._events = self._events[-self.BUFFER_SIZE:]

        # Occasionally deactivate a zone (someone left)
        if random.random() < 0.05 and len(self._active_zones) > 1:
            self._active_zones.discard(random.choice(list(self._active_zones)))
            self._zones_active = len(self._active_zones)

        return self._get_state()
