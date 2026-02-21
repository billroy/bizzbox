"""3D wireframe geometry viewer with rotating mesh models."""
import random
import math
from .base import BaseActivity

_TWO_PI = 2 * math.pi


def _normalize_vertices(verts):
    """Scale vertices so the bounding box fits roughly within [-1, 1]."""
    if not verts:
        return verts
    max_abs = 0.0
    for v in verts:
        for c in v:
            if abs(c) > max_abs:
                max_abs = abs(c)
    if max_abs < 1e-9:
        return verts
    scale = 1.0 / max_abs
    return [[c * scale for c in v] for v in verts]


def _build_cube():
    """8 vertices, 12 edges."""
    verts = [
        [-1, -1, -1], [-1, -1,  1], [-1,  1, -1], [-1,  1,  1],
        [ 1, -1, -1], [ 1, -1,  1], [ 1,  1, -1], [ 1,  1,  1],
    ]
    edges = [
        # bottom face
        [0, 1], [1, 3], [3, 2], [2, 0],
        # top face
        [4, 5], [5, 7], [7, 6], [6, 4],
        # vertical pillars
        [0, 4], [1, 5], [2, 6], [3, 7],
    ]
    return verts, edges


def _build_torus(major_r=0.7, minor_r=0.3, major_n=16, minor_n=5):
    """Parameterized ring of rings. ~80 vertices, ~160 edges."""
    verts = []
    edges = []
    for i in range(major_n):
        theta = _TWO_PI * i / major_n
        ct, st = math.cos(theta), math.sin(theta)
        for j in range(minor_n):
            phi = _TWO_PI * j / minor_n
            cp, sp = math.cos(phi), math.sin(phi)
            r = major_r + minor_r * cp
            x = r * ct
            y = r * st
            z = minor_r * sp
            verts.append([x, y, z])

    for i in range(major_n):
        for j in range(minor_n):
            cur = i * minor_n + j
            # edge along minor circle
            next_minor = i * minor_n + (j + 1) % minor_n
            edges.append([cur, next_minor])
            # edge along major circle
            next_major = ((i + 1) % major_n) * minor_n + j
            edges.append([cur, next_major])

    return verts, edges


def _build_icosahedron():
    """12 vertices, 30 edges."""
    phi = (1 + math.sqrt(5)) / 2  # golden ratio
    verts = [
        [-1,  phi, 0], [ 1,  phi, 0], [-1, -phi, 0], [ 1, -phi, 0],
        [0, -1,  phi], [0,  1,  phi], [0, -1, -phi], [0,  1, -phi],
        [ phi, 0, -1], [ phi, 0,  1], [-phi, 0, -1], [-phi, 0,  1],
    ]
    faces = [
        (0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11),
        (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
        (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9),
        (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1),
    ]
    edge_set = set()
    for a, b, c in faces:
        for u, v in [(a, b), (b, c), (a, c)]:
            edge_set.add((min(u, v), max(u, v)))
    edges = [[u, v] for u, v in sorted(edge_set)]
    return verts, edges


def _build_double_helix(turns=3, points_per_turn=10, radius=0.6, pitch=0.4):
    """Two interleaved helices connected by rungs. ~60 vertices, ~80 edges."""
    n = turns * points_per_turn
    verts = []
    edges = []

    # Build helix A (indices 0..n-1) and helix B (indices n..2n-1)
    total_height = turns * pitch
    for i in range(n):
        t = _TWO_PI * turns * i / n
        z = (total_height * i / n) - total_height / 2
        # Helix A
        verts.append([radius * math.cos(t), radius * math.sin(t), z])
        # Helix B (offset by pi)
        verts.append([radius * math.cos(t + math.pi), radius * math.sin(t + math.pi), z])

    # Connect along each strand
    for i in range(n - 1):
        # Helix A spine
        edges.append([i * 2, (i + 1) * 2])
        # Helix B spine
        edges.append([i * 2 + 1, (i + 1) * 2 + 1])

    # Cross-rungs every few steps
    rung_step = max(1, points_per_turn // 3)
    for i in range(0, n, rung_step):
        edges.append([i * 2, i * 2 + 1])

    return verts, edges


def _build_random_mesh(n_verts=20, connect_radius=0.7):
    """Random vertices with edges between nearby pairs."""
    verts = [[random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1)]
             for _ in range(n_verts)]
    edges = []
    for i in range(n_verts):
        for j in range(i + 1, n_verts):
            dx = verts[i][0] - verts[j][0]
            dy = verts[i][1] - verts[j][1]
            dz = verts[i][2] - verts[j][2]
            dist = math.sqrt(dx * dx + dy * dy + dz * dz)
            if dist < connect_radius:
                edges.append([i, j])
    return verts, edges


_BUILDERS = {
    "cube": _build_cube,
    "torus": _build_torus,
    "icosahedron": _build_icosahedron,
    "double_helix": _build_double_helix,
    "random_mesh": _build_random_mesh,
}


class Wireframe3DActivity(BaseActivity):
    activity_type = "wireframe_3d"
    strategies = list(_BUILDERS.keys())
    titles = ["3D WIREFRAME", "MESH VIEWER", "GEOMETRY ENGINE", "WIRE MODEL", "3D RENDER"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        builder = _BUILDERS[self.strategy]
        verts, edges = builder()
        self._vertices = _normalize_vertices(verts)
        self._edges = edges
        self._rot_x = 0.0
        self._rot_y = 0.0
        # Rotation speeds influenced by intensity (1-10 scale)
        speed_scale = 0.003 + 0.002 * (self.intensity / 10.0)
        self._speed_x = random.uniform(speed_scale * 0.5, speed_scale * 1.5)
        self._speed_y = random.uniform(speed_scale * 0.5, speed_scale * 1.5)

    def _round_verts(self):
        return [[round(c, 4) for c in v] for v in self._vertices]

    def _get_state(self) -> dict:
        return {
            "vertices": self._round_verts(),
            "edges": self._edges,
            "rot_x": round(self._rot_x, 4),
            "rot_y": round(self._rot_y, 4),
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        # Advance rotation by speeds with a small random jitter
        jitter = 0.0005 * (self.intensity / 10.0)
        self._rot_x = (self._rot_x + self._speed_x + random.uniform(-jitter, jitter)) % _TWO_PI
        self._rot_y = (self._rot_y + self._speed_y + random.uniform(-jitter, jitter)) % _TWO_PI
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        # Vertices are STATIC (set once in __init__) — only rotation changes
        return {
            "_delta": True,
            "rot_x": new_state["rot_x"],
            "rot_y": new_state["rot_y"],
        }
