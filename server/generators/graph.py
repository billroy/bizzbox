"""Real-time scrolling line graph generator."""
import random
import math
from .base import BaseActivity

# Per-strategy config
_CONFIGS = {
    "stock_ticker": {
        "y_label": "PRICE",
        "y_range": (80.0, 320.0),
        "drift": 0.15,
        "volatility": 2.5,
        "format": "${:.2f}",
    },
    "temperature_monitoring": {
        "y_label": "TEMP °C",
        "y_range": (15.0, 85.0),
        "drift": 0.02,
        "volatility": 0.5,
        "format": "{:.1f}°",
    },
    "population_growth": {
        "y_label": "POP (M)",
        "y_range": (100.0, 900.0),
        "drift": 0.08,
        "volatility": 1.0,
        "format": "{:.0f}M",
    },
    "network_throughput": {
        "y_label": "Mbps",
        "y_range": (0.0, 1000.0),
        "drift": 0.0,
        "volatility": 40.0,
        "format": "{:.0f}",
    },
    "seismic_amplitude": {
        "y_label": "AMPLITUDE",
        "y_range": (-1.0, 1.0),
        "drift": 0.0,
        "volatility": 0.15,
        "format": "{:.3f}",
    },
}

_POINTS = 80  # number of historical data points


class GraphActivity(BaseActivity):
    activity_type = "graph"
    strategies = list(_CONFIGS.keys())
    titles = ["STOCK TICKER", "TEMP MONITOR", "POPULATION", "THROUGHPUT", "SEISMIC"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        cfg = _CONFIGS[self.strategy]
        lo, hi = cfg["y_range"]
        mid = (lo + hi) / 2
        # Start with some initial data
        self._value = mid + random.uniform(-abs(hi - lo) * 0.1, abs(hi - lo) * 0.1)
        self._points = []
        for _ in range(_POINTS):
            self._advance_value()
            self._points.append(round(self._value, 4))
        self._t = 0

    def _advance_value(self):
        cfg = _CONFIGS[self.strategy]
        lo, hi = cfg["y_range"]
        drift = cfg["drift"]
        vol = cfg["volatility"]
        # Random walk with mean reversion
        mid = (lo + hi) / 2
        reversion = (mid - self._value) * 0.005
        delta = reversion + drift * 0.01 + random.gauss(0, vol * 0.1)
        self._value += delta
        self._value = max(lo, min(hi, self._value))

    def _get_state(self) -> dict:
        cfg = _CONFIGS[self.strategy]
        return {
            "points": list(self._points),
            "y_label": cfg["y_label"],
            "y_range": list(cfg["y_range"]),
            "format": cfg["format"],
            "current": round(self._value, 4),
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        # Strip y_label, y_range, format, strategy (static); append 1 new point
        return {
            "_delta": True,
            "_limits": {"points": 80},
            "append_points": [new_state["points"][-1]],
            "current": new_state["current"],
        }

    def next_frame(self) -> dict:
        self._t += 1
        self._advance_value()
        self._points.append(round(self._value, 4))
        if len(self._points) > _POINTS:
            self._points = self._points[-_POINTS:]
        return self._get_state()
