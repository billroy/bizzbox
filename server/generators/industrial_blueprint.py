"""Live-drawn blueprint subjects for aerospace and industrial scenes."""
import random

from .base import BaseActivity


class IndustrialBlueprintActivity(BaseActivity):
    activity_type = "industrial_blueprint"
    strategies = ["airplane", "launch_pad", "rocket", "industrial_facility", "turbine"]
    titles = [
        "INDUSTRIAL BLUEPRINT", "ENGINEERING DRAWING", "TECHNICAL SCHEMATIC",
        "AEROSPACE DRAFTING", "FACILITY PLAN",
    ]
    update_interval_override = 0.2

    _SUBJECTS = {
        "airplane": ("AX-47 AIRFRAME GENERAL ARRANGEMENT", ["F.S. 420.00 PRESSURE BULKHEAD", "W.L. 208.50 REF DATUM", "DETAIL C — WING ROOT FITTING"]),
        "launch_pad": ("LAUNCH COMPLEX 07 — SITE ELEVATION", ["T.O. SERVICE TOWER EL. +96.250", "FLAME TRENCH CL 12 500", "DETAIL B — UMBILICAL DECK"]),
        "rocket": ("HLV-9 VEHICLE ENVELOPE", ["STA. 0.000 PAYLOAD FAIRING TIP", "OXIDIZER TANK 8 400 DIA", "SECTION A-A ENGINE THRUST FRAME"]),
        "industrial_facility": ("PROCESS FACILITY — GA / PIPING", ["GRID C5 — REACTOR HALL", "PIPE RACK PR-12 EL. +18.600", "SECTION D-D TURBINE ANNEX"]),
        "turbine": ("AXIAL TURBINE STAGE ASSEMBLY", ["ROTOR OD 3 800 ±0.25", "24X STATOR VANES EQ SP", "SECTION A-A BEARING HOUSING"]),
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._progress = random.uniform(0.02, 0.35)
        self._direction = 1
        self._seed = random.randint(10000, 99999)
        self._subject, self._annotations = self._SUBJECTS[self.strategy]

    def _state(self):
        return {
            "strategy": self.strategy,
            "subject": self._subject,
            "annotations": self._annotations,
            "drawing": f"DWG-{self._seed}-A",
            "revision": random.choice(["A", "B", "C", "03"]),
            "progress": round(self._progress, 4),
            "scale": random.choice(["1:20", "1:50", "1:100"]),
            "units": "mm UNLESS NOTED",
            "discipline": "AEROSPACE / MECHANICAL",
            "checked_by": random.choice(["K. MORI", "L. HERNANDEZ", "S. PATEL", "R. NGUYEN"]),
            "sheet": random.choice(["1 OF 4", "2 OF 7", "3 OF 8"]),
            "tolerance": "X ±1.0  .X ±0.25  ANG ±0.5°",
        }

    def initial_payload(self):
        return self._state()

    def next_frame(self):
        self._progress += self._direction * (0.012 + self.intensity * 0.001)
        if self._progress >= 1.08:
            self._progress = 1.08
            self._direction = -1
        elif self._progress <= 0.02:
            self._progress = 0.02
            self._direction = 1
        return self._state()

    def compute_delta(self, old_state, new_state):
        return {"_delta": True, "progress": new_state["progress"]}
