"""Stock price chart — area graph of historical prices for a single ticker."""
import random
import math
import string
from .base import BaseActivity

_CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ"
_VOWELS = "AEIOU"


def _gen_ticker(length: int = None) -> str:
    """Generate a random ticker symbol (3-5 uppercase letters)."""
    if length is None:
        length = random.choice([3, 3, 4, 4, 4, 5])
    chars = []
    for i in range(length):
        if i % 2 == 0:
            chars.append(random.choice(_CONSONANTS))
        else:
            chars.append(random.choice(_VOWELS))
    if length >= 4 and random.random() < 0.3:
        idx = random.randint(1, length - 1)
        chars[idx] = random.choice(string.ascii_uppercase)
    return "".join(chars)


_STRATEGY_CONFIG = {
    "intraday":  {"points": 78, "volatility": 0.002, "trend": 0.0},
    "weekly":    {"points": 60, "volatility": 0.008, "trend": 0.001},
    "monthly":   {"points": 60, "volatility": 0.015, "trend": 0.002},
    "yearly":    {"points": 60, "volatility": 0.025, "trend": 0.003},
    "volatile":  {"points": 60, "volatility": 0.04,  "trend": 0.0},
}


class StockGraphActivity(BaseActivity):
    activity_type = "stock_graph"
    strategies = list(_STRATEGY_CONFIG.keys())
    titles = ["PRICE CHART", "STOCK CHART", "MARKET GRAPH", "EQUITY CHART", "TREND LINE"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._ticker = _gen_ticker()
        cfg = _STRATEGY_CONFIG[self.strategy]
        num_points = cfg["points"]
        vol = cfg["volatility"]
        trend = cfg["trend"]

        # Generate historical price series via geometric random walk
        base = random.uniform(20.0, 500.0)
        self._prices = [base]
        for _ in range(num_points - 1):
            ret = random.gauss(trend, vol)
            base = max(1.0, base * (1.0 + ret))
            self._prices.append(round(base, 2))
        self._open_price = self._prices[0]

    def _get_state(self) -> dict:
        current = self._prices[-1]
        change = round(current - self._open_price, 2)
        pct = round((change / self._open_price) * 100, 2) if self._open_price else 0
        return {
            "ticker": self._ticker,
            "prices": self._prices[-80:],  # cap at 80 points to keep payload small
            "current_price": current,
            "open_price": self._open_price,
            "change": change,
            "change_pct": pct,
            "gaining": change >= 0,
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        cfg = _STRATEGY_CONFIG[self.strategy]
        vol = cfg["volatility"] * (self.intensity / 5.0)
        trend = cfg["trend"]
        last = self._prices[-1]
        ret = random.gauss(trend, vol)
        new_price = round(max(1.0, last * (1.0 + ret)), 2)
        self._prices.append(new_price)
        # Keep history bounded
        if len(self._prices) > 120:
            self._prices = self._prices[-80:]
        return self._get_state()
