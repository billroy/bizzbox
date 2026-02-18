"""Matrix-style falling character rain generator."""
import random
import math
from .base import BaseActivity

# Character pools per strategy
_ASCII_PRINTABLE = [chr(c) for c in range(33, 127)]
_KATAKANA = [chr(c) for c in range(0x30A0, 0x30FF)]
_KANJI_MIX = _ASCII_PRINTABLE + _KATAKANA
_BINARY = ['0', '1']


def _char_pool(strategy: str) -> list[str]:
    if strategy == "kanji_mix":
        return _KANJI_MIX
    elif strategy == "binary_rain":
        return _BINARY
    else:
        # classic_green, cipher_stream, multicolor all use ASCII printable
        return _ASCII_PRINTABLE


class MatrixRainActivity(BaseActivity):
    activity_type = "matrix_rain"
    strategies = ["classic_green", "kanji_mix", "binary_rain", "cipher_stream", "multicolor"]
    titles = ["MATRIX RAIN", "SIGNAL STREAM", "DATA CASCADE", "CIPHER FLOW", "CODE RAIN"]

    # Number of columns: scale loosely with intensity
    _MIN_COLUMNS = 20
    _MAX_COLUMNS = 40

    # Column character length range
    _MIN_LEN = 8
    _MAX_LEN = 24

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._pool = _char_pool(self.strategy)
        n_cols = int(self._MIN_COLUMNS + (self._MAX_COLUMNS - self._MIN_COLUMNS) * (intensity / 10))
        n_cols = max(self._MIN_COLUMNS, min(self._MAX_COLUMNS, n_cols))
        self._columns = [self._make_column() for _ in range(n_cols)]

    def _rand_char(self) -> str:
        return random.choice(self._pool)

    def _make_column(self) -> dict:
        length = random.randint(self._MIN_LEN, self._MAX_LEN)
        return {
            "chars": [self._rand_char() for _ in range(length)],
            "drop_speed": round(random.uniform(0.5, 2.0), 3),
            "head_y": round(random.uniform(-0.2, 1.2), 4),
            "length": length,
        }

    def _advance_column(self, col: dict) -> dict:
        col["head_y"] = round(col["head_y"] + col["drop_speed"] * 0.02, 4)
        if col["head_y"] > 1.2:
            # Reset: new drop from above
            length = random.randint(self._MIN_LEN, self._MAX_LEN)
            col["head_y"] = round(random.uniform(-0.3, -0.1), 4)
            col["drop_speed"] = round(random.uniform(0.5, 2.0), 3)
            col["chars"] = [self._rand_char() for _ in range(length)]
            col["length"] = length
        else:
            # Occasionally mutate a random character in the column
            if random.random() < 0.25:
                idx = random.randrange(len(col["chars"]))
                col["chars"][idx] = self._rand_char()
        return col

    def _get_state(self) -> dict:
        return {
            "columns": [
                {
                    "chars": list(col["chars"]),
                    "drop_speed": col["drop_speed"],
                    "head_y": col["head_y"],
                    "length": col["length"],
                }
                for col in self._columns
            ],
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        for col in self._columns:
            self._advance_column(col)
        return self._get_state()
