"""SDR spectrum waterfall generator — scrolling frequency/power display with signals."""
import random
import math
from .base import BaseActivity


class SdrWaterfallActivity(BaseActivity):
    activity_type = "sdr_waterfall"
    strategies = ["ham_bands", "cellular", "wifi_crowded", "satellite", "military"]
    titles = [
        "SDR WATERFALL", "SPECTRUM ANALYZER", "RF MONITOR",
        "FREQUENCY SCAN", "SIGNAL HUNTER", "SPECTRUM WATCH",
        "WIDEBAND RECEIVER",
    ]

    BINS = 128          # frequency bins per row
    HISTORY = 40        # rows of waterfall history kept on server

    # Named signals per strategy: (center_bin_fraction, width_bins, power_dB_above_noise)
    SIGNAL_TEMPLATES = {
        "ham_bands": [
            (0.08, 3, 28), (0.15, 2, 22), (0.38, 5, 35),
            (0.55, 3, 20), (0.72, 4, 30), (0.90, 2, 18),
        ],
        "cellular": [
            (0.12, 8, 40), (0.30, 8, 38), (0.52, 10, 42),
            (0.75, 9, 36), (0.88, 7, 32),
        ],
        "wifi_crowded": [
            (0.10, 12, 45), (0.25, 12, 50), (0.42, 12, 38),
            (0.60, 12, 48), (0.78, 12, 42),
        ],
        "satellite": [
            (0.20, 4, 20), (0.45, 6, 25), (0.65, 4, 18),
            (0.85, 5, 22),
        ],
        "military": [
            (0.05, 2, 55), (0.33, 3, 48), (0.50, 2, 60),
            (0.67, 4, 52), (0.95, 2, 50),
        ],
    }

    # Frequency range labels per strategy
    FREQ_LABELS = {
        "ham_bands":   ("144.000", "148.000", "MHz"),
        "cellular":    ("850.000", "895.000", "MHz"),
        "wifi_crowded": ("2412.0", "2484.0",  "MHz"),
        "satellite":   ("1525.0",  "1559.0",  "MHz"),
        "military":    ("225.000", "400.000", "MHz"),
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._noise_floor = random.uniform(-85, -75)   # dBm
        self._noise_std = random.uniform(3.0, 5.0)
        self._signals = self._init_signals()
        self._waterfall = []   # list of rows (newest first)
        self._t = 0
        # Pre-populate waterfall
        for _ in range(self.HISTORY):
            self._waterfall.append(self._make_row())

    def _init_signals(self):
        templates = self.SIGNAL_TEMPLATES[self.strategy]
        signals = []
        for (cf, w, pwr) in templates:
            # Randomly activate ~60% of signals
            if random.random() < 0.6:
                signals.append({
                    "center": cf,
                    "width": w,
                    "power": pwr,
                    "drift": random.uniform(-0.0002, 0.0002),
                    "pulse": random.random() < 0.3,   # pulsed vs continuous
                    "pulse_period": random.uniform(0.3, 2.0),
                    "active": True,
                })
        return signals

    def _make_row(self):
        """Generate one row of BINS power values (normalized 0-1)."""
        # Start with noise floor
        row = [random.gauss(0, self._noise_std) for _ in range(self.BINS)]

        for sig in self._signals:
            if not sig["active"]:
                continue
            # Check pulse state
            on = True
            if sig["pulse"]:
                phase = (self._t % sig["pulse_period"]) / sig["pulse_period"]
                on = phase < 0.5

            if on:
                center_bin = sig["center"] * self.BINS
                half_w = sig["width"] / 2.0
                for b in range(self.BINS):
                    dist = abs(b - center_bin)
                    if dist < half_w * 3:
                        # Gaussian signal shape
                        strength = sig["power"] * math.exp(-0.5 * (dist / max(half_w, 0.5)) ** 2)
                        row[b] += strength

        # Normalize: noise floor = 0, peak signal ≈ 1
        dynamic_range = 60.0  # dB
        row_norm = [max(0.0, min(1.0, round(v / dynamic_range, 3))) for v in row]
        return row_norm

    def _get_state(self):
        freq = self.FREQ_LABELS[self.strategy]
        return {
            "waterfall": self._waterfall[:self.HISTORY],
            "bins": self.BINS,
            "freq_start": freq[0],
            "freq_end": freq[1],
            "freq_unit": freq[2],
            "strategy": self.strategy,
            "noise_floor": round(self._noise_floor, 1),
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        self._t += 0.1 + random.uniform(-0.02, 0.02)

        # Drift signals slightly
        for sig in self._signals:
            sig["center"] = max(0.02, min(0.98, sig["center"] + sig["drift"]))
            # Randomly toggle some signals on/off
            if random.random() < 0.02:
                sig["active"] = not sig["active"]

        # Prepend new row, drop oldest
        new_row = self._make_row()
        self._waterfall = [new_row] + self._waterfall[: self.HISTORY - 1]

        return self._get_state()

    def compute_delta(self, old_state, new_state):
        return {
            "_delta": True,
            "_limits": {"waterfall": self.HISTORY},
            "prepend_waterfall": [new_state["waterfall"][0]],
            "noise_floor": new_state["noise_floor"],
        }
