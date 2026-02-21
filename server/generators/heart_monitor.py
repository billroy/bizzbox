"""Hospital-style patient heart monitor with EKG, vitals readouts."""
import random
import math
from .base import BaseActivity


class HeartMonitorActivity(BaseActivity):
    activity_type = "heart_monitor"
    strategies = [
        "normal_sinus", "normal_sinus", "normal_sinus",  # weighted toward normal
        "sinus_tachycardia", "atrial_fibrillation",
        "ventricular_tachycardia", "bradycardia",
    ]
    titles = [
        "PATIENT MONITOR", "BEDSIDE MONITOR", "VITAL SIGNS",
        "TELEMETRY", "ICU MONITOR", "CARDIAC MONITOR",
    ]

    SAMPLE_COUNT = 256

    # Normal vital ranges
    NORMAL_VITALS = {
        "hr": (60, 100),
        "bp_sys": (110, 130),
        "bp_dia": (70, 85),
        "spo2": (95, 100),
        "resp": (12, 20),
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._t = 0.0
        self._noise_level = random.uniform(0.01, 0.04)
        self._is_normal = self.strategy in ("normal_sinus",)
        self._vitals = self._init_vitals()
        self._params = self._init_params()

    def _init_vitals(self):
        if self._is_normal:
            return {
                "hr": random.randint(60, 100),
                "bp_sys": random.randint(110, 130),
                "bp_dia": random.randint(70, 85),
                "spo2": random.randint(95, 100),
                "resp": random.randint(12, 20),
            }
        elif self.strategy == "sinus_tachycardia":
            return {
                "hr": random.randint(130, 180),
                "bp_sys": random.randint(90, 110),
                "bp_dia": random.randint(55, 70),
                "spo2": random.randint(90, 96),
                "resp": random.randint(22, 32),
            }
        elif self.strategy == "atrial_fibrillation":
            return {
                "hr": random.randint(90, 160),
                "bp_sys": random.randint(95, 125),
                "bp_dia": random.randint(60, 80),
                "spo2": random.randint(91, 97),
                "resp": random.randint(18, 28),
            }
        elif self.strategy == "ventricular_tachycardia":
            return {
                "hr": random.randint(150, 220),
                "bp_sys": random.randint(70, 95),
                "bp_dia": random.randint(40, 60),
                "spo2": random.randint(82, 92),
                "resp": random.randint(25, 40),
            }
        elif self.strategy == "bradycardia":
            return {
                "hr": random.randint(30, 50),
                "bp_sys": random.randint(85, 105),
                "bp_dia": random.randint(50, 65),
                "spo2": random.randint(92, 98),
                "resp": random.randint(8, 14),
            }
        return self._init_vitals.__wrapped__()  # fallback never reached

    def _init_params(self):
        hr = self._vitals["hr"]
        if self.strategy == "normal_sinus":
            return {"bpm": hr, "qrs_width": random.uniform(0.04, 0.06)}
        elif self.strategy == "sinus_tachycardia":
            return {"bpm": hr, "qrs_width": random.uniform(0.03, 0.05)}
        elif self.strategy == "atrial_fibrillation":
            return {"bpm": hr, "qrs_width": random.uniform(0.04, 0.07), "fib_amp": random.uniform(0.05, 0.15)}
        elif self.strategy == "ventricular_tachycardia":
            return {"bpm": hr, "qrs_width": random.uniform(0.08, 0.14)}
        elif self.strategy == "bradycardia":
            return {"bpm": hr, "qrs_width": random.uniform(0.05, 0.07)}
        return {"bpm": 72, "qrs_width": 0.05}

    def _generate_samples(self):
        samples = []
        p = self._params
        dt = 1.0 / self.SAMPLE_COUNT

        for i in range(self.SAMPLE_COUNT):
            t = self._t + i * dt

            if self.strategy in ("normal_sinus", "sinus_tachycardia", "bradycardia"):
                period = 60.0 / p["bpm"]
                tp = t % period
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

            elif self.strategy == "atrial_fibrillation":
                # Irregular R-R interval — simulate with jittered period
                base_period = 60.0 / p["bpm"]
                jitter = random.uniform(-0.15, 0.15) * base_period
                period = max(0.3, base_period + jitter * 0.1)
                tp = t % period
                v = 0.0
                # Fibrillatory baseline
                v += p["fib_amp"] * math.sin(2 * math.pi * 6 * t + random.uniform(-0.5, 0.5))
                v += p["fib_amp"] * 0.5 * math.sin(2 * math.pi * 9 * t)
                # QRS (narrow but irregular timing)
                if 0.10 < tp < 0.10 + p["qrs_width"]:
                    pos = (tp - 0.10) / p["qrs_width"]
                    if pos < 0.2:
                        v += -0.1
                    elif pos < 0.5:
                        v += 0.9 * math.sin(math.pi * (pos - 0.2) / 0.3)
                    else:
                        v += -0.12 * math.sin(math.pi * (pos - 0.5) / 0.5)

            elif self.strategy == "ventricular_tachycardia":
                period = 60.0 / p["bpm"]
                tp = t % period
                v = 0.0
                # Wide QRS — almost the entire cycle
                qrs_w = p["qrs_width"]
                if tp < qrs_w:
                    pos = tp / qrs_w
                    v = 0.8 * math.sin(math.pi * pos) * math.sin(2 * math.pi * pos * 2)
                else:
                    v = 0.05 * math.sin(2 * math.pi * 3 * tp)

            else:
                v = 0.0

            v += random.gauss(0, self._noise_level)
            samples.append(round(max(-1.2, min(1.2, v)), 4))

        return samples

    def _get_state(self):
        return {
            "ekg_samples": self._generate_samples(),
            "ekg_label": "NORMAL EKG" if self._is_normal else "ABNORMAL EKG",
            "hr": self._vitals["hr"],
            "bp_sys": self._vitals["bp_sys"],
            "bp_dia": self._vitals["bp_dia"],
            "spo2": self._vitals["spo2"],
            "resp": self._vitals["resp"],
            "alarm": not self._is_normal,
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        # Samples regenerated each frame; strip static strategy/label/alarm
        return {
            "_delta": True,
            "ekg_samples": new_state["ekg_samples"],
            "hr": new_state["hr"],
            "bp_sys": new_state["bp_sys"],
            "bp_dia": new_state["bp_dia"],
            "spo2": new_state["spo2"],
            "resp": new_state["resp"],
        }

    def next_frame(self) -> dict:
        self._t += 0.5 + random.uniform(-0.1, 0.1)

        # Slowly drift vitals
        v = self._vitals
        if random.random() > 0.7:
            v["hr"] = max(20, min(250, v["hr"] + random.randint(-2, 2)))
            self._params["bpm"] = v["hr"]
        if random.random() > 0.8:
            v["bp_sys"] = max(60, min(200, v["bp_sys"] + random.randint(-2, 2)))
            v["bp_dia"] = max(30, min(120, v["bp_dia"] + random.randint(-1, 1)))
        if random.random() > 0.85:
            v["spo2"] = max(70, min(100, v["spo2"] + random.choice([-1, 0, 0, 0, 1])))
        if random.random() > 0.85:
            v["resp"] = max(6, min(45, v["resp"] + random.choice([-1, 0, 0, 1])))

        return self._get_state()
