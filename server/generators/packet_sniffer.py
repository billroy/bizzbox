"""Network packet sniffer generator — live capture feed with threat classification."""
import random
import math
from datetime import datetime, timezone
from .base import BaseActivity


class PacketSnifferActivity(BaseActivity):
    activity_type = "packet_sniffer"
    strategies = [
        "perimeter_firewall",
        "honeypot_monitor",
        "tor_exit_node",
        "voip_intercept",
        "scada_traffic",
    ]
    titles = [
        "PACKET CAPTURE",
        "NETWORK INTERCEPT",
        "TRAFFIC ANALYZER",
        "DEEP PACKET INSPECTION",
        "INTRUSION DETECTION",
        "NETWORK FORENSICS",
        "WIRE ANALYSIS",
    ]

    BUFFER_SIZE = 20
    FRAME_TICK = 0  # incremented per frame for timestamp offset

    # Protocol weights per strategy: {protocol: weight}
    PROTO_WEIGHTS = {
        "perimeter_firewall": {
            "TCP": 35, "UDP": 20, "ICMP": 10, "DNS": 15, "TLS": 15, "HTTP": 5,
        },
        "honeypot_monitor": {
            "TCP": 30, "UDP": 10, "ICMP": 20, "HTTP": 15, "TLS": 10, "DNS": 15,
        },
        "tor_exit_node": {
            "TLS": 50, "TCP": 25, "UDP": 10, "DNS": 10, "HTTP": 5, "ICMP": 0,
        },
        "voip_intercept": {
            "UDP": 50, "TCP": 10, "TLS": 15, "DNS": 10, "HTTP": 5, "ICMP": 0,
            "MODBUS": 0,
        },
        "scada_traffic": {
            "MODBUS": 35, "TCP": 25, "UDP": 15, "ICMP": 10, "DNS": 10, "TLS": 5,
        },
    }

    # Threat probability weights per strategy: {level: weight}
    THREAT_WEIGHTS = {
        "perimeter_firewall": {"none": 60, "low": 20, "medium": 12, "high": 6, "critical": 2},
        "honeypot_monitor":   {"none": 25, "low": 25, "medium": 25, "high": 15, "critical": 10},
        "tor_exit_node":      {"none": 40, "low": 25, "medium": 20, "high": 10, "critical": 5},
        "voip_intercept":     {"none": 70, "low": 15, "medium": 10, "high": 4, "critical": 1},
        "scada_traffic":      {"none": 50, "low": 20, "medium": 15, "high": 10, "critical": 5},
    }

    # Common ports for each protocol
    PROTO_PORTS = {
        "TCP":    [22, 23, 25, 80, 443, 445, 3389, 8080, 8443, 1433, 3306, 5432],
        "UDP":    [53, 67, 68, 123, 161, 500, 4500, 5060, 5061],
        "ICMP":   [0],
        "DNS":    [53],
        "HTTP":   [80, 8080, 8888],
        "TLS":    [443, 8443, 993, 465, 636],
        "MODBUS": [502, 503],
    }

    # TCP flag combos weighted
    TCP_FLAGS = ["SYN", "ACK", "SYN ACK", "FIN ACK", "RST", "PSH ACK", "FIN", "RST ACK"]
    TCP_FLAG_WEIGHTS = [15, 30, 15, 10, 8, 12, 5, 5]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._packets = []
        self._second = 0
        self._millisecond = 0
        self._rate_pps = random.randint(80, 600)
        self._bytes_sec = random.randint(10000, 500000)
        self._frame_count = 0
        # Pre-fill buffer
        for _ in range(self.BUFFER_SIZE):
            self._packets.append(self._make_packet())

    # --- IP helpers ---

    def _private_ip(self):
        choice = random.randint(0, 2)
        if choice == 0:
            return f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"
        elif choice == 1:
            return f"172.{random.randint(16,31)}.{random.randint(0,255)}.{random.randint(1,254)}"
        else:
            return f"192.168.{random.randint(0,255)}.{random.randint(1,254)}"

    def _public_ip(self):
        # Avoid RFC1918 / special ranges naively
        first = random.choice([
            random.randint(1, 9),
            random.randint(11, 126),
            random.randint(128, 169),
            random.randint(171, 172),
            random.randint(173, 191),
            random.randint(193, 223),
        ])
        return f"{first}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"

    def _pick_src_dst(self):
        strategy = self.strategy
        # Honeypot: many inbound external connections
        if strategy == "honeypot_monitor":
            return self._public_ip(), self._private_ip()
        # SCADA: mostly internal
        elif strategy == "scada_traffic":
            return self._private_ip(), self._private_ip()
        # TOR exit: outbound public
        elif strategy == "tor_exit_node":
            if random.random() < 0.6:
                return self._private_ip(), self._public_ip()
            return self._public_ip(), self._private_ip()
        # Perimeter: mixed
        elif strategy == "perimeter_firewall":
            if random.random() < 0.5:
                return self._public_ip(), self._private_ip()
            return self._private_ip(), self._public_ip()
        # VoIP: internal to internal or external gateways
        else:
            if random.random() < 0.7:
                return self._private_ip(), self._private_ip()
            return self._private_ip(), self._public_ip()

    def _pick_protocol(self):
        weights_dict = self.PROTO_WEIGHTS[self.strategy]
        protos = [p for p, w in weights_dict.items() if w > 0]
        weights = [weights_dict[p] for p in protos]
        return random.choices(protos, weights=weights, k=1)[0]

    def _pick_threat(self):
        tw = self.THREAT_WEIGHTS[self.strategy]
        levels = list(tw.keys())
        weights = list(tw.values())
        return random.choices(levels, weights=weights, k=1)[0]

    def _make_timestamp(self):
        self._millisecond += random.randint(1, 40)
        if self._millisecond >= 1000:
            self._millisecond -= 1000
            self._second += 1
        h = (self._second // 3600) % 24
        m = (self._second % 3600) // 60
        s = self._second % 60
        return f"{h:02d}:{m:02d}:{s:02d}.{self._millisecond:03d}"

    def _make_packet(self):
        proto = self._pick_protocol()
        src, dst = self._pick_src_dst()
        port = random.choice(self.PROTO_PORTS.get(proto, [0]))
        size = random.randint(40, 1480)
        if proto in ("TLS", "HTTP"):
            size = random.randint(100, 1480)
        elif proto == "ICMP":
            size = random.randint(28, 84)
        elif proto == "DNS":
            size = random.randint(50, 512)
        elif proto == "MODBUS":
            size = random.randint(8, 260)

        if proto in ("TCP", "TLS", "HTTP"):
            flags = random.choices(self.TCP_FLAGS, weights=self.TCP_FLAG_WEIGHTS, k=1)[0]
        else:
            flags = ""

        return {
            "timestamp": self._make_timestamp(),
            "src_ip":    src,
            "dst_ip":    dst,
            "protocol":  proto,
            "port":      port,
            "size_bytes": size,
            "flags":     flags,
            "threat":    self._pick_threat(),
        }

    def _get_state(self):
        return {
            "packets":   list(self._packets),
            "rate_pps":  self._rate_pps,
            "bytes_sec": self._bytes_sec,
            "strategy":  self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        self._frame_count += 1
        # Add 1-3 new packets, drop oldest to keep buffer at BUFFER_SIZE
        new_count = random.randint(1, 3)
        for _ in range(new_count):
            self._packets.append(self._make_packet())
        self._packets = self._packets[-self.BUFFER_SIZE:]

        # Drift rate metrics
        self._rate_pps += random.randint(-15, 15)
        self._rate_pps = max(10, min(5000, self._rate_pps))
        self._bytes_sec += random.randint(-5000, 5000)
        self._bytes_sec = max(1000, min(10_000_000, self._bytes_sec))

        # Spike traffic occasionally
        if random.random() < 0.05:
            self._rate_pps = int(self._rate_pps * random.uniform(2.0, 5.0))
            self._bytes_sec = int(self._bytes_sec * random.uniform(2.0, 5.0))

        return self._get_state()
