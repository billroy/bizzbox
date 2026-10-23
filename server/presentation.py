"""Server-authoritative presentation state and scene validation."""
from __future__ import annotations

from dataclasses import dataclass, field
import time

from .activity_registry import REGISTRY


MIN_INTERVAL_SECONDS = 1
MAX_INTERVAL_SECONDS = 3600
MAX_PRESENTATION_SCENES = 100
MAX_SCENE_SLOTS = 100
TRANSITION_PHASE_SECONDS = 0.3


def _bounded_int(value, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError, OverflowError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def normalize_interval(value, default: int = 60) -> int:
    return _bounded_int(value, default, MIN_INTERVAL_SECONDS, MAX_INTERVAL_SECONDS)


def normalize_scene(data: object) -> dict | None:
    """Return a bounded scene payload suitable for server storage and replay."""
    if not isinstance(data, dict):
        return None

    name = data.get("name", "Scene")
    style = data.get("style", "dark")
    ambient = data.get("ambientPreset")
    if not isinstance(name, str) or not isinstance(style, str):
        return None
    name = name.strip()[:100] or "Scene"
    style = style.strip()[:40] or "dark"
    if ambient is not None:
        if not isinstance(ambient, str):
            ambient = None
        else:
            ambient = ambient[:80]

    raw_filter = data.get("filter")
    allowed = None
    if isinstance(raw_filter, list):
        allowed = [
            value for value in raw_filter
            if isinstance(value, str) and value in REGISTRY
        ]

    raw_slots = data.get("slots")
    slots = []
    if isinstance(raw_slots, list):
        slots = [
            value for value in raw_slots[:MAX_SCENE_SLOTS]
            if isinstance(value, str) and value in REGISTRY
        ]

    return {
        "name": name,
        "style": style,
        "cols": _bounded_int(data.get("cols"), 6, 1, 10),
        "rows": _bounded_int(data.get("rows"), 4, 1, 10),
        "intensity": _bounded_int(data.get("intensity"), 5, 1, 20),
        "fgTarget": 0,
        "ambientPreset": ambient,
        "filter": allowed,
        "slots": slots,
    }


def normalize_playlist(raw_scenes: object) -> list[dict]:
    if not isinstance(raw_scenes, list):
        return []
    scenes = []
    for raw in raw_scenes[:MAX_PRESENTATION_SCENES]:
        scene = normalize_scene(raw)
        if scene is not None:
            scenes.append(scene)
    return scenes


@dataclass
class PresentationState:
    active: bool = False
    interval_seconds: int = 60
    playlist: list[dict] = field(default_factory=list)
    current_index: int | None = None
    next_index: int = 0
    next_transition_at_ms: int | None = None
    revision: int = 0
    phase: str = "idle"
    filter_label: str = "all"
    _next_transition_monotonic: float | None = None
    _phase_ends_monotonic: float | None = None

    def start(self, scenes: list[dict], interval_seconds: int, filter_label: str,
              now_monotonic: float, now_epoch: float) -> dict:
        self.active = True
        self.playlist = scenes
        self.interval_seconds = normalize_interval(interval_seconds)
        self.current_index = 0
        self.next_index = 1 % len(scenes)
        self.phase = "idle"
        self.filter_label = filter_label[:100] if isinstance(filter_label, str) else "all"
        self._phase_ends_monotonic = None
        self._schedule(now_monotonic, now_epoch)
        self.revision += 1
        return scenes[0]

    def schedule(self, interval_seconds: int, now_monotonic: float,
                 now_epoch: float) -> None:
        self.interval_seconds = normalize_interval(interval_seconds, self.interval_seconds)
        self.phase = "idle"
        self._phase_ends_monotonic = None
        self._schedule(now_monotonic, now_epoch)
        self.revision += 1

    def stop(self) -> None:
        self.active = False
        self.phase = "idle"
        self.next_transition_at_ms = None
        self._next_transition_monotonic = None
        self._phase_ends_monotonic = None
        self.revision += 1

    def _schedule(self, now_monotonic: float, now_epoch: float) -> None:
        self._next_transition_monotonic = now_monotonic + self.interval_seconds
        self.next_transition_at_ms = round((now_epoch + self.interval_seconds) * 1000)

    def tick(self, now_monotonic: float, now_epoch: float) -> tuple[str, dict | None] | None:
        if not self.active or not self.playlist:
            return None

        if self.phase == "idle":
            if self._next_transition_monotonic is None or now_monotonic < self._next_transition_monotonic:
                return None
            self.phase = "blackout"
            self._phase_ends_monotonic = now_monotonic + TRANSITION_PHASE_SECONDS
            self.revision += 1
            return ("state", None)

        if self._phase_ends_monotonic is None or now_monotonic < self._phase_ends_monotonic:
            return None

        if self.phase == "blackout":
            scene = self.playlist[self.next_index]
            self.current_index = self.next_index
            self.next_index = (self.next_index + 1) % len(self.playlist)
            self.phase = "reveal"
            self._phase_ends_monotonic = now_monotonic + TRANSITION_PHASE_SECONDS
            self._schedule(now_monotonic, now_epoch)
            self.revision += 1
            return ("scene", scene)

        if self.phase == "reveal":
            self.phase = "idle"
            self._phase_ends_monotonic = None
            self.revision += 1
            return ("state", None)

        return None

    def public_state(self, channel_id: int, now_epoch: float | None = None) -> dict:
        now_epoch = time.time() if now_epoch is None else now_epoch
        current_scene = None
        if self.current_index is not None and self.playlist:
            current_scene = self.playlist[self.current_index]
        return {
            "channelId": channel_id,
            "active": self.active,
            "intervalSeconds": self.interval_seconds,
            "nextTransitionAt": self.next_transition_at_ms,
            "currentIndex": self.current_index,
            "currentScene": current_scene,
            "revision": self.revision,
            "phase": self.phase,
            "filter": self.filter_label,
            "serverTime": round(now_epoch * 1000),
        }

    def storage_state(self) -> dict:
        return {
            "active": self.active,
            "intervalSeconds": self.interval_seconds,
            "playlist": self.playlist,
            "currentIndex": self.current_index,
            "nextIndex": self.next_index,
            "nextTransitionAt": self.next_transition_at_ms,
            "revision": self.revision,
            "filter": self.filter_label,
        }

    def restore(self, stored: object, now_monotonic: float, now_epoch: float) -> bool:
        if not isinstance(stored, dict) or not stored.get("active"):
            return False
        scenes = normalize_playlist(stored.get("playlist"))
        if not scenes:
            return False

        self.active = True
        self.playlist = scenes
        self.interval_seconds = normalize_interval(stored.get("intervalSeconds", 60))
        self.current_index = _bounded_int(
            stored.get("currentIndex"), 0, 0, len(scenes) - 1
        )
        self.next_index = _bounded_int(
            stored.get("nextIndex"), (self.current_index + 1) % len(scenes),
            0, len(scenes) - 1,
        )
        self.revision = max(0, _bounded_int(stored.get("revision"), 0, 0, 2**31 - 1)) + 1
        self.filter_label = str(stored.get("filter", "all"))[:100]
        self.phase = "idle"
        self._phase_ends_monotonic = None

        try:
            remaining = (int(stored.get("nextTransitionAt")) / 1000) - now_epoch
        except (TypeError, ValueError, OverflowError):
            remaining = self.interval_seconds
        if remaining <= 0:
            remaining = self.interval_seconds
        self._next_transition_monotonic = now_monotonic + remaining
        self.next_transition_at_ms = round((now_epoch + remaining) * 1000)
        return True
