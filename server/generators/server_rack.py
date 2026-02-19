"""Server rack / data center hardware monitor with per-unit status and LEDs."""
import random
from .base import BaseActivity


class ServerRackActivity(BaseActivity):
    activity_type = "server_rack"
    strategies = [
        "cloud_provider",
        "enterprise_dc",
        "colocation",
        "edge_node",
        "supercomputer",
    ]
    titles = [
        "SERVER RACK", "DATA CENTER", "RACK STATUS",
        "COMPUTE CLUSTER", "NODE ARRAY", "SYSTEM RACK",
        "HARDWARE MONITOR",
    ]

    # Per-strategy server name prefixes and formats
    _NAME_TEMPLATES = {
        "cloud_provider": [
            "web-prod-{:02d}", "api-gw-{:02d}", "cache-{:02d}",
            "lb-{:02d}", "msg-q-{:02d}", "worker-{:02d}",
            "cdn-edge-{:02d}", "auth-{:02d}", "search-{:02d}",
        ],
        "enterprise_dc": [
            "DC-APP-{:02d}", "DC-DB-{:02d}", "DC-NAS-{:02d}",
            "DC-WEB-{:02d}", "DC-BKP-{:02d}", "DC-DNS-{:02d}",
            "DC-MTA-{:02d}", "DC-MON-{:02d}", "DC-VPN-{:02d}",
        ],
        "colocation": [
            "CLT-A{}", "CLT-B{}", "CLT-C{}", "CLT-D{}",
            "CLT-E{}", "CLT-F{}", "CLT-G{}", "CLT-H{}",
        ],
        "edge_node": [
            "EDGE-N{}", "EDGE-S{}", "EDGE-E{}", "EDGE-W{}",
            "EDGE-C{}", "EDGE-P{}", "EDGE-R{}", "EDGE-M{}",
        ],
        "supercomputer": [
            "NODE-{:04d}", "GPU-{:04d}", "MEM-{:04d}",
            "IO-{:04d}", "STOR-{:04d}", "CTRL-{:04d}",
        ],
    }

    # Per-strategy role pools
    _ROLE_POOLS = {
        "cloud_provider": ["web", "api", "cache", "database", "storage", "compute", "network"],
        "enterprise_dc":  ["web", "database", "storage", "firewall", "network", "compute", "api"],
        "colocation":     ["compute", "storage", "network", "database", "web", "api", "gpu"],
        "edge_node":      ["compute", "network", "cache", "api", "storage", "gpu"],
        "supercomputer":  ["compute", "gpu", "storage", "network", "database", "cache"],
    }

    # Rack label templates per strategy
    _RACK_LABELS = {
        "cloud_provider": ["RACK-US-EAST-{}", "RACK-EU-WEST-{}", "RACK-AP-SE-{}"],
        "enterprise_dc":  ["DC1-ROW{}-RACK{}", "DC2-ROW{}-RACK{}", "DC3-ROW{}-RACK{}"],
        "colocation":     ["CAGE-{}-RACK-{}", "SUITE-{}-R{}", "POD-{}-R{}"],
        "edge_node":      ["EDGE-POP-{}", "EDGE-SITE-{}", "MICRO-DC-{}"],
        "supercomputer":  ["CLUSTER-{}", "PARTITION-{}", "CABINET-{}"],
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._frame_count = 0
        self._units = self._build_units()
        self._rack_label = self._make_rack_label()
        # Per-unit recovery counters: unit index -> frames remaining
        self._recovery_timers = {}

    def _make_rack_label(self):
        tpl = random.choice(self._RACK_LABELS[self.strategy])
        count = tpl.count("{}")
        args = [random.randint(1, 12) for _ in range(count)]
        return tpl.format(*args)

    def _build_units(self):
        """Generate 10-14 rack units that sum to approximately 42U."""
        target_u = 42
        num_units = random.randint(10, 14)
        name_templates = self._NAME_TEMPLATES[self.strategy]
        roles = self._ROLE_POOLS[self.strategy]

        # Generate sizes that sum to ~42U
        sizes = []
        remaining = target_u
        for i in range(num_units):
            if i == num_units - 1:
                # Last unit gets whatever is left, clamped 1-4
                s = max(1, min(4, remaining))
            else:
                avg_remaining = remaining / (num_units - i)
                s = max(1, min(4, round(avg_remaining + random.uniform(-1.0, 1.0))))
                s = min(s, remaining - (num_units - i - 1))  # leave at least 1U per remaining
                s = max(1, s)
            sizes.append(s)
            remaining -= s

        units = []
        for i in range(num_units):
            tpl = name_templates[i % len(name_templates)]
            name = tpl.format(i + 1)
            role = roles[i % len(roles)]
            cpu_load = random.randint(10, 85)
            fan_speed = max(0, min(100, int(cpu_load * 0.8 + random.randint(-5, 10))))
            num_leds = random.randint(3, 5)
            leds = [{"color": "green", "blink": False} for _ in range(num_leds)]

            units.append({
                "name": name,
                "role": role,
                "size_u": sizes[i],
                "status": "online",
                "cpu_load": cpu_load,
                "leds": leds,
                "fan_speed": fan_speed,
            })

        return units

    def _get_state(self):
        total_load = 0
        count = 0
        for u in self._units:
            if u["status"] in ("online", "degraded"):
                total_load += u["cpu_load"]
                count += 1
        avg_load = round(total_load / max(1, count), 1)

        return {
            "units": [dict(u, leds=list(u["leds"])) for u in self._units],
            "rack_label": self._rack_label,
            "total_load": avg_load,
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        self._frame_count += 1

        for i, unit in enumerate(self._units):
            # Handle recovery timers
            if i in self._recovery_timers:
                self._recovery_timers[i] -= 1
                if self._recovery_timers[i] <= 0:
                    del self._recovery_timers[i]
                    unit["status"] = "online"
                    # Reset LEDs to green
                    for led in unit["leds"]:
                        led["color"] = "green"
                        led["blink"] = False
                elif unit["status"] == "rebooting":
                    # Cycle LEDs during reboot
                    for led in unit["leds"]:
                        led["color"] = random.choice(["green", "amber", "red"])
                        led["blink"] = True
                continue

            # CPU load drift +/-3, clamped 0-100
            drift = random.randint(-3, 3)
            unit["cpu_load"] = max(0, min(100, unit["cpu_load"] + drift))

            # Fan speed tracks CPU loosely
            unit["fan_speed"] = max(0, min(100,
                int(unit["cpu_load"] * 0.8 + random.randint(-5, 10))
            ))

            # Status transitions
            if unit["status"] == "online":
                # 2% chance to go degraded
                if random.random() < 0.02:
                    unit["status"] = "degraded"
                    for led in unit["leds"]:
                        led["color"] = "amber"
                    led_to_blink = random.choice(unit["leds"])
                    led_to_blink["blink"] = True
                    # Recover after 10-30 frames
                    self._recovery_timers[i] = random.randint(10, 30)

                # 0.5% chance to go offline
                elif random.random() < 0.005:
                    unit["status"] = "offline"
                    for led in unit["leds"]:
                        led["color"] = "red"
                        led["blink"] = False
                    # Start reboot after a few frames
                    self._recovery_timers[i] = random.randint(3, 6)

            elif unit["status"] == "offline":
                # Transition to rebooting handled by timer
                if i in self._recovery_timers and self._recovery_timers[i] <= 0:
                    unit["status"] = "rebooting"
                    self._recovery_timers[i] = random.randint(8, 15)

            # Update LEDs for online units
            if unit["status"] == "online":
                for led in unit["leds"]:
                    led["color"] = "green"
                    led["blink"] = False

        return self._get_state()
