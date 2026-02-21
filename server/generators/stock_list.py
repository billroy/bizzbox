"""Stock price list — scrolling table of tickers with live prices."""
import math
import random
import string
from .base import BaseActivity

# Consonant/vowel fragments for generating plausible-sounding ticker symbols
_CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ"
_VOWELS = "AEIOU"


def _gen_ticker(length: int = None) -> str:
    """Generate a random ticker symbol (3-5 uppercase letters)."""
    if length is None:
        length = random.choice([3, 3, 4, 4, 4, 5])
    # Alternate consonant-vowel for pronounceability, with some randomness
    chars = []
    for i in range(length):
        if i % 2 == 0:
            chars.append(random.choice(_CONSONANTS))
        else:
            chars.append(random.choice(_VOWELS))
    # Occasionally swap one letter to a random uppercase for more variety
    if length >= 4 and random.random() < 0.3:
        idx = random.randint(1, length - 1)
        chars[idx] = random.choice(string.ascii_uppercase)
    return "".join(chars)


def _gen_unique_tickers(count: int) -> list[str]:
    """Generate a set of unique random tickers."""
    tickers = set()
    while len(tickers) < count:
        tickers.add(_gen_ticker())
    return list(tickers)


# Price range configs by strategy — determines the magnitude of generated prices
_PRICE_RANGES = {
    "tech":       (15.0, 600.0),
    "finance":    (20.0, 400.0),
    "healthcare": (10.0, 500.0),
    "mixed":      (8.0, 700.0),
    "crypto":     (0.001, 50000.0),
}


class StockListActivity(BaseActivity):
    activity_type = "stock_list"
    strategies = list(_PRICE_RANGES.keys())
    titles = ["MARKET WATCH", "LIVE QUOTES", "STOCK TICKER", "PRICE FEED", "TRADING DESK"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        count = random.randint(8, 16)
        tickers = _gen_unique_tickers(count)
        lo, hi = _PRICE_RANGES[self.strategy]
        self._stocks = []
        for ticker in tickers:
            # Log-uniform distribution so we get a mix of cheap and expensive
            base_price = math.exp(random.uniform(math.log(lo), math.log(hi)))
            # Round precision based on magnitude
            if base_price < 1.0:
                base_price = round(base_price, 4)
            else:
                base_price = round(base_price, 2)
            price = base_price * random.uniform(0.95, 1.05)
            open_price = price * random.uniform(0.98, 1.02)
            self._stocks.append({
                "ticker": ticker,
                "price": round(price, 2) if price >= 1 else round(price, 4),
                "open": round(open_price, 2) if open_price >= 1 else round(open_price, 4),
                "high": round(max(price, open_price) * random.uniform(1.0, 1.02), 2),
                "low": round(min(price, open_price) * random.uniform(0.98, 1.0), 2),
                "prev_close": round(price * random.uniform(0.97, 1.03), 2),
            })

    def _compute_derived(self, stock: dict) -> dict:
        change = round(stock["price"] - stock["prev_close"], 2)
        pct = round((change / stock["prev_close"]) * 100, 2) if stock["prev_close"] else 0.0
        return {
            "ticker": stock["ticker"],
            "price": stock["price"],
            "change": change,
            "change_pct": pct,
            "high": stock["high"],
            "low": stock["low"],
            "prev_close": stock["prev_close"],
            "gaining": change >= 0,
        }

    def _get_state(self) -> dict:
        return {
            "stocks": [self._compute_derived(s) for s in self._stocks],
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        # Strip strategy; ticker and prev_close rarely change
        stocks = []
        for s in new_state["stocks"]:
            stocks.append({
                "price": s["price"],
                "change": s["change"],
                "change_pct": s["change_pct"],
                "high": s["high"],
                "low": s["low"],
                "gaining": s["gaining"],
            })
        return {
            "_delta": True,
            "stocks": stocks,
        }

    def next_frame(self) -> dict:
        for stock in self._stocks:
            # Random walk — small percentage moves
            volatility = 0.003 * (self.intensity / 5.0)
            move = stock["price"] * random.gauss(0, volatility)
            stock["price"] = round(max(0.01, stock["price"] + move), 2)
            stock["high"] = round(max(stock["high"], stock["price"]), 2)
            stock["low"] = round(min(stock["low"], stock["price"]), 2)
        return self._get_state()
