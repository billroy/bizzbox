"""Signal waveform oscilloscope generator."""
import random
import math
from .base import BaseActivity


class OscilloscopeActivity(BaseActivity):
    activity_type = "oscilloscope"
    strategies = ["ecg_heartbeat", "seismic", "radio_carrier", "brain_wave", "power_grid_ac"]
    titles = [
        "OSCILLOSCOPE", "WAVEFORM ANALYSIS", "SIGNAL MONITOR",
        "SPECTRUM DISPLAY", "BIOSIGNAL TRACE", "SEISMIC FEED",
        "CARRIER WAVE",
    ]

    SAMPLE_COUNT = 256

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._t = 0.0
        self._noise_level = random.uniform(0.02, 0.08)
        self._params = self._init_params()

    def _init_params(self):
        if self.strategy == "ecg_heartbeat":
            return {"bpm": random.randint(55, 110), "qrs_width": random.uniform(0.03, 0.06)}
        elif self.strategy == "seismic":
            return {"base_freq": random.uniform(0.5, 2.0), "event_prob": 0.02}
        elif self.strategy == "radio_carrier":
            return {"carrier_freq": random.uniform(8, 20), "mod_freq": random.uniform(0.5, 2.0)}
        elif self.strategy == "brain_wave":
            return {
                "alpha": random.uniform(0.3, 0.6),  # 8-13 Hz
                "beta":  random.uniform(0.1, 0.3),  # 13-30 Hz
                "theta": random.uniform(0.1, 0.2),  # 4-8 Hz
            }
        elif self.strategy == "power_grid_ac":
            return {"freq": 60.0, "distortion": random.uniform(0.0, 0.08)}
        return {}

    def _generate_samples(self):
        samples = []
        p = self._params
        dt = 1.0 / self.SAMPLE_COUNT

        for i in range(self.SAMPLE_COUNT):
            t = self._t + i * dt

            if self.strategy == "ecg_heartbeat":
                period = 60.0 / p["bpm"]
                tp = t % period
                # Flat baseline
                v = 0.0
                # P wave
                if tp < 0.09:
                    v = 0.15 * math.sin(math.pi * tp / 0.09)
                # QRS complex
                elif 0.12 < tp < 0.12 + p["qrs_width"]:
                    pos = (tp - 0.12) / p["qrs_width"]
                    if pos < 0.2:
                        v = -0.1
                    elif pos < 0.5:
                        v = 1.0 * math.sin(math.pi * (pos - 0.2) / 0.3)
                    else:
                        v = -0.15 * math.sin(math.pi * (pos - 0.5) / 0.5)
                # T wave
                elif 0.22 < tp < 0.38:
                    v = 0.3 * math.sin(math.pi * (tp - 0.22) / 0.16)

            elif self.strategy == "seismic":
                v = 0.1 * math.sin(2 * math.pi * p["base_freq"] * t)
                v += 0.05 * math.sin(2 * math.pi * p["base_freq"] * 3 * t)
                # Random seismic events
                if random.random() < p["event_prob"]:
                    v += random.uniform(-0.8, 0.8)

            elif self.strategy == "radio_carrier":
                # AM modulation
                modulation = 0.5 + 0.5 * math.sin(2 * math.pi * p["mod_freq"] * t)
                v = modulation * math.sin(2 * math.pi * p["carrier_freq"] * t)

            elif self.strategy == "brain_wave":
                v = (p["alpha"] * math.sin(2 * math.pi * 10 * t) +
                     p["beta"]  * math.sin(2 * math.pi * 20 * t) +
                     p["theta"] * math.sin(2 * math.pi * 6 * t))
                v *= 0.6

            elif self.strategy == "power_grid_ac":
                v = math.sin(2 * math.pi * p["freq"] * t)
                # Harmonic distortion
                v += p["distortion"] * math.sin(2 * math.pi * p["freq"] * 3 * t)
                v += p["distortion"] * 0.5 * math.sin(2 * math.pi * p["freq"] * 5 * t)

            else:
                v = math.sin(2 * math.pi * t)

            # Add noise
            v += random.gauss(0, self._noise_level)
            samples.append(round(max(-1.2, min(1.2, v)), 4))

        return samples

    def _get_state(self):
        return {
            "samples": self._generate_samples(),
            "strategy": self.strategy,
            "params": self._params,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        self._t += 0.5 + random.uniform(-0.1, 0.1)
        # Slowly drift params
        if self.strategy == "ecg_heartbeat" and random.random() > 0.9:
            self._params["bpm"] = max(40, min(150, self._params["bpm"] + random.randint(-2, 2)))
        return self._get_state()
