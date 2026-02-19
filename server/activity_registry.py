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
from .generators.matrix_rain import MatrixRainActivity
from .generators.audio_spectrum import AudioSpectrumActivity
from .generators.progress_bars import ProgressBarsActivity
from .generators.dna_sequence import DnaSequenceActivity
from .generators.graph import GraphActivity
from .generators.orbital_view import OrbitalViewActivity
from .generators.camera_feed import CameraFeedActivity
from .generators.cipher_decrypt import CipherDecryptActivity
from .generators.data_table import DataTableActivity
from .generators.system_topology import SystemTopologyActivity
from .generators.globe_arcs import GlobeArcsActivity
from .generators.heart_monitor import HeartMonitorActivity
from .generators.transit_map import TransitMapActivity
from .generators.weather_radar import WeatherRadarActivity
from .generators.stock_list import StockListActivity
from .generators.stock_graph import StockGraphActivity
from .generators.chat_intercept import ChatInterceptActivity
from .generators.wireframe_3d import Wireframe3DActivity
from .generators.power_grid import PowerGridActivity
from .generators.game_of_life import GameOfLifeActivity
from .generators.satellite_telemetry import SatelliteTelemetryActivity
from .generators.packet_sniffer import PacketSnifferActivity
from .generators.seismograph import SeismographActivity
from .generators.access_control import AccessControlActivity

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
    "matrix_rain":        MatrixRainActivity,
    "audio_spectrum":     AudioSpectrumActivity,
    "progress_bars":      ProgressBarsActivity,
    "dna_sequence":       DnaSequenceActivity,
    "graph":              GraphActivity,
    "orbital_view":       OrbitalViewActivity,
    "camera_feed":        CameraFeedActivity,
    "cipher_decrypt":     CipherDecryptActivity,
    "data_table":         DataTableActivity,
    "system_topology":    SystemTopologyActivity,
    "globe_arcs":         GlobeArcsActivity,
    "heart_monitor":      HeartMonitorActivity,
    "transit_map":        TransitMapActivity,
    "weather_radar":      WeatherRadarActivity,
    "stock_list":         StockListActivity,
    "stock_graph":        StockGraphActivity,
    "chat_intercept":     ChatInterceptActivity,
    "wireframe_3d":       Wireframe3DActivity,
    "power_grid":         PowerGridActivity,
    "game_of_life":           GameOfLifeActivity,
    "satellite_telemetry":    SatelliteTelemetryActivity,
    "packet_sniffer":         PacketSnifferActivity,
    "seismograph":            SeismographActivity,
    "access_control":         AccessControlActivity,
}

# Visual interest weights — higher = more likely to be chosen
WEIGHTS: dict[str, float] = {
    "network_topology":   1.2,
    "terminal":           1.3,
    "code_scroll":        1.3,
    "radar":              1.2,
    "log_tail":           1.0,
    "hex_dump":           0.7,
    "facial_recognition": 1.2,
    "countdown":          0.3,
    "oscilloscope":       1.2,
    "geo_map":            1.0,
    "resource_gauges":    0.8,
    "notifications":      0.4,
    "sdr_waterfall":      1.3,
    "qam_constellation":  1.0,
    "matrix_rain":        2.0,
    "audio_spectrum":     1.2,
    "progress_bars":      0.5,
    "dna_sequence":       1.3,
    "graph":              1.0,
    "orbital_view":       1.8,
    "camera_feed":        1.0,
    "cipher_decrypt":     1.6,
    "data_table":         0.5,
    "system_topology":    1.2,
    "globe_arcs":         1.8,
    "heart_monitor":      1.5,
    "transit_map":        1.0,
    "weather_radar":      1.5,
    "stock_list":         0.8,
    "stock_graph":        1.5,
    "chat_intercept":     1.3,
    "wireframe_3d":       1.4,
    "power_grid":         1.3,
    "game_of_life":           1.5,
    "satellite_telemetry":    1.4,
    "packet_sniffer":         1.3,
    "seismograph":            1.4,
    "access_control":         1.2,
}

_types = list(REGISTRY.keys())
_weights = [WEIGHTS[t] for t in _types]


def random_type(allowed: set[str] | None = None) -> str:
    """Return a weighted-random activity type name, optionally filtered."""
    if allowed is None or len(allowed) == 0:
        return random.choices(_types, weights=_weights, k=1)[0]
    filtered = [(t, w) for t, w in zip(_types, _weights) if t in allowed]
    if not filtered:
        return random.choices(_types, weights=_weights, k=1)[0]
    types, weights = zip(*filtered)
    return random.choices(types, weights=weights, k=1)[0]


def make_activity(activity_type: str = None, activity_id: str = None,
                  intensity: int = 5, allowed_types: set[str] | None = None):
    """Instantiate an activity generator of the given type (or random if None)."""
    if activity_type is None:
        activity_type = random_type(allowed=allowed_types)
    cls = REGISTRY[activity_type]
    return cls(activity_id=activity_id, intensity=intensity)
