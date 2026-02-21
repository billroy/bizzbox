"""Sonar bearing-time waterfall display with contact tracking."""
import random
from .base import BaseActivity


class SonarActivity(BaseActivity):
    activity_type = "sonar"
    strategies = [
        "submarine_hunt", "harbor_defense", "marine_biology",
        "deep_sea_survey", "torpedo_tracking",
    ]
    titles = [
        "SONAR", "HYDROPHONE", "ACOUSTIC SENSOR", "PASSIVE SONAR",
        "BEARING DISPLAY", "TOWED ARRAY", "BOW SONAR", "HULL ARRAY",
    ]

    COLS = 60   # bearing columns (0-359 mapped to 60 bins)
    ROWS = 30   # time rows kept in waterfall

    # Background noise level range per strategy
    NOISE_RANGE = {
        "submarine_hunt":  (10, 30),
        "harbor_defense":  (30, 60),
        "marine_biology":  (15, 40),
        "deep_sea_survey": (5, 20),
        "torpedo_tracking": (25, 55),
    }

    # Possible classifications per strategy (ordered by confidence progression)
    CLASSIFICATIONS = {
        "submarine_hunt":  ["unknown", "merchant", "submarine", "submarine"],
        "harbor_defense":  ["unknown", "merchant", "fishing", "merchant"],
        "marine_biology":  ["unknown", "whale", "whale", "whale"],
        "deep_sea_survey": ["unknown", "merchant", "unknown", "fishing"],
        "torpedo_tracking": ["unknown", "torpedo", "torpedo", "torpedo"],
    }

    LABEL_PREFIXES = ["SIERRA", "CONTACT", "MASTER", "GOBLIN", "DESIGNATE"]
    LABEL_SUFFIXES = [
        "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
        "ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOXTROT",
    ]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        lo, hi = self.NOISE_RANGE[self.strategy]
        self._noise_base = random.uniform(lo, hi)
        self._noise_floor = self._noise_base
        self._sweep_bearing = random.randint(0, 359)
        self._contacts = self._make_initial_contacts()
        self._waterfall = []
        # Pre-populate waterfall history
        for _ in range(self.ROWS):
            self._waterfall.append(self._make_row())

    # ── contacts ──────────────────────────────────────────────────

    def _random_label(self):
        return f"{random.choice(self.LABEL_PREFIXES)}-{random.choice(self.LABEL_SUFFIXES)}"

    def _make_contact(self):
        return {
            "bearing": random.randint(0, 359),
            "range_val": random.randint(500, 20000),
            "classification": "unknown",
            "confidence": random.randint(0, 20),
            "label": self._random_label(),
        }

    def _make_initial_contacts(self):
        count = random.randint(2, 5)
        return [self._make_contact() for _ in range(count)]

    def _evolve_contacts(self):
        classes = self.CLASSIFICATIONS[self.strategy]
        for c in self._contacts:
            # Drift bearing
            c["bearing"] = (c["bearing"] + random.randint(-2, 2)) % 360
            # Drift range
            c["range_val"] += random.randint(-200, 200)
            c["range_val"] = max(500, min(20000, c["range_val"]))
            # Confidence grows if contact persists
            if random.random() < 0.7:
                c["confidence"] = min(100, c["confidence"] + random.randint(1, 3))
            else:
                c["confidence"] = max(0, c["confidence"] - random.randint(1, 4))
            # Classification evolves with confidence
            if c["confidence"] < 25:
                c["classification"] = classes[0]
            elif c["confidence"] < 50:
                c["classification"] = classes[1]
            elif c["confidence"] < 75:
                c["classification"] = classes[2]
            else:
                c["classification"] = classes[3]

        # Fade contacts that dropped to zero confidence
        self._contacts = [c for c in self._contacts if c["confidence"] > 0]

        # Chance of new contact appearing
        if random.random() < 0.05 and len(self._contacts) < 7:
            self._contacts.append(self._make_contact())

        # Ensure minimum contacts
        while len(self._contacts) < 2:
            self._contacts.append(self._make_contact())

    # ── waterfall ─────────────────────────────────────────────────

    def _make_row(self):
        """Generate one row of COLS intensity values (0-255)."""
        lo, hi = self.NOISE_RANGE[self.strategy]
        row = [
            max(0, min(255, int(random.gauss(self._noise_floor, (hi - lo) * 0.3))))
            for _ in range(self.COLS)
        ]

        # Inject sonar returns at contact bearings
        for c in self._contacts:
            col = int(c["bearing"] / 360 * self.COLS) % self.COLS
            strength = int(80 + c["confidence"] * 1.5 + random.randint(-10, 10))
            strength = max(0, min(255, strength))
            row[col] = max(row[col], strength)
            # Spread to adjacent bins
            if col > 0:
                bleed = max(0, min(255, strength - random.randint(20, 50)))
                row[col - 1] = max(row[col - 1], bleed)
            if col < self.COLS - 1:
                bleed = max(0, min(255, strength - random.randint(20, 50)))
                row[col + 1] = max(row[col + 1], bleed)

        # Random noise spikes (sonar-like transients)
        for _ in range(random.randint(0, 3)):
            spike_col = random.randint(0, self.COLS - 1)
            spike_val = random.randint(100, 200)
            row[spike_col] = max(row[spike_col], spike_val)

        return row

    # ── state ─────────────────────────────────────────────────────

    def _get_state(self):
        return {
            "waterfall": self._waterfall[:self.ROWS],
            "contacts": [
                {
                    "bearing": c["bearing"],
                    "range_val": c["range_val"],
                    "classification": c["classification"],
                    "confidence": c["confidence"],
                    "label": c["label"],
                }
                for c in self._contacts
            ],
            "sweep_bearing": self._sweep_bearing,
            "noise_floor": round(self._noise_floor, 1),
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        # Advance sweep bearing
        self._sweep_bearing = (self._sweep_bearing + 6) % 360

        # Drift noise floor slightly
        self._noise_floor += random.uniform(-0.5, 0.5)
        lo, hi = self.NOISE_RANGE[self.strategy]
        self._noise_floor = max(lo * 0.8, min(hi * 1.2, self._noise_floor))

        # Evolve contacts
        self._evolve_contacts()

        # Prepend new waterfall row, drop oldest
        new_row = self._make_row()
        self._waterfall = [new_row] + self._waterfall[:self.ROWS - 1]

        return self._get_state()

    def compute_delta(self, old_state, new_state):
        return {
            "_delta": True,
            "_limits": {"waterfall": self.ROWS},
            "prepend_waterfall": [new_state["waterfall"][0]],
            "sweep_bearing": new_state["sweep_bearing"],
            "contacts": new_state["contacts"],
            "noise_floor": new_state["noise_floor"],
        }
