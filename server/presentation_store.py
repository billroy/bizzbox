"""Durable SQLite storage for active channel presentations."""
from __future__ import annotations

import json
from pathlib import Path
import sqlite3


class PresentationStore:
    def __init__(self, path: str):
        self.path = Path(path).expanduser()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute(
                """CREATE TABLE IF NOT EXISTS presentations (
                       channel_id INTEGER PRIMARY KEY,
                       state_json TEXT NOT NULL
                   )"""
            )

    def _connect(self):
        return sqlite3.connect(self.path, timeout=5)

    def load_all(self) -> dict[int, dict]:
        records = {}
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT channel_id, state_json FROM presentations ORDER BY channel_id"
            ).fetchall()
        for channel_id, raw in rows:
            try:
                state = json.loads(raw)
            except (TypeError, ValueError):
                continue
            if isinstance(state, dict):
                records[int(channel_id)] = state
        return records

    def save(self, channel_id: int, state: dict):
        encoded = json.dumps(state, separators=(",", ":"))
        with self._connect() as connection:
            connection.execute(
                """INSERT INTO presentations(channel_id, state_json)
                   VALUES (?, ?)
                   ON CONFLICT(channel_id) DO UPDATE SET state_json=excluded.state_json""",
                (channel_id, encoded),
            )

    def delete(self, channel_id: int):
        with self._connect() as connection:
            connection.execute(
                "DELETE FROM presentations WHERE channel_id = ?", (channel_id,)
            )
