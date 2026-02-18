"""Countdown timer to unnamed event generator."""
import random
from .base import BaseActivity


class CountdownActivity(BaseActivity):
    activity_type = "countdown"
    strategies = ["mission_launch", "system_purge", "protocol_expiry", "detonation", "election_results"]
    titles = [
        "COUNTDOWN", "T-MINUS", "TIMER ACTIVE",
        "SEQUENCE INITIATED", "EVENT CLOCK", "CRITICAL TIMER",
        "PHASE COUNTDOWN",
    ]

    PHASES = {
        "mission_launch": [
            {"threshold_ms": 600000, "label": "T-MINUS LAUNCH WINDOW", "style": "normal"},
            {"threshold_ms": 60000,  "label": "IGNITION SEQUENCE",     "style": "warn"},
            {"threshold_ms": 10000,  "label": "TERMINAL COUNT",        "style": "critical"},
            {"threshold_ms": 0,      "label": "IGNITION — LIFTOFF",    "style": "critical"},
        ],
        "system_purge": [
            {"threshold_ms": 300000, "label": "SCHEDULED PURGE",       "style": "normal"},
            {"threshold_ms": 30000,  "label": "PURGE IMMINENT",        "style": "warn"},
            {"threshold_ms": 5000,   "label": "PURGE INITIATED",       "style": "critical"},
            {"threshold_ms": 0,      "label": "PURGE COMPLETE",        "style": "critical"},
        ],
        "protocol_expiry": [
            {"threshold_ms": 600000, "label": "CERT EXPIRY WINDOW",    "style": "normal"},
            {"threshold_ms": 60000,  "label": "RENEWAL REQUIRED",      "style": "warn"},
            {"threshold_ms": 0,      "label": "CERTIFICATE EXPIRED",   "style": "critical"},
        ],
        "detonation": [
            {"threshold_ms": 300000, "label": "ARM SEQUENCE",          "style": "warn"},
            {"threshold_ms": 30000,  "label": "DETONATION WINDOW",     "style": "critical"},
            {"threshold_ms": 5000,   "label": "ABORT/EXECUTE",         "style": "critical"},
            {"threshold_ms": 0,      "label": "DETONATED",             "style": "critical"},
        ],
        "election_results": [
            {"threshold_ms": 600000, "label": "POLLS CLOSE IN",        "style": "normal"},
            {"threshold_ms": 120000, "label": "COUNTING UNDERWAY",     "style": "normal"},
            {"threshold_ms": 30000,  "label": "PROJECTION IMMINENT",   "style": "warn"},
            {"threshold_ms": 0,      "label": "RESULTS DECLARED",      "style": "critical"},
        ],
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._phases = self.PHASES[self.strategy]
        # Random starting time between 2 and 10 minutes
        self._remaining_ms = random.randint(120000, 600000)
        self._last_tick = None

    def _current_phase(self):
        for phase in self._phases:
            if self._remaining_ms >= phase["threshold_ms"]:
                return phase
        return self._phases[-1]

    def _get_state(self):
        phase = self._current_phase()
        total_ms = self._remaining_ms
        hours = total_ms // 3600000
        mins = (total_ms % 3600000) // 60000
        secs = (total_ms % 60000) // 1000
        ms = total_ms % 1000
        return {
            "remaining_ms": total_ms,
            "display": f"{hours:02d}:{mins:02d}:{secs:02d}.{ms:03d}",
            "phase_label": phase["label"],
            "phase_style": phase["style"],
            "phases": self._phases,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        # Decrement by a realistic interval (200-500ms per update at normal intensity)
        decrement = random.randint(100, 500)
        self._remaining_ms = max(0, self._remaining_ms - decrement)
        # Reset when it hits zero
        if self._remaining_ms == 0:
            self._remaining_ms = random.randint(120000, 600000)
        return self._get_state()
