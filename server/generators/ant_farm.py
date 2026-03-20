"""Ant Farm activity — cross-section view of ants navigating tunnel networks."""
import random
import math
import uuid
from .base import BaseActivity


class AntFarmActivity(BaseActivity):
    activity_type = "ant_farm"
    update_interval_override = 0.15  # ~7 fps — ants move discretely
    strategies = [
        "sandy_farm", "forest_floor", "desert_colony",
        "crystal_caves", "volcanic_soil",
    ]
    titles = [
        "ANT FARM", "COLONY VIEW", "FORMICARIUM",
        "ANT COLONY", "TUNNEL NETWORK",
    ]

    TUNNEL_DENSITY = {
        "sandy_farm":     (18, 28),
        "forest_floor":   (22, 32),
        "desert_colony":  (12, 20),
        "crystal_caves":  (16, 24),
        "volcanic_soil":  (15, 22),
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._frame = 0
        self._nodes, self._segments = self._generate_tunnels()
        self._adjacency = self._build_adjacency()
        count = random.randint(8, 12)
        self._ants = [self._spawn_ant() for _ in range(count)]
        # Place a queen in the brood chamber
        brood = next((n for n in self._nodes if n["type"] == "brood"), None)
        if brood:
            queen = self._spawn_ant()
            queen["type"] = "queen"
            queen["size"] = round(random.uniform(1.3, 1.6), 2)
            queen["speed"] = round(queen["speed"] * 0.3, 4)
            connected = self._adjacency.get(brood["id"], [])
            if connected:
                queen["segment_idx"] = connected[0]
                queen["t"] = 0.5
            self._ants.append(queen)

    def _generate_tunnels(self):
        nodes = []
        segments = []
        nid = 0

        # Entrances at top
        num_entrances = random.randint(1, 2)
        entrance_ids = []
        for i in range(num_entrances):
            x = random.uniform(0.25, 0.75) if num_entrances == 1 else (0.25 + i * 0.5)
            nodes.append({"id": nid, "x": round(x, 3), "y": 0.08, "type": "entrance"})
            entrance_ids.append(nid)
            nid += 1

        density = self.TUNNEL_DENSITY[self.strategy]
        target_nodes = random.randint(density[0], density[1])

        # BFS-style expansion from entrances
        frontier = list(entrance_ids)
        while len(nodes) < target_nodes and frontier:
            parent_id = frontier.pop(0)
            parent = nodes[parent_id]
            branches = random.randint(1, 3)
            for _ in range(branches):
                if len(nodes) >= target_nodes:
                    break
                dx = random.uniform(-0.18, 0.18)
                dy = random.uniform(0.06, 0.18)
                nx = max(0.04, min(0.96, parent["x"] + dx))
                ny = max(0.12, min(0.94, parent["y"] + dy))

                too_close = False
                for existing in nodes:
                    dist = math.hypot(nx - existing["x"], ny - existing["y"])
                    if dist < 0.055:
                        too_close = True
                        break
                if too_close:
                    continue

                if ny > 0.7 and random.random() < 0.35:
                    ntype = "chamber"
                elif random.random() < 0.15:
                    ntype = "chamber"
                else:
                    ntype = "junction"

                nodes.append({
                    "id": nid,
                    "x": round(nx, 3),
                    "y": round(ny, 3),
                    "type": ntype,
                })
                segments.append({"from": parent_id, "to": nid})
                frontier.append(nid)
                nid += 1

        # Add 2-3 cross-connections for loops
        for _ in range(random.randint(2, 4)):
            if len(nodes) < 4:
                break
            a = random.randint(0, len(nodes) - 1)
            b = random.randint(0, len(nodes) - 1)
            if a == b:
                continue
            existing_segs = {(s["from"], s["to"]) for s in segments}
            existing_segs |= {(s["to"], s["from"]) for s in segments}
            if (a, b) in existing_segs:
                continue
            dist = math.hypot(nodes[a]["x"] - nodes[b]["x"],
                              nodes[a]["y"] - nodes[b]["y"])
            if dist < 0.28:
                segments.append({"from": a, "to": b})

        # --- Ensure 1-3 tunnel ends touch each wall (left, right, bottom) ---
        self._add_wall_tunnels(nodes, segments, nid)
        nid = len(nodes)  # update after wall tunnels

        # --- Ensure one big brood chamber ---
        self._add_brood_chamber(nodes, segments, nid)

        return nodes, segments

    def _add_wall_tunnels(self, nodes, segments, nid):
        """Add tunnel endpoints that touch the left, right, and bottom walls."""
        existing_segs = {(s["from"], s["to"]) for s in segments}
        existing_segs |= {(s["to"], s["from"]) for s in segments}

        walls = {
            "left":   {"x_target": 0.02, "x_range": (0.02, 0.08), "y_range": (0.2, 0.85)},
            "right":  {"x_target": 0.98, "x_range": (0.92, 0.98), "y_range": (0.2, 0.85)},
            "bottom": {"x_range": (0.15, 0.85), "y_target": 0.96, "y_range": (0.90, 0.96)},
        }

        for wall_name, wall in walls.items():
            # Count existing nodes near this wall
            near_wall = []
            for n in nodes:
                if wall_name == "left" and n["x"] < 0.1:
                    near_wall.append(n)
                elif wall_name == "right" and n["x"] > 0.9:
                    near_wall.append(n)
                elif wall_name == "bottom" and n["y"] > 0.88:
                    near_wall.append(n)

            needed = random.randint(1, 3) - len(near_wall)
            for _ in range(max(0, needed)):
                if wall_name in ("left", "right"):
                    wx = wall["x_target"]
                    wy = round(random.uniform(*wall["y_range"]), 3)
                else:
                    wx = round(random.uniform(*wall["x_range"]), 3)
                    wy = wall["y_target"]

                # Find closest existing node to connect to
                best = None
                best_dist = 999
                for n in nodes:
                    d = math.hypot(n["x"] - wx, n["y"] - wy)
                    if d < best_dist and d > 0.04:
                        best_dist = d
                        best = n
                if best:
                    if best_dist > 0.4:
                        # Add intermediate junction node to bridge the gap
                        mid_x = round((best["x"] + wx) / 2, 3)
                        mid_y = round((best["y"] + wy) / 2, 3)
                        mid_id = len(nodes)
                        nodes.append({
                            "id": mid_id,
                            "x": mid_x,
                            "y": mid_y,
                            "type": "junction",
                        })
                        pair1 = (best["id"], mid_id)
                        if pair1 not in existing_segs:
                            segments.append({"from": best["id"], "to": mid_id})
                            existing_segs.add(pair1)
                            existing_segs.add((mid_id, best["id"]))
                        best = nodes[mid_id]

                    new_id = len(nodes)
                    nodes.append({
                        "id": new_id,
                        "x": round(wx, 3),
                        "y": round(wy, 3),
                        "type": "junction",
                    })
                    pair = (best["id"], new_id)
                    if pair not in existing_segs and (new_id, best["id"]) not in existing_segs:
                        segments.append({"from": best["id"], "to": new_id})
                        existing_segs.add(pair)
                        existing_segs.add((new_id, best["id"]))

    def _add_brood_chamber(self, nodes, segments, nid):
        """Ensure there is one large brood chamber in the lower-center area."""
        # Check if a brood chamber already exists
        for n in nodes:
            if n["type"] == "brood":
                return

        # Place brood chamber in lower-center
        bx = round(random.uniform(0.3, 0.7), 3)
        by = round(random.uniform(0.65, 0.85), 3)

        # Don't place too close to existing nodes
        for n in nodes:
            if math.hypot(n["x"] - bx, n["y"] - by) < 0.08:
                by = min(0.9, by + 0.1)

        brood_id = len(nodes)
        nodes.append({
            "id": brood_id,
            "x": bx,
            "y": by,
            "type": "brood",
        })

        # Connect to 2-3 nearest non-entrance nodes
        dists = []
        for n in nodes:
            if n["id"] == brood_id or n["type"] == "entrance":
                continue
            d = math.hypot(n["x"] - bx, n["y"] - by)
            dists.append((d, n))
        dists.sort(key=lambda x: x[0])

        existing_segs = {(s["from"], s["to"]) for s in segments}
        existing_segs |= {(s["to"], s["from"]) for s in segments}
        connected = 0
        for d, n in dists[:4]:
            if connected >= random.randint(2, 3):
                break
            pair = (n["id"], brood_id)
            if pair not in existing_segs:
                segments.append({"from": n["id"], "to": brood_id})
                existing_segs.add(pair)
                existing_segs.add((brood_id, n["id"]))
                connected += 1

    def _build_adjacency(self):
        """Build node_id -> list of segment indices."""
        adj = {}
        for i, seg in enumerate(self._segments):
            adj.setdefault(seg["from"], []).append(i)
            adj.setdefault(seg["to"], []).append(i)
        return adj

    def _spawn_ant(self):
        seg_idx = random.randint(0, max(0, len(self._segments) - 1))
        is_soldier = random.random() < 0.15
        return {
            "id": uuid.uuid4().hex[:6],
            "segment_idx": seg_idx,
            "t": round(random.uniform(0.1, 0.9), 3),
            "direction": random.choice([1, -1]),
            "speed": round(random.uniform(0.03, 0.07), 4),
            "carrying": None,
            "size": round(random.uniform(0.8, 1.2) if not is_soldier else random.uniform(1.1, 1.4), 2),
            "type": "soldier" if is_soldier else "worker",
        }

    def _move_ants(self):
        self._frame += 1
        to_remove = []
        for ant in self._ants:
            if ant["type"] == "queen":
                if random.random() < 0.1:
                    ant["t"] += ant["speed"] * ant["direction"] * 0.3
                    ant["t"] = round(max(0.2, min(0.8, ant["t"])), 3)
                continue

            ant["t"] += ant["speed"] * ant["direction"]
            ant["t"] = round(ant["t"], 4)

            if ant["t"] > 1.0 or ant["t"] < 0.0:
                seg = self._segments[ant["segment_idx"]]
                node_id = seg["to"] if ant["direction"] == 1 else seg["from"]
                node = self._nodes[node_id] if node_id < len(self._nodes) else None

                if node and node["type"] == "entrance" and random.random() < 0.3:
                    to_remove.append(ant)
                    continue

                if node and node["type"] in ("chamber", "brood"):
                    if random.random() < 0.15:
                        if ant["carrying"]:
                            ant["carrying"] = None
                        else:
                            ant["carrying"] = random.choice(["food", "dirt", "egg"])

                connected = self._adjacency.get(node_id, [])
                candidates = [s for s in connected if s != ant["segment_idx"]]
                if not candidates:
                    candidates = connected
                if not candidates:
                    ant["direction"] *= -1
                    ant["t"] = max(0.0, min(1.0, ant["t"]))
                    continue

                next_seg = random.choice(candidates)
                ant["segment_idx"] = next_seg
                new_seg = self._segments[next_seg]
                if new_seg["from"] == node_id:
                    ant["direction"] = 1
                    ant["t"] = 0.0
                else:
                    ant["direction"] = -1
                    ant["t"] = 1.0

        for ant in to_remove:
            if ant in self._ants:
                self._ants.remove(ant)

        while len(self._ants) < 8:
            new_ant = self._spawn_ant()
            entrance_nodes = [n for n in self._nodes if n["type"] == "entrance"]
            if entrance_nodes:
                en = random.choice(entrance_nodes)
                connected = self._adjacency.get(en["id"], [])
                if connected:
                    new_ant["segment_idx"] = connected[0]
                    new_ant["t"] = 0.0
                    seg = self._segments[connected[0]]
                    new_ant["direction"] = 1 if seg["from"] == en["id"] else -1
            self._ants.append(new_ant)

    def _serialize_ants(self):
        return [
            {
                "id": a["id"],
                "segment_idx": a["segment_idx"],
                "t": a["t"],
                "direction": a["direction"],
                "speed": a["speed"],
                "carrying": a["carrying"],
                "size": a["size"],
                "type": a["type"],
            }
            for a in self._ants
        ]

    def _get_state(self):
        return {
            "nodes": self._nodes,
            "segments": self._segments,
            "ants": self._serialize_ants(),
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        return {
            "_delta": True,
            "ants": new_state["ants"],
        }

    def next_frame(self) -> dict:
        self._move_ants()
        return self._get_state()
