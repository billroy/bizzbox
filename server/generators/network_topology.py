"""Network topology diagram generator — animated nodes and edges."""
import random
import math
from .base import BaseActivity


class NetworkTopologyActivity(BaseActivity):
    activity_type = "network_topology"
    strategies = ["corporate_lan", "dark_net", "biological_neural", "microservices", "power_grid"]
    titles = [
        "NETWORK TOPOLOGY", "MESH ANALYSIS", "NODE MAP",
        "INFRASTRUCTURE DIAGRAM", "ROUTING TABLE VISUAL",
        "LINK STATE MAP", "ADJACENCY GRAPH",
    ]

    CORPORATE_NODES = [
        "GATEWAY-1", "SWITCH-A", "SWITCH-B", "SWITCH-C",
        "WEB-01", "WEB-02", "DB-PRIMARY", "DB-REPLICA",
        "FIREWALL", "LOAD-BALANCER", "STORAGE-01", "BACKUP",
    ]
    DARKNET_NODES = [
        "NODE-7743", "RELAY-9921", "EXIT-0042", "GUARD-1188",
        "HIDDEN-SVC", "NODE-3301", "RELAY-5550", "ANON-BRIDGE",
        "TOR-EXIT-7", "ONION-GATE", "CIPHER-NODE", "SHADOW-4492",
    ]
    NEURON_NODES = [
        "N-CORTEX-A4", "N-LIMBIC-B2", "SYNAPSE-01", "N-STEM-C1",
        "N-FRONTAL-D3", "RECEPTOR-α", "N-BASAL-E1", "AXON-TERM-7",
        "N-HIPPO-F2", "DENDRITE-22", "N-THALAMUS", "MYELIN-9A",
    ]
    MICROSERVICE_NODES = [
        "api-gateway", "auth-svc", "user-svc", "order-svc",
        "payment-svc", "redis-cache", "postgres-db", "kafka-broker",
        "cdn-edge", "search-svc", "notify-svc", "metrics-svc",
    ]
    POWER_NODES = [
        "SUBSTATION-A", "TRANSFORMER-1", "GRID-NODE-7", "PLANT-MAIN",
        "DIST-LINE-3", "FEEDER-B2", "LOAD-CENTER", "UPS-ARRAY",
        "SOLAR-FARM", "WIND-ARRAY", "BREAKER-14", "RELAY-CTRL",
    ]

    def _make_nodes(self, labels):
        nodes = []
        count = random.randint(7, min(12, len(labels)))
        chosen = random.sample(labels, count)
        for i, label in enumerate(chosen):
            angle = (2 * math.pi * i) / count + random.uniform(-0.3, 0.3)
            r = random.uniform(0.25, 0.45)
            nodes.append({
                "id": i,
                "x": round(0.5 + r * math.cos(angle), 3),
                "y": round(0.5 + r * math.sin(angle), 3),
                "label": label,
                "active": random.random() > 0.2,
                "highlight": False,
            })
        return nodes

    def _make_edges(self, nodes):
        edges = []
        n = len(nodes)
        # Ensure connected: ring + random extras
        for i in range(n):
            j = (i + 1) % n
            edges.append({
                "id": len(edges),
                "from": nodes[i]["id"],
                "to": nodes[j]["id"],
                "active": random.random() > 0.3,
                "weight": round(random.uniform(0.1, 1.0), 2),
                "pulse": False,
            })
        # Random cross-edges
        for _ in range(random.randint(2, 5)):
            a, b = random.sample(range(n), 2)
            if not any(e["from"] == a and e["to"] == b for e in edges):
                edges.append({
                    "id": len(edges),
                    "from": nodes[a]["id"],
                    "to": nodes[b]["id"],
                    "active": random.random() > 0.3,
                    "weight": round(random.uniform(0.1, 1.0), 2),
                    "pulse": False,
                })
        return edges

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        label_map = {
            "corporate_lan": self.CORPORATE_NODES,
            "dark_net": self.DARKNET_NODES,
            "biological_neural": self.NEURON_NODES,
            "microservices": self.MICROSERVICE_NODES,
            "power_grid": self.POWER_NODES,
        }
        self._nodes = self._make_nodes(label_map[self.strategy])
        self._edges = self._make_edges(self._nodes)
        self._tick = 0

    def _get_state(self):
        return {
            "nodes": self._nodes,
            "edges": self._edges,
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        self._tick += 1
        # Randomly activate/deactivate 1-3 edges
        for _ in range(random.randint(1, 3)):
            e = random.choice(self._edges)
            e["active"] = random.random() > 0.3
            e["pulse"] = random.random() > 0.7
            e["weight"] = round(random.uniform(0.1, 1.0), 2)
        # Occasionally toggle a node
        if random.random() > 0.6:
            n = random.choice(self._nodes)
            n["active"] = random.random() > 0.15
            n["highlight"] = random.random() > 0.8
        # Slight position drift
        if random.random() > 0.8:
            n = random.choice(self._nodes)
            n["x"] = round(max(0.05, min(0.95, n["x"] + random.uniform(-0.03, 0.03))), 3)
            n["y"] = round(max(0.05, min(0.95, n["y"] + random.uniform(-0.03, 0.03))), 3)
        return self._get_state()
