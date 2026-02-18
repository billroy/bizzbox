"""System resource gauges (CPU, RAM dials) generator."""
import random
from .base import BaseActivity


class ResourceGaugesActivity(BaseActivity):
    activity_type = "resource_gauges"
    strategies = ["server_farm", "nuclear_plant", "spacecraft", "data_center", "stock_exchange"]
    titles = [
        "SYSTEM STATUS", "RESOURCE MONITOR", "VITAL SIGNS",
        "SUBSYSTEM STATUS", "PERFORMANCE METRICS", "OPERATIONAL STATUS",
        "TELEMETRY PANEL",
    ]

    GAUGE_DEFS = {
        "server_farm": [
            {"label": "CPU LOAD",    "unit": "%",     "min": 0, "max": 100, "warn": 75, "crit": 90, "init": 45},
            {"label": "MEMORY",      "unit": "%",     "min": 0, "max": 100, "warn": 80, "crit": 95, "init": 62},
            {"label": "DISK I/O",    "unit": "MB/s",  "min": 0, "max": 500, "warn": 350, "crit": 450, "init": 120},
            {"label": "NET TX",      "unit": "Gbps",  "min": 0, "max": 10,  "warn": 7,  "crit": 9,  "init": 2.3},
            {"label": "TEMP",        "unit": "°C",    "min": 20, "max": 90, "warn": 70, "crit": 85, "init": 48},
        ],
        "nuclear_plant": [
            {"label": "REACTOR TEMP",    "unit": "°C",    "min": 200, "max": 600, "warn": 480, "crit": 550, "init": 320},
            {"label": "COOLANT FLOW",    "unit": "L/min", "min": 0,   "max": 5000,"warn": 4200, "crit": 4600, "init": 3200},
            {"label": "POWER OUTPUT",    "unit": "%",     "min": 0,   "max": 100, "warn": 90, "crit": 97, "init": 78},
            {"label": "RADIATION",       "unit": "mSv",   "min": 0,   "max": 10,  "warn": 5,  "crit": 8,  "init": 0.3},
            {"label": "PRESSURE",        "unit": "bar",   "min": 100, "max": 200, "warn": 175, "crit": 190, "init": 155},
        ],
        "spacecraft": [
            {"label": "FUEL",        "unit": "%",  "min": 0, "max": 100, "warn": 20, "crit": 10, "init": 84},
            {"label": "OXYGEN",      "unit": "%",  "min": 0, "max": 100, "warn": 30, "crit": 15, "init": 91},
            {"label": "POWER",       "unit": "%",  "min": 0, "max": 100, "warn": 25, "crit": 15, "init": 97},
            {"label": "COMMS",       "unit": "dB", "min": -120, "max": 0, "warn": -90, "crit": -100, "init": -62},
            {"label": "HULL TEMP",   "unit": "°C", "min": -100, "max": 200, "warn": 120, "crit": 160, "init": -23},
        ],
        "data_center": [
            {"label": "PUE",         "unit": "",   "min": 1.0, "max": 3.0, "warn": 2.0, "crit": 2.5, "init": 1.45},
            {"label": "COOLING",     "unit": "kW", "min": 0,   "max": 500, "warn": 380, "crit": 450, "init": 210},
            {"label": "UPS CHARGE",  "unit": "%",  "min": 0,   "max": 100, "warn": 30,  "crit": 15,  "init": 99},
            {"label": "BANDWIDTH",   "unit": "%",  "min": 0,   "max": 100, "warn": 80,  "crit": 92,  "init": 55},
            {"label": "RACK TEMP",   "unit": "°C", "min": 15,  "max": 45,  "warn": 35,  "crit": 40,  "init": 26},
        ],
        "stock_exchange": [
            {"label": "ORDER RATE",  "unit": "/s",  "min": 0,    "max": 100000, "warn": 80000, "crit": 95000, "init": 42000},
            {"label": "LATENCY",     "unit": "μs",  "min": 0,    "max": 1000,   "warn": 500,   "crit": 800,   "init": 85},
            {"label": "QUEUE DEPTH", "unit": "K",   "min": 0,    "max": 1000,   "warn": 700,   "crit": 900,   "init": 124},
            {"label": "REJECT RATE", "unit": "%",   "min": 0,    "max": 5,      "warn": 2,     "crit": 3.5,   "init": 0.3},
            {"label": "THROUGHPUT",  "unit": "GB/s","min": 0,    "max": 100,    "warn": 80,    "crit": 92,    "init": 34},
        ],
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        defs = self.GAUGE_DEFS[self.strategy]
        self._gauges = []
        for d in defs:
            self._gauges.append({
                "label": d["label"],
                "value": round(d["init"] + random.gauss(0, (d["max"] - d["min"]) * 0.05), 3),
                "unit": d["unit"],
                "min": d["min"],
                "max": d["max"],
                "warn": d["warn"],
                "crit": d["crit"],
            })

    def _get_state(self):
        return {"gauges": self._gauges, "strategy": self.strategy}

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        defs = self.GAUGE_DEFS[self.strategy]
        for gauge, d in zip(self._gauges, defs):
            span = d["max"] - d["min"]
            # Gaussian drift with mean-reversion
            drift = random.gauss(0, span * 0.03)
            new_val = gauge["value"] + drift
            # Clamp
            new_val = max(d["min"], min(d["max"], new_val))
            gauge["value"] = round(new_val, 3)
        return self._get_state()
