"""Regression coverage for readable oscilloscope traces."""
import random

import pytest

from server.generators.oscilloscope import OscilloscopeActivity


def _generator_for(strategy: str) -> OscilloscopeActivity:
    generator = OscilloscopeActivity(intensity=5)
    generator.strategy = strategy
    generator.title = random.choice(generator.STRATEGY_TITLES[strategy])
    generator._params = generator._init_params()
    return generator


def _visible_zero_crossings(samples: list[float], deadband: float = 0.05) -> int:
    """Count sign changes that escape baseline noise."""
    side = 0
    crossings = 0
    for sample in samples:
        next_side = 1 if sample > deadband else -1 if sample < -deadband else side
        if side and next_side != side:
            crossings += 1
        side = next_side
    return crossings


@pytest.mark.parametrize(
    ("strategy", "max_crossings"),
    [
        ("ecg_heartbeat", 45),
        ("seismic", 35),
        ("radio_carrier", 25),
        ("brain_wave", 25),
        ("power_grid_ac", 20),
    ],
)
def test_waveform_timebase_keeps_traces_readable(strategy, max_crossings):
    random.seed(20261023)
    generator = _generator_for(strategy)
    samples = generator.initial_payload()["samples"]

    assert len(samples) == generator.SAMPLE_COUNT
    assert max(samples) - min(samples) > 0.1
    assert _visible_zero_crossings(samples) <= max_crossings


def test_titles_match_the_generated_signal_strategy():
    random.seed(20261023)
    seen = set()
    for _ in range(200):
        generator = OscilloscopeActivity()
        seen.add(generator.strategy)
        assert generator.title in generator.STRATEGY_TITLES[generator.strategy]

    assert seen == set(OscilloscopeActivity.strategies)

    assert "BIOSIGNAL TRACE" not in OscilloscopeActivity.STRATEGY_TITLES["power_grid_ac"]
    assert "BIOSIGNAL TRACE" not in OscilloscopeActivity.STRATEGY_TITLES["radio_carrier"]
