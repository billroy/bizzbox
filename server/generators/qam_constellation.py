"""256-QAM constellation diagram generator."""
import random
import math
from .base import BaseActivity


class QamConstellationActivity(BaseActivity):
    activity_type = "qam_constellation"
    strategies = ["256qam_clean", "256qam_noisy", "64qam", "16qam", "bpsk_qpsk"]
    titles = [
        "256-QAM CONSTELLATION", "MODULATION ANALYZER", "SYMBOL DIAGRAM",
        "IQ CONSTELLATION", "QAM MONITOR", "SIGNAL QUALITY",
        "DEMODULATOR VIEW",
    ]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._phase_offset = random.uniform(0, math.pi / 4)
        self._evm = self._init_evm()      # Error Vector Magnitude %
        self._phase_noise = random.uniform(0.005, 0.02)
        self._freq_offset = random.uniform(-0.01, 0.01)
        self._t = 0.0

    def _init_evm(self):
        evms = {
            "256qam_clean":  random.uniform(1.0, 3.0),
            "256qam_noisy":  random.uniform(6.0, 12.0),
            "64qam":         random.uniform(2.0, 5.0),
            "16qam":         random.uniform(1.5, 4.0),
            "bpsk_qpsk":     random.uniform(0.5, 2.5),
        }
        return evms.get(self.strategy, 4.0)

    def _ideal_points(self):
        """Return list of ideal constellation points for the strategy."""
        pts = []
        if self.strategy in ("256qam_clean", "256qam_noisy"):
            # 16×16 grid, ±1, ±3, …, ±15 (normalized to ±1 range)
            levels = [-15, -13, -11, -9, -7, -5, -3, -1, 1, 3, 5, 7, 9, 11, 13, 15]
            scale = 1.0 / 15.0
            for i in levels:
                for q in levels:
                    pts.append((i * scale, q * scale))
        elif self.strategy == "64qam":
            levels = [-7, -5, -3, -1, 1, 3, 5, 7]
            scale = 1.0 / 7.0
            for i in levels:
                for q in levels:
                    pts.append((i * scale, q * scale))
        elif self.strategy == "16qam":
            levels = [-3, -1, 1, 3]
            scale = 1.0 / 3.0
            for i in levels:
                for q in levels:
                    pts.append((i * scale, q * scale))
        elif self.strategy == "bpsk_qpsk":
            # Show both BPSK and QPSK
            pts = [(-1, 0), (1, 0),          # BPSK
                   (-0.5, -0.5), (-0.5, 0.5),  # QPSK inner
                   (0.5, -0.5),  (0.5, 0.5)]
        return pts

    def _sample_points(self, n=300):
        """Sample n received symbols around ideal points with noise."""
        ideal = self._ideal_points()
        if not ideal:
            return []
        noise_std = self._evm / 100.0
        pts = []
        for _ in range(n):
            i_pt, q_pt = random.choice(ideal)
            # Phase noise rotation
            theta = random.gauss(0, self._phase_noise) + self._freq_offset * self._t
            cos_t, sin_t = math.cos(theta), math.sin(theta)
            i_rot = i_pt * cos_t - q_pt * sin_t
            q_rot = i_pt * sin_t + q_pt * cos_t
            # AWGN
            i_rx = i_rot + random.gauss(0, noise_std)
            q_rx = q_rot + random.gauss(0, noise_std)
            pts.append((round(max(-1.2, min(1.2, i_rx)), 4),
                        round(max(-1.2, min(1.2, q_rx)), 4)))
        return pts

    def _get_state(self):
        return {
            "points": self._sample_points(280),
            "strategy": self.strategy,
            "evm": round(self._evm, 2),
            "phase_offset": round(self._phase_offset % (math.pi * 2), 4),
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        self._t += 0.05
        # Slowly drift EVM (simulate channel variation)
        self._evm = max(0.5, min(15.0, self._evm + random.gauss(0, 0.1)))
        # Slowly drift phase
        self._phase_offset += random.gauss(0, 0.005)
        return self._get_state()
