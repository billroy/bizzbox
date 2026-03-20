"""Shared fixtures for the BizzBox test suite."""
import gevent.monkey
gevent.monkey.patch_all()

import pytest
from server.config import AppConfig
from server.event_emitter import EventEmitter


class FakeSocketIO:
    """Minimal stand-in for Flask-SocketIO that records emits."""

    def __init__(self):
        self.emitted = []

    def emit(self, event, data=None, room=None, skip_sid=None):
        self.emitted.append({"event": event, "data": data, "room": room, "skip_sid": skip_sid})

    def start_background_task(self, fn, *args, **kwargs):
        # Don't start background loops in tests
        pass


@pytest.fixture
def fake_sio():
    return FakeSocketIO()


@pytest.fixture
def emitter(fake_sio):
    return EventEmitter(fake_sio)


@pytest.fixture
def config():
    return AppConfig(intensity=5, sync_mode="synced", style="dark", fg_target=0)
