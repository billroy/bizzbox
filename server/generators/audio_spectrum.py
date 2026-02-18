"""Audio frequency spectrum / equalizer generator."""
import random
import math
from .base import BaseActivity

# Band counts per strategy
_BIN_COUNTS = {
    "eq_bars": 32,
    "smooth_curve": 64,
    "mirrored_spectrum": 32,
    "octave_bands": 10,
    "waveform_peaks": 64,
}


class AudioSpectrumActivity(BaseActivity):
    activity_type = "audio_spectrum"
    strategies = ["eq_bars", "smooth_curve", "mirrored_spectrum", "octave_bands", "waveform_peaks"]
    titles = ["FREQ ANALYZER", "AUDIO SPECTRUM", "SIGNAL SPECTRUM", "WAVEFORM", "SPECTRAL VIEW"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._t = 0.0
        self._bin_count = _BIN_COUNTS[self.strategy]
        # Build sine-composite parameters: for each band, 3-5 sine waves
        self._waves = self._build_waves()
        # Peak-hold values for waveform_peaks strategy
        self._peaks = [0.0] * self._bin_count

    def _build_waves(self) -> list[list[dict]]:
        """For each frequency bin, generate 3-5 sine wave parameters."""
        waves = []
        for i in range(self._bin_count):
            n = random.randint(3, 5)
            bin_waves = [
                {
                    "freq": random.uniform(0.1, 3.0),
                    "phase": random.uniform(0, 2 * math.pi),
                    "amp": random.uniform(0.1, 0.5),
                }
                for _ in range(n)
            ]
            waves.append(bin_waves)
        return waves

    def _compute_bands(self) -> list[float]:
        bands = []
        for bin_waves in self._waves:
            v = sum(
                w["amp"] * math.sin(w["freq"] * self._t + w["phase"])
                for w in bin_waves
            )
            # Shift from [-sum_amp, +sum_amp] into [0, 1]
            max_amp = sum(w["amp"] for w in bin_waves)
            v = (v + max_amp) / (2 * max_amp)
            # Add a small gaussian noise
            v += random.gauss(0, 0.03)
            v = max(0.0, min(1.0, v))
            bands.append(round(v, 4))
        return bands

    def _get_state(self) -> dict:
        bands = self._compute_bands()

        peaks = None
        if self.strategy == "waveform_peaks":
            # Update peak-hold: rise instantly, decay slowly
            for i, b in enumerate(bands):
                if b >= self._peaks[i]:
                    self._peaks[i] = b
                else:
                    self._peaks[i] = max(0.0, self._peaks[i] - 0.02)
            peaks = [round(p, 4) for p in self._peaks]

        return {
            "bands": bands,
            "peaks": peaks,
            "strategy": self.strategy,
            "bin_count": self._bin_count,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        self._t += 0.05
        return self._get_state()
