"""
Shared text pad activity generator.
Displays a text area that can be edited by any viewer on the channel.
Unlike other generators, this one does not auto-advance frames.
"""
import time

from .base import BaseActivity


class TextActivity(BaseActivity):
    activity_type = "text"
    strategies = ["notepad", "broadcast", "memo", "sticky"]
    titles = [
        "SHARED PAD",
        "MEMO",
        "BROADCAST TEXT",
        "LIVE NOTE",
        "CHANNEL MSG",
    ]
    update_interval_override = 999999.0  # effectively never auto-updates

    def __init__(self, activity_id: str = None, intensity: int = 5):
        super().__init__(activity_id, intensity)
        self.text = ""
        self.last_editor = None
        self.updated_at = None

    def set_text(self, text: str, editor_sid: str = None):
        """Called by the socket handler when a client edits the text."""
        self.text = text[:10000]  # cap at 10k chars
        self.last_editor = self._opaque_label(editor_sid) if editor_sid else None
        self.updated_at = time.time()

    @staticmethod
    def _opaque_label(sid: str) -> str:
        """Convert a raw SID to a short opaque label for broadcast."""
        return f"#{abs(hash(sid)) % 9999:04d}"

    def _get_state(self) -> dict:
        return {
            "text": self.text,
            "last_editor": self.last_editor,
            "updated_at": self.updated_at,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        return self._get_state()
