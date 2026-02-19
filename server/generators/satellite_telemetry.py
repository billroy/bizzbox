"""Satellite telemetry generator — orbital mechanics, signal health, attitude data."""
import random
import math
from datetime import datetime, timezone, timedelta
from .base import BaseActivity


class SatelliteTelemetryActivity(BaseActivity):
    activity_type = "satellite_telemetry"
    strategies = [
        "leo_recon",
        "geo_comms",
        "deep_space_probe",
        "iss_module",
        "military_sigint",
    ]
    titles = [
        "SATELLITE TELEMETRY",
        "ORBITAL TRACKING",
        "GROUND STATION LINK",
        "SPACECRAFT OPERATIONS",
        "MISSION CONTROL FEED",
        "UPLINK/DOWNLINK MONITOR",
        "DEEP SPACE NETWORK",
    ]

    # Per-strategy config: (alt_km_min, alt_km_max, vel_kms_min, vel_kms_max, signal_base)
    STRATEGY_CFG = {
        "leo_recon":       (400,   700,   7.5, 7.8, 82.0),
        "geo_comms":       (35700, 35900, 3.0, 3.1, 74.0),
        "deep_space_probe":(500000, 1200000, 0.8, 4.5, 38.0),
        "iss_module":      (408,   420,   7.65, 7.67, 91.0),
        "military_sigint": (600,   1200,  7.2, 7.6, 68.0),
    }

    SAT_NAMES = {
        "leo_recon":        ["KEYHOLE-17", "USA-224", "LACROSSE-5", "MISTY-2", "ONYX-7"],
        "geo_comms":        ["INTELSAT-39", "ASTRA-2G", "GOES-16", "EUTELSAT-33B", "HORIZONS-3E"],
        "deep_space_probe": ["VOYAGER-1", "NEW-HORIZONS", "CASSINI-HUYGENS", "OSIRIS-REX", "PIONEER-10"],
        "iss_module":       ["ISS ZARYA", "ISS DESTINY", "ISS HARMONY", "ISS TRANQUILITY", "ISS COLUMBUS"],
        "military_sigint":  ["USA-179", "INTRUDER-5", "ORION-8", "MENTOR-4", "TRUMPET-3"],
    }

    DESIGNATORS = {
        "leo_recon":        ["1999-028A", "2011-002A", "2000-019A", "1999-009A", "2005-016A"],
        "geo_comms":        ["2013-038A", "2014-050A", "2017-005A", "2010-054A", "2019-046A"],
        "deep_space_probe": ["1977-084A", "2006-001A", "1997-061A", "2016-055A", "1972-012A"],
        "iss_module":       ["1998-067A", "1998-067AR", "1998-067AQ", "1998-067AP", "1998-067AK"],
        "military_sigint":  ["2003-020A", "1996-029A", "2010-008A", "2009-001A", "1994-054A"],
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        cfg = self.STRATEGY_CFG[self.strategy]
        self._alt = random.uniform(cfg[0], cfg[1])
        self._velocity = random.uniform(cfg[2], cfg[3])
        self._signal_base = cfg[4]
        self._signal = self._signal_base + random.uniform(-5, 5)
        self._battery = random.uniform(72.0, 98.0)
        self._solar_angle = random.uniform(0.0, 90.0)
        self._roll = random.uniform(-5.0, 5.0)
        self._pitch = random.uniform(-5.0, 5.0)
        self._yaw = random.uniform(-5.0, 5.0)
        self._lat = random.uniform(-80.0, 80.0)
        self._lon = random.uniform(-180.0, 180.0)
        self._uplink = random.uniform(8.0, 512.0)
        self._downlink = random.uniform(64.0, 4096.0)
        self._link_margin = random.uniform(3.0, 18.0)
        self._los = False
        self._los_frames_left = 0
        self._los_countdown = random.randint(30, 60)
        self._sat_name = random.choice(self.SAT_NAMES[self.strategy])
        self._designator = random.choice(self.DESIGNATORS[self.strategy])
        self._next_pass_minutes = random.randint(8, 94)

    def _next_pass_str(self):
        now = datetime.now(timezone.utc)
        future = now + timedelta(minutes=self._next_pass_minutes)
        return future.strftime("%H:%M UTC")

    def _get_state(self):
        if self._los:
            sig = 0.0
            uplink = 0.0
            downlink = 0.0
            link_margin = -6.0 + random.uniform(-2, 2)
        else:
            sig = round(max(0.0, min(100.0, self._signal)), 2)
            uplink = round(max(0.0, self._uplink), 2)
            downlink = round(max(0.0, self._downlink), 2)
            link_margin = round(self._link_margin, 2)

        return {
            "sat_name":       self._sat_name,
            "designator":     self._designator,
            "orbit_alt_km":   round(self._alt, 1),
            "velocity_kms":   round(self._velocity, 4),
            "signal_strength": sig,
            "uplink_kbps":    uplink,
            "downlink_kbps":  downlink,
            "battery_pct":    round(self._battery, 2),
            "solar_angle":    round(self._solar_angle, 2),
            "roll":           round(self._roll, 3),
            "pitch":          round(self._pitch, 3),
            "yaw":            round(self._yaw, 3),
            "lat":            round(self._lat, 4),
            "lon":            round(self._lon, 4),
            "next_pass":      self._next_pass_str(),
            "link_margin_db": link_margin,
            "los":            self._los,
            "strategy":       self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        # Manage LOS events
        if self._los:
            self._los_frames_left -= 1
            if self._los_frames_left <= 0:
                self._los = False
                self._signal = self._signal_base * 0.6
        else:
            self._los_countdown -= 1
            if self._los_countdown <= 0:
                self._los = True
                self._los_frames_left = random.randint(2, 5)
                self._los_countdown = random.randint(30, 70)

        if not self._los:
            # Drift signal
            self._signal += random.gauss(0, 0.8)
            self._signal = max(self._signal_base * 0.4,
                               min(100.0, self._signal))
            # Drift link margin
            self._link_margin += random.gauss(0, 0.2)
            self._link_margin = max(0.5, min(25.0, self._link_margin))
            # Drift uplink/downlink slightly
            self._uplink += random.gauss(0, 2.0)
            self._downlink += random.gauss(0, 8.0)
            self._uplink = max(1.0, self._uplink)
            self._downlink = max(8.0, self._downlink)

        # Attitude drift (small random walk)
        self._roll  += random.gauss(0, 0.05)
        self._pitch += random.gauss(0, 0.05)
        self._yaw   += random.gauss(0, 0.05)
        self._roll  = max(-15.0, min(15.0, self._roll))
        self._pitch = max(-15.0, min(15.0, self._pitch))
        self._yaw   = max(-180.0, min(180.0, self._yaw))

        # Orbit propagation — crude great-circle approximation
        # GEO barely moves; LEO moves a lot per tick
        speed_factor = {
            "leo_recon":        0.15,
            "geo_comms":        0.001,
            "deep_space_probe": 0.0003,
            "iss_module":       0.15,
            "military_sigint":  0.12,
        }[self.strategy]
        self._lat += random.gauss(0, speed_factor * 0.4)
        self._lon += speed_factor * (1.0 + random.uniform(-0.05, 0.05))
        self._lat = max(-85.0, min(85.0, self._lat))
        if self._lon > 180.0:
            self._lon -= 360.0

        # Altitude slight perturbation (orbital decay / station-keeping)
        cfg = self.STRATEGY_CFG[self.strategy]
        self._alt += random.gauss(0, 0.3)
        self._alt = max(cfg[0] * 0.99, min(cfg[1] * 1.01, self._alt))

        # Velocity coupled to altitude (vis-viva approximation, simplified)
        self._velocity += random.gauss(0, 0.001)
        self._velocity = max(cfg[2] * 0.99, min(cfg[3] * 1.01, self._velocity))

        # Battery and solar
        in_eclipse = self._solar_angle > 70.0
        self._solar_angle += random.gauss(0, 1.5)
        self._solar_angle = self._solar_angle % 110.0
        if in_eclipse:
            self._battery -= random.uniform(0.02, 0.08)
        else:
            self._battery += random.uniform(0.01, 0.05)
        self._battery = max(20.0, min(100.0, self._battery))

        # Next pass countdown
        self._next_pass_minutes = max(1, self._next_pass_minutes - 1)

        return self._get_state()
