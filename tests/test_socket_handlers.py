"""T1c — Input validation tests for socket handlers via _safe_int."""
import pytest
from app import _safe_int, _check_rate, _rate_buckets


class TestSafeInt:
    """_safe_int must never raise, returning the default for bad input."""

    @pytest.mark.parametrize("bad_val", ["abc", None, [], {}, "", "1e308", float("inf")])
    def test_bad_values_return_default(self, bad_val):
        assert _safe_int(bad_val, 42) == 42

    def test_valid_int(self):
        assert _safe_int(5, 0) == 5

    def test_valid_string_int(self):
        assert _safe_int("7", 0) == 7

    def test_float_truncates(self):
        assert _safe_int(3.9, 0) == 3

    def test_negative(self):
        assert _safe_int(-1, 0) == -1


class TestRateLimiter:
    """Token-bucket rate limiter must allow bursts then reject."""

    def setup_method(self):
        _rate_buckets.clear()

    def test_allows_initial_burst(self):
        for _ in range(20):
            assert _check_rate("sid1", "some_event") is True

    def test_rejects_after_burst(self):
        # Exhaust the default bucket (20 tokens)
        for _ in range(20):
            _check_rate("sid2", "some_event")
        # Next should be rejected
        assert _check_rate("sid2", "some_event") is False

    def test_tight_limit_for_channel_create(self):
        # channel:create has bucket_size=2
        assert _check_rate("sid3", "channel:create") is True
        assert _check_rate("sid3", "channel:create") is True
        assert _check_rate("sid3", "channel:create") is False
