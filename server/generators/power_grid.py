"""Power grid / electrical distribution schematic with animated current flow."""
import random
import math
from .base import BaseActivity


class PowerGridActivity(BaseActivity):
    activity_type = "power_grid"
    strategies = [
        "power_plant",
        "data_center_ups",
        "industrial_control",
        "home_automation",
        "spacecraft_eps",
    ]
    titles = [
        "POWER GRID", "EPS MONITOR", "POWER SYSTEMS",
        "GRID STATUS", "ELEC SYSTEMS",
    ]

    # Node type pools per strategy for flavour labels
    _LABELS = {
        "generator":    ["GEN-{}", "DG-{}", "TG-{}", "ALT-{}"],
        "transformer":  ["XFMR-{}", "TX-{}", "TR-{}"],
        "breaker":      ["BRK-{}", "CB-{}", "SW-{}"],
        "load":         ["LD-{}", "LOAD-{}", "MTR-{}", "PNL-{}"],
        "bus":          ["BUS-{}", "SWGR-{}", "MCC-{}"],
    }

    # Strategy-specific reading templates: (key, min, max, unit)
    _READING_TEMPLATES = {
        "power_plant": [
            ("voltage_kv", 10.0, 24.0),
            ("frequency_hz", 59.90, 60.10),
            ("load_pct", 40.0, 95.0),
            ("turbine_temp_c", 380.0, 540.0),
            ("output_mw", 100.0, 800.0),
        ],
        "data_center_ups": [
            ("voltage_v", 208.0, 240.0),
            ("frequency_hz", 59.95, 60.05),
            ("load_pct", 30.0, 85.0),
            ("battery_temp_c", 22.0, 35.0),
            ("battery_pct", 60.0, 100.0),
        ],
        "industrial_control": [
            ("voltage_v", 440.0, 480.0),
            ("frequency_hz", 59.85, 60.15),
            ("load_pct", 50.0, 98.0),
            ("motor_temp_c", 55.0, 105.0),
            ("power_factor", 0.82, 0.99),
        ],
        "home_automation": [
            ("voltage_v", 118.0, 124.0),
            ("frequency_hz", 59.95, 60.05),
            ("load_pct", 10.0, 70.0),
            ("panel_temp_c", 20.0, 40.0),
            ("consumption_kwh", 0.5, 8.0),
        ],
        "spacecraft_eps": [
            ("voltage_v", 24.0, 32.0),
            ("frequency_hz", 399.0, 401.0),
            ("load_pct", 35.0, 90.0),
            ("radiator_temp_c", -40.0, 60.0),
            ("solar_array_w", 800.0, 2400.0),
        ],
    }

    # Schematic topology templates per strategy.
    # Each template is (node_types, edge_pairs) where edge_pairs index into
    # node_types.  Templates are sized 6-12 nodes.
    _TOPOLOGIES = {
        "power_plant": {
            "types": [
                "generator", "bus", "transformer", "breaker",
                "bus", "breaker", "load", "load",
                "transformer", "breaker", "load", "generator",
            ],
            "edges": [
                (0, 1), (1, 2), (2, 3), (3, 4),
                (4, 5), (5, 6), (4, 9), (9, 10),
                (1, 8), (8, 7), (11, 1),
            ],
        },
        "data_center_ups": {
            "types": [
                "generator", "breaker", "bus", "transformer",
                "breaker", "bus", "load", "load",
                "load", "generator",
            ],
            "edges": [
                (0, 1), (1, 2), (2, 3), (3, 4),
                (4, 5), (5, 6), (5, 7), (5, 8),
                (9, 2),
            ],
        },
        "industrial_control": {
            "types": [
                "transformer", "breaker", "bus", "breaker",
                "load", "breaker", "load", "breaker",
                "load",
            ],
            "edges": [
                (0, 1), (1, 2), (2, 3), (3, 4),
                (2, 5), (5, 6), (2, 7), (7, 8),
            ],
        },
        "home_automation": {
            "types": [
                "transformer", "breaker", "bus",
                "breaker", "load", "breaker", "load",
            ],
            "edges": [
                (0, 1), (1, 2), (2, 3), (3, 4),
                (2, 5), (5, 6),
            ],
        },
        "spacecraft_eps": {
            "types": [
                "generator", "bus", "breaker", "transformer",
                "bus", "breaker", "load", "breaker",
                "load", "load", "generator",
            ],
            "edges": [
                (0, 1), (1, 2), (2, 3), (3, 4),
                (4, 5), (5, 6), (4, 7), (7, 8),
                (4, 9), (10, 1),
            ],
        },
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._flow_offset = random.uniform(0.0, 100.0)
        self._nodes = self._build_nodes()
        self._edges = self._build_edges()
        self._readings = self._init_readings()

    # ------------------------------------------------------------------
    # Node construction
    # ------------------------------------------------------------------

    def _build_nodes(self):
        topo = self._TOPOLOGIES[self.strategy]
        node_types = topo["types"]
        n = len(node_types)
        nodes = []

        # Lay nodes out in a schematic grid pattern.
        # Arrange in rows: first pass computes a layered left-to-right layout
        # by walking the edge list with BFS-like layering.
        edge_list = topo["edges"]
        layer_of = [None] * n
        layer_of[0] = 0
        changed = True
        while changed:
            changed = False
            for a, b in edge_list:
                if layer_of[a] is not None and layer_of[b] is None:
                    layer_of[b] = layer_of[a] + 1
                    changed = True
                elif layer_of[b] is not None and layer_of[a] is None:
                    layer_of[a] = layer_of[b] - 1
                    changed = True
        # Fallback for any disconnected nodes
        for i in range(n):
            if layer_of[i] is None:
                layer_of[i] = 0

        max_layer = max(layer_of)
        min_layer = min(layer_of)
        layer_span = max(max_layer - min_layer, 1)

        # Group nodes by layer to assign vertical positions
        layers = {}
        for i, l in enumerate(layer_of):
            layers.setdefault(l, []).append(i)

        # Counters for generating unique short labels per type
        type_counters = {}

        for i, ntype in enumerate(node_types):
            l = layer_of[i]
            members = layers[l]
            row_idx = members.index(i)
            row_count = len(members)

            # x: spread across 0.1 .. 0.9 by layer
            x = 0.1 + 0.8 * ((l - min_layer) / layer_span)
            # y: spread members within a layer across 0.15 .. 0.85
            if row_count == 1:
                y = 0.5
            else:
                y = 0.15 + 0.7 * (row_idx / (row_count - 1))

            # Small deterministic jitter so overlapping layers look natural
            x += 0.02 * math.sin(i * 2.7)
            y += 0.02 * math.cos(i * 3.1)
            x = round(max(0.0, min(1.0, x)), 4)
            y = round(max(0.0, min(1.0, y)), 4)

            # Label
            type_counters.setdefault(ntype, 0)
            type_counters[ntype] += 1
            label_tpl = random.choice(self._LABELS[ntype])
            label = label_tpl.format(type_counters[ntype])

            nodes.append({
                "id": f"n{i}",
                "type": ntype,
                "label": label,
                "x": x,
                "y": y,
                "status": "online",
            })

        return nodes

    # ------------------------------------------------------------------
    # Edge construction
    # ------------------------------------------------------------------

    def _build_edges(self):
        topo = self._TOPOLOGIES[self.strategy]
        edges = []
        for a, b in topo["edges"]:
            flow = round(random.uniform(5.0, 120.0), 1)
            edges.append({
                "from_id": f"n{a}",
                "to_id": f"n{b}",
                "flow": flow,
            })
        return edges

    # ------------------------------------------------------------------
    # Readings
    # ------------------------------------------------------------------

    def _init_readings(self):
        readings = {}
        for key, lo, hi in self._READING_TEMPLATES[self.strategy]:
            readings[key] = round(random.uniform(lo, hi), 2)
        return readings

    def _drift_readings(self):
        for key, lo, hi in self._READING_TEMPLATES[self.strategy]:
            span = hi - lo
            step = span * 0.02 * random.uniform(-1.0, 1.0)
            val = self._readings[key] + step
            val = max(lo, min(hi, val))
            self._readings[key] = round(val, 2)

    # ------------------------------------------------------------------
    # State serialisation
    # ------------------------------------------------------------------

    def _get_state(self):
        return {
            "nodes": [dict(n) for n in self._nodes],
            "edges": [dict(e) for e in self._edges],
            "readings": dict(self._readings),
            "flow_offset": round(self._flow_offset, 4),
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    # ------------------------------------------------------------------
    # Frame advance
    # ------------------------------------------------------------------

    def next_frame(self) -> dict:
        # Advance animated flow offset
        self._flow_offset += 0.08 + 0.02 * self.intensity

        # Drift readings
        self._drift_readings()

        # Drift edge flow values slightly
        for edge in self._edges:
            edge["flow"] = round(
                max(0.0, edge["flow"] + random.uniform(-2.0, 2.0)), 1
            )

        # Occasionally toggle a node status (~5% chance scaled by intensity)
        fault_chance = 0.05 * (self.intensity / 10.0)
        for node in self._nodes:
            if random.random() < fault_chance:
                if node["status"] == "online":
                    node["status"] = "fault"
                elif node["status"] == "fault":
                    node["status"] = "online"
                # offline stays offline (manual recovery only)

        return self._get_state()
