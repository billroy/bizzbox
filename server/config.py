"""
App configuration dataclass populated from CLI args at startup.
Exported as a module-level singleton; all server modules import this.
"""
from dataclasses import dataclass, field


@dataclass
class AppConfig:
    intensity: int = 5          # mean updates per second
    sync_mode: str = "synced"   # "synced" | "unsynced"
    host: str = "0.0.0.0"
    port: int = 5000
    style: str = "dark"         # current global style
    muted: bool = False         # global mute state
    grid_cols: int = 3          # background grid columns
    grid_rows: int = 2          # background grid rows


# Module-level singleton, replaced at app startup
config = AppConfig()
