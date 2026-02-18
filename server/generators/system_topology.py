"""Server rack / system topology with blinking status lights."""
import random
from .base import BaseActivity

# Component types per strategy
_COMPONENT_POOLS = {
    "data_center_rack": [
        ("BLADE-SVR", "server"), ("BLADE-SVR", "server"), ("BLADE-SVR", "server"),
        ("STORAGE", "storage"), ("STORAGE", "storage"),
        ("SWITCH", "network"), ("ROUTER", "network"),
        ("UPS", "power"), ("PDU", "power"),
        ("KVM", "mgmt"), ("CONSOLE", "mgmt"),
    ],
    "network_closet": [
        ("SWITCH-48P", "network"), ("SWITCH-24P", "network"),
        ("PATCH-PANEL", "passive"), ("PATCH-PANEL", "passive"),
        ("ROUTER", "network"), ("FIREWALL", "security"),
        ("UPS", "power"), ("MODEM", "network"),
        ("ACCESS-PT", "network"), ("CABLE-MGMT", "passive"),
    ],
    "mission_control": [
        ("COMM-LINK", "comms"), ("TELEMETRY", "sensor"),
        ("TRACKING", "sensor"), ("GUIDANCE", "compute"),
        ("FLIGHT-CTRL", "compute"), ("POWER-SYS", "power"),
        ("LIFE-SUPPORT", "env"), ("DATA-RELAY", "comms"),
        ("BACKUP-SYS", "compute"), ("ALERT-PANEL", "mgmt"),
    ],
    "telecom_exchange": [
        ("DSLAM", "network"), ("DSLAM", "network"),
        ("OLT", "network"), ("SWITCH", "network"),
        ("MUX", "network"), ("DEMUX", "network"),
        ("POWER-SHELF", "power"), ("ALARM-UNIT", "mgmt"),
        ("TEST-SET", "mgmt"), ("FIBER-PATCH", "passive"),
    ],
    "lab_equipment": [
        ("OSCILLOSCOPE", "instrument"), ("SPECTRUM-ANLZ", "instrument"),
        ("SIGNAL-GEN", "instrument"), ("POWER-SUPPLY", "power"),
        ("LOGIC-ANLZ", "instrument"), ("DMM", "instrument"),
        ("PROTOCOL-ANLZ", "instrument"), ("THERMAL-CAM", "sensor"),
        ("DAQ-UNIT", "sensor"), ("PC-CTRL", "compute"),
    ],
}

_STATUSES = ["ok", "ok", "ok", "ok", "warn", "error", "offline"]
_N_COMPONENTS = 8


def _make_component(pool: list) -> dict:
    name, category = random.choice(pool)
    unit_id = random.randint(1, 99)
    return {
        "name": f"{name}-{unit_id:02d}",
        "category": category,
        "status": random.choice(_STATUSES),
        "load": round(random.uniform(0, 1), 2),
        "lights": [random.choice(["green", "green", "amber", "red", "off"]) for _ in range(4)],
        "data_flow": round(random.uniform(0, 1), 2),
    }


class SystemTopologyActivity(BaseActivity):
    activity_type = "system_topology"
    strategies = list(_COMPONENT_POOLS.keys())
    titles = ["SYS TOPOLOGY", "RACK STATUS", "EQUIPMENT", "INFRA MONITOR", "RACK DIAGRAM"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        pool = _COMPONENT_POOLS[self.strategy]
        self._components = [_make_component(pool) for _ in range(_N_COMPONENTS)]

    def _get_state(self) -> dict:
        return {
            "components": [
                {
                    "name": c["name"],
                    "category": c["category"],
                    "status": c["status"],
                    "load": c["load"],
                    "lights": list(c["lights"]),
                    "data_flow": c["data_flow"],
                }
                for c in self._components
            ],
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        for comp in self._components:
            # Blink lights
            for i in range(len(comp["lights"])):
                if random.random() < 0.15:
                    if comp["status"] == "error":
                        comp["lights"][i] = random.choice(["red", "off", "red"])
                    elif comp["status"] == "warn":
                        comp["lights"][i] = random.choice(["amber", "green", "amber"])
                    elif comp["status"] == "ok":
                        comp["lights"][i] = random.choice(["green", "green", "green", "off"])
                    else:
                        comp["lights"][i] = "off"

            # Update load
            comp["load"] = round(max(0, min(1, comp["load"] + random.gauss(0, 0.05))), 2)
            comp["data_flow"] = round(max(0, min(1, random.uniform(0, 1))), 2)

            # Occasional status changes
            if random.random() < 0.02:
                comp["status"] = random.choice(_STATUSES)

        return self._get_state()
