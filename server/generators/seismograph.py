"""Seismograph generator — three-channel waveform with event simulation."""
import random
import math
from .base import BaseActivity


class SeismographActivity(BaseActivity):
    activity_type = "seismograph"
    strategies = [
        "tectonic_monitor",
        "building_structural",
        "blast_detection",
        "volcanic_observatory",
        "submarine_hydrophone",
    ]
    titles = [
        "SEISMIC MONITOR",
        "WAVEFORM ANALYSIS",
        "SEISMOGRAPH STATION",
        "GROUND MOTION SENSOR",
        "STRUCTURAL MONITOR",
        "VOLCANIC SEISMOGRAPH",
        "HYDROPHONE ARRAY",
    ]

    SAMPLE_COUNT = 120

    # Per-strategy: (noise_sigma, event_interval_min, event_interval_max,
    #                mag_min, mag_max, depth_km_min, depth_km_max)
    STRATEGY_CFG = {
        "tectonic_monitor":    (0.04, 30, 60,  2.0, 6.5, 5.0,  80.0),
        "building_structural": (0.02, 20, 45,  0.1, 2.0, 0.0,   0.5),
        "blast_detection":     (0.03, 15, 40,  1.0, 3.5, 0.0,   1.0),
        "volcanic_observatory":(0.06, 10, 35,  0.5, 4.0, 0.5,  15.0),
        "submarine_hydrophone":(0.05, 25, 55,  2.5, 5.5, 10.0, 200.0),
    }

    STATION_PREFIXES = ["STN", "STA", "GS", "MNT", "HYD"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        cfg = self.STRATEGY_CFG[self.strategy]
        self._noise_sigma = cfg[0]
        self._event_interval_min = cfg[1]
        self._event_interval_max = cfg[2]
        self._mag_min = cfg[3]
        self._mag_max = cfg[4]
        self._depth_min = cfg[5]
        self._depth_max = cfg[6]

        self._station = (
            f"{random.choice(self.STATION_PREFIXES)}-"
            f"{random.randint(10, 999):03d}"
        )

        # Three channels: Z (vertical), N (north), E (east)
        # Each is a circular buffer of SAMPLE_COUNT floats
        self._channels = [
            {"name": "Z", "samples": [self._noise() for _ in range(self.SAMPLE_COUNT)]},
            {"name": "N", "samples": [self._noise() for _ in range(self.SAMPLE_COUNT)]},
            {"name": "E", "samples": [self._noise() for _ in range(self.SAMPLE_COUNT)]},
        ]

        self._magnitude = None
        self._depth_km = None
        self._peak = 0.0

        # Event state
        self._event_countdown = random.randint(self._event_interval_min,
                                               self._event_interval_max)
        self._event_frame = -999   # frame index when event starts
        self._frame = 0

        # Micro-drift for baseline wander
        self._drift_phase = random.uniform(0, math.tau)

    def _noise(self, sigma_override=None):
        sigma = sigma_override if sigma_override is not None else self._noise_sigma
        return round(random.gauss(0, sigma), 5)

    def _event_waveform(self, channel_idx, sample_idx):
        """Return the event-driven waveform amplitude for a given sample position."""
        # Relative time within the event (in samples)
        elapsed = self._frame - self._event_frame
        # P-wave: sharp onset, small amplitude, arrives at sample 0
        # S-wave: larger, lower frequency, arrives ~20 samples later
        p_onset = 0
        s_onset = 20
        decay_tau = 30.0  # samples

        t = elapsed * 8 + sample_idx  # virtual sample index

        # Scale amplitudes by magnitude
        mag = self._magnitude or 1.0
        p_amp = min(0.25, 0.04 * (10 ** ((mag - 2.0) * 0.4)))
        s_amp = min(0.95, 0.12 * (10 ** ((mag - 2.0) * 0.4)))

        v = 0.0

        # P-wave (high freq, small amplitude)
        pt = t - p_onset
        if 0 <= pt < 60:
            env = math.exp(-pt / decay_tau)
            v += p_amp * env * math.sin(2 * math.pi * 0.3 * pt + channel_idx * 0.5)

        # S-wave (lower freq, larger amplitude)
        st = t - s_onset
        if 0 <= st < 80:
            env = math.exp(-st / (decay_tau * 1.5))
            v += s_amp * env * math.sin(2 * math.pi * 0.12 * st + channel_idx * 1.1)

        return v

    def _in_event(self):
        elapsed = self._frame - self._event_frame
        return 0 <= elapsed < 20  # active for 20 frames after trigger

    def _get_state(self):
        return {
            "channels":  [
                {
                    "name":    ch["name"],
                    "samples": list(ch["samples"]),
                }
                for ch in self._channels
            ],
            "station":   self._station,
            "magnitude": round(self._magnitude, 2) if self._magnitude is not None else None,
            "depth_km":  round(self._depth_km, 1) if self._depth_km is not None else None,
            "peak":      round(self._peak, 5),
            "strategy":  self.strategy,
        }

    # Number of new samples appended per frame (rightmost portion of the buffer).
    # The rest of the buffer is shifted left. Client uses this to apply append deltas.
    SAMPLES_PER_TICK = 8

    def initial_payload(self) -> dict:
        return self._get_state()

    def compute_delta(self, old_state: dict, new_state: dict) -> dict | None:
        """Send only the rightmost SAMPLES_PER_TICK samples per channel as an append delta."""
        new_channels = new_state.get("channels", [])
        if len(new_channels) != 3:
            return None

        append = []
        for ch in new_channels:
            samples = ch.get("samples", [])
            # Take the last SAMPLES_PER_TICK samples as the "new" data
            append.append(samples[-self.SAMPLES_PER_TICK:])

        return {
            "_delta": True,
            "append": append,
            "magnitude": new_state.get("magnitude"),
            "depth_km": new_state.get("depth_km"),
            "peak": new_state.get("peak"),
        }

    def next_frame(self) -> dict:
        self._frame += 1
        self._event_countdown -= 1

        # Trigger new event
        if self._event_countdown <= 0:
            self._event_frame = self._frame
            self._magnitude = round(
                random.uniform(self._mag_min, self._mag_max), 1
            )
            self._depth_km = round(
                random.uniform(self._depth_min, self._depth_max), 1
            )
            self._event_countdown = random.randint(
                self._event_interval_min, self._event_interval_max
            )
        elif not self._in_event():
            # Clear magnitude/depth between events (quiet periods)
            if self._magnitude is not None and self._frame - self._event_frame > 25:
                self._magnitude = None
                self._depth_km = None

        # Drift phase for very-low-frequency baseline wander
        self._drift_phase += 0.07

        # Generate new samples for each channel
        all_vals = []
        for ch_idx, ch in enumerate(self._channels):
            new_samples = []
            for s in range(self.SAMPLE_COUNT):
                # Baseline noise
                v = self._noise()

                # Long-period baseline wander (millihertz)
                wander_amp = self._noise_sigma * 0.5
                v += wander_amp * math.sin(self._drift_phase * 0.05 + ch_idx * 1.2 + s * 0.01)

                # Event contribution
                if self._event_frame >= 0:
                    ev = self._event_waveform(ch_idx, s)
                    # Vertical (Z) gets strongest P; N/E get stronger S
                    if ch["name"] == "Z":
                        v += ev * 1.0
                    elif ch["name"] == "N":
                        v += ev * 0.8
                    else:
                        v += ev * 0.7

                v = round(max(-1.0, min(1.0, v)), 5)
                new_samples.append(v)
                all_vals.append(abs(v))

            ch["samples"] = new_samples

        self._peak = max(all_vals) if all_vals else 0.0

        return self._get_state()
