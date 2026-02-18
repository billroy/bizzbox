"""Maps activity type names to generator classes with optional weighting."""
import random
from .generators.network_topology import NetworkTopologyActivity
from .generators.terminal import TerminalActivity
from .generators.code_scroll import CodeScrollActivity
from .generators.radar import RadarActivity
from .generators.log_tail import LogTailActivity
from .generators.hex_dump import HexDumpActivity
from .generators.facial_recognition import FacialRecognitionActivity
from .generators.countdown import CountdownActivity
from .generators.oscilloscope import OscilloscopeActivity
from .generators.geo_map import GeoMapActivity
from .generators.resource_gauges import ResourceGaugesActivity
from .generators.notifications import NotificationsActivity
from .generators.sdr_waterfall import SdrWaterfallActivity
from .generators.qam_constellation import QamConstellationActivity

REGISTRY: dict[str, type] = {
    "network_topology":   NetworkTopologyActivity,
    "terminal":           TerminalActivity,
    "code_scroll":        CodeScrollActivity,
    "radar":              RadarActivity,
    "log_tail":           LogTailActivity,
    "hex_dump":           HexDumpActivity,
    "facial_recognition": FacialRecognitionActivity,
    "countdown":          CountdownActivity,
    "oscilloscope":       OscilloscopeActivity,
    "geo_map":            GeoMapActivity,
    "resource_gauges":    ResourceGaugesActivity,
    "notifications":      NotificationsActivity,
    "sdr_waterfall":      SdrWaterfallActivity,
    "qam_constellation":  QamConstellationActivity,
}

# Visual interest weights — higher = more likely to be chosen
WEIGHTS: dict[str, float] = {
    "network_topology":   1.0,
    "terminal":           1.2,
    "code_scroll":        1.2,
    "radar":              1.0,
    "log_tail":           1.1,
    "hex_dump":           0.8,
    "facial_recognition": 1.0,
    "countdown":          0.6,
    "oscilloscope":       1.0,
    "geo_map":            1.0,
    "resource_gauges":    0.9,
    "notifications":      0.7,
    "sdr_waterfall":      1.1,
    "qam_constellation":  1.0,
}

_types = list(REGISTRY.keys())
_weights = [WEIGHTS[t] for t in _types]


def random_type() -> str:
    """Return a weighted-random activity type name."""
    return random.choices(_types, weights=_weights, k=1)[0]


def make_activity(activity_type: str = None, activity_id: str = None, intensity: int = 5):
    """Instantiate an activity generator of the given type (or random if None)."""
    if activity_type is None:
        activity_type = random_type()
    cls = REGISTRY[activity_type]
    return cls(activity_id=activity_id, intensity=intensity)
