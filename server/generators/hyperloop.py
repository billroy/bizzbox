"""Hyperloop dispatch — vacuum tube transit network with pod tracking and tube pressure."""
import random
from .base import BaseActivity


class HyperloopActivity(BaseActivity):
    activity_type = "hyperloop"
    strategies = [
        "intercity_express",
        "cargo_freight",
        "airport_shuttle",
        "underground_metro",
        "transcontinental",
    ]
    titles = [
        "HYPERLOOP", "TUBE DISPATCH", "POD CONTROL",
        "TRANSIT OPS", "LOOP STATUS", "DISPATCH",
    ]

    _STATION_NAMES = {
        "intercity_express": ["DOWNTOWN", "MIDWAY", "UPTOWN", "CENTRAL", "HARBOR", "AIRPORT"],
        "cargo_freight":     ["DEPOT-A", "DEPOT-B", "WAREHOUSE", "PORT", "FACTORY", "HUB"],
        "airport_shuttle":   ["T1", "T2", "T3", "T4", "PARKING", "DOWNTOWN"],
        "underground_metro": ["ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOXTROT"],
        "transcontinental":  ["EAST HUB", "PLAINS", "MOUNTAIN", "DESERT", "COAST", "WEST HUB"],
    }

    _ROUTE_SEGMENTS = {
        "intercity_express": 8,
        "cargo_freight": 6,
        "airport_shuttle": 5,
        "underground_metro": 10,
        "transcontinental": 12,
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._stations = self._STATION_NAMES[self.strategy]
        self._num_segments = self._ROUTE_SEGMENTS[self.strategy]
        self._pods = self._build_pods()
        self._segments = self._build_segments()
        self._junctions = self._build_junctions()

    def _build_pods(self):
        count = random.randint(3, 6)
        pods = []
        for i in range(count):
            seg = random.randint(0, self._num_segments - 1)
            pos_in_seg = round(random.uniform(0.0, 1.0), 3)
            origin = random.choice(self._stations)
            dest = random.choice([s for s in self._stations if s != origin])
            pods.append({
                "id": f"POD-{i+1:03d}",
                "segment": seg,
                "position": pos_in_seg,
                "speed_kph": round(random.uniform(200.0, 1000.0), 1),
                "target_speed_kph": round(random.uniform(600.0, 1200.0), 1),
                "origin": origin,
                "destination": dest,
                "passengers": random.randint(10, 40),
                "status": "in_transit",
                "brake_status": "released",
            })
        return pods

    def _build_segments(self):
        segments = []
        for i in range(self._num_segments):
            segments.append({
                "id": f"SEG-{i+1:02d}",
                "pressure_pa": round(random.uniform(50.0, 200.0), 1),
                "target_pressure_pa": 100.0,
                "status": "nominal",
                "length_km": round(random.uniform(20.0, 120.0), 1),
            })
        return segments

    def _build_junctions(self):
        count = max(2, self._num_segments // 3)
        junctions = []
        for i in range(count):
            junctions.append({
                "id": f"JCT-{i+1}",
                "switch_state": random.choice(["A", "B"]),
                "status": "locked",
            })
        return junctions

    def _get_state(self):
        return {
            "pods": [dict(p) for p in self._pods],
            "segments": [dict(s) for s in self._segments],
            "junctions": [dict(j) for j in self._junctions],
            "stations": self._stations,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        # stations is static; pods/segments/junctions mutate in place
        return {
            "_delta": True,
            "pods": new_state["pods"],
            "segments": new_state["segments"],
            "junctions": new_state["junctions"],
        }

    def next_frame(self) -> dict:
        # Move pods along segments
        for pod in self._pods:
            if pod["status"] == "in_transit":
                # Accelerate toward target speed
                diff = pod["target_speed_kph"] - pod["speed_kph"]
                pod["speed_kph"] = round(max(0.0, min(1200.0,
                    pod["speed_kph"] + diff * 0.02 + random.uniform(-5.0, 5.0))), 1)

                # Advance position
                seg = self._segments[pod["segment"] % len(self._segments)]
                step = pod["speed_kph"] * 0.00002 / max(1.0, seg["length_km"] / 50.0)
                pod["position"] = round(pod["position"] + step, 4)

                # Segment transition
                if pod["position"] >= 1.0:
                    pod["segment"] = (pod["segment"] + 1) % self._num_segments
                    pod["position"] = 0.0
                    # Small chance to arrive
                    if random.random() < 0.15:
                        pod["status"] = "arrived"
                        pod["speed_kph"] = 0.0

            elif pod["status"] == "arrived":
                # Depart after a few frames
                if random.random() < 0.03:
                    pod["status"] = "in_transit"
                    pod["origin"] = pod["destination"]
                    pod["destination"] = random.choice(
                        [s for s in self._stations if s != pod["origin"]])
                    pod["passengers"] = random.randint(10, 40)
                    pod["target_speed_kph"] = round(random.uniform(600.0, 1200.0), 1)

            elif pod["status"] == "emergency_brake":
                pod["speed_kph"] = round(max(0.0, pod["speed_kph"] - 50.0), 1)
                if pod["speed_kph"] == 0.0:
                    pod["status"] = "stopped"
                    pod["brake_status"] = "engaged"

            elif pod["status"] == "stopped":
                if random.random() < 0.02:
                    pod["status"] = "in_transit"
                    pod["brake_status"] = "released"

            # Emergency brake trigger
            if pod["status"] == "in_transit" and random.random() < 0.003:
                pod["status"] = "emergency_brake"
                pod["brake_status"] = "emergency"

        # Segment pressure drift
        for seg in self._segments:
            diff = seg["target_pressure_pa"] - seg["pressure_pa"]
            seg["pressure_pa"] = round(max(10.0, min(500.0,
                seg["pressure_pa"] + diff * 0.05 + random.uniform(-5.0, 5.0))), 1)
            if seg["pressure_pa"] > 300:
                seg["status"] = "pressure_fault"
            elif seg["pressure_pa"] > 200:
                seg["status"] = "warning"
            else:
                seg["status"] = "nominal"

        # Junction switches
        for jct in self._junctions:
            if random.random() < 0.02:
                jct["switch_state"] = "B" if jct["switch_state"] == "A" else "A"
                jct["status"] = "switching"
            elif jct["status"] == "switching" and random.random() < 0.3:
                jct["status"] = "locked"

        return self._get_state()
