"""
Base abstract class for all activity generators.
Each subclass implements initial_payload() and next_frame().
"""
import random
import uuid
from abc import ABC, abstractmethod


class BaseActivity(ABC):
    activity_type: str = "base"
    strategies: list[str] = []
    titles: list[str] = ["ACTIVITY"]

    def __init__(self, activity_id: str = None, intensity: int = 5):
        self.id = activity_id or f"act_{uuid.uuid4().hex[:8]}"
        self.intensity = intensity
        self.strategy = random.choice(self.strategies) if self.strategies else "default"
        self.title = random.choice(self.titles)

    @abstractmethod
    def initial_payload(self) -> dict:
        """Return the full state dict for the first spawn payload."""
        ...

    @abstractmethod
    def next_frame(self) -> dict:
        """Return the full state dict for an activity:update payload."""
        ...

    def compute_delta(self, old_state: dict, new_state: dict) -> dict | None:
        """Return a delta patch dict, or None to send full state.
        Override in subclasses with large state to enable delta updates.
        Delta dicts MUST include '_delta': True as a marker."""
        return None

    def spawn_payload(self, slot: int = None, is_foreground: bool = False,
                      position: dict = None, size: dict = None) -> dict:
        """Build the complete activity:spawn JSON payload."""
        return {
            "id": self.id,
            "type": self.activity_type,
            "title": self.title,
            "slot": slot,
            "is_foreground": is_foreground,
            "position": position,
            "size": size,
            "strategy": self.strategy,
            "state": self.initial_payload(),
        }
