"""Blockchain explorer generator — live transaction feed with block progression."""
import random
from .base import BaseActivity


class BlockchainActivity(BaseActivity):
    activity_type = "blockchain"
    strategies = [
        "bitcoin_mempool",
        "ethereum_defi",
        "nft_marketplace",
        "mining_pool",
        "cross_chain_bridge",
    ]
    titles = [
        "BLOCKCHAIN EXPLORER",
        "MEMPOOL MONITOR",
        "LEDGER VIEW",
        "BLOCK SCANNER",
        "CHAIN TRACKER",
        "TX FEED",
        "HASH STREAM",
    ]

    BUFFER_SIZE = 20

    # Amount ranges per strategy: (min, max)
    AMOUNT_RANGES = {
        "bitcoin_mempool":   (0.001, 5.0),
        "ethereum_defi":     (0.01, 50.0),
        "nft_marketplace":   (0.005, 2.5),
        "mining_pool":       (0.0001, 1.0),
        "cross_chain_bridge": (0.01, 25.0),
    }

    # Fee ranges per strategy
    FEE_RANGES = {
        "bitcoin_mempool":   (0.00005, 0.005),
        "ethereum_defi":     (0.001, 0.15),
        "nft_marketplace":   (0.001, 0.08),
        "mining_pool":       (0.00001, 0.002),
        "cross_chain_bridge": (0.005, 0.2),
    }

    # TPS ranges per strategy: (min, max)
    TPS_RANGES = {
        "bitcoin_mempool":   (10, 30),
        "ethereum_defi":     (15, 60),
        "nft_marketplace":   (20, 80),
        "mining_pool":       (10, 25),
        "cross_chain_bridge": (50, 500),
    }

    # Address prefix per strategy
    ADDR_PREFIXES = {
        "bitcoin_mempool":   ("bc1", "bc1"),
        "ethereum_defi":     ("0x", "0x"),
        "nft_marketplace":   ("0x", "0x"),
        "mining_pool":       ("bc1", "bc1"),
        "cross_chain_bridge": ("0x", "bc1"),
    }

    # Currency label per strategy
    CURRENCY = {
        "bitcoin_mempool":   "BTC",
        "ethereum_defi":     "ETH",
        "nft_marketplace":   "ETH",
        "mining_pool":       "BTC",
        "cross_chain_bridge": "MIX",
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._transactions = []
        self._block_height = random.randint(800000, 900000)
        self._frames_since_block = 0
        self._next_block_at = random.randint(4, 6)
        tps_lo, tps_hi = self.TPS_RANGES[self.strategy]
        self._tps = random.randint(tps_lo, tps_hi)
        self._mempool_depth = random.randint(1000, 8000)
        self._frame_count = 0
        # Track pending transaction ages: tx_hash -> frames_pending
        self._pending_ages = {}
        # Pre-fill buffer
        for _ in range(self.BUFFER_SIZE):
            tx = self._make_transaction(initial=True)
            self._transactions.append(tx)

    def _hex_string(self, length):
        """Generate a random hex string of the given length."""
        return ''.join(random.choices('0123456789abcdef', k=length))

    def _make_address(self, prefix):
        """Generate an address with the given prefix."""
        remaining = 8 - len(prefix)
        return prefix + self._hex_string(max(remaining, 4))

    def _make_transaction(self, initial=False):
        """Generate a new transaction dict."""
        from_prefix, to_prefix = self.ADDR_PREFIXES[self.strategy]
        amt_lo, amt_hi = self.AMOUNT_RANGES[self.strategy]
        fee_lo, fee_hi = self.FEE_RANGES[self.strategy]

        tx_hash = self._hex_string(12)

        # During initial fill, mix statuses; otherwise new ones are pending
        if initial:
            roll = random.random()
            if roll < 0.6:
                status = "confirmed"
                confirmations = random.randint(1, 20)
                block = self._block_height - random.randint(0, 5)
            elif roll < 0.97:
                status = "pending"
                confirmations = 0
                block = None
            else:
                status = "failed"
                confirmations = 0
                block = None
        else:
            status = "pending"
            confirmations = 0
            block = None
            self._pending_ages[tx_hash] = 0

        return {
            "hash": tx_hash,
            "from_addr": self._make_address(from_prefix),
            "to_addr": self._make_address(to_prefix),
            "amount": round(random.uniform(amt_lo, amt_hi), 6),
            "fee": round(random.uniform(fee_lo, fee_hi), 6),
            "status": status,
            "confirmations": confirmations,
            "block": block,
        }

    def _get_state(self):
        return {
            "transactions": list(self._transactions),
            "block_height": self._block_height,
            "mempool_depth": self._mempool_depth,
            "tps": self._tps,
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        self._frame_count += 1

        # --- Block progression ---
        self._frames_since_block += 1
        if self._frames_since_block >= self._next_block_at:
            self._block_height += 1
            self._frames_since_block = 0
            self._next_block_at = random.randint(4, 6)

        # --- Add 1-3 new transactions ---
        new_count = random.randint(1, 3)
        for _ in range(new_count):
            self._transactions.append(self._make_transaction())
        # Trim to buffer size
        self._transactions = self._transactions[-self.BUFFER_SIZE:]

        # --- Age pending transactions and advance status ---
        # Clean up ages for txns that fell off the buffer
        active_hashes = {tx["hash"] for tx in self._transactions}
        self._pending_ages = {h: a for h, a in self._pending_ages.items() if h in active_hashes}

        for tx in self._transactions:
            if tx["status"] == "pending":
                h = tx["hash"]
                age = self._pending_ages.get(h, 0) + 1
                self._pending_ages[h] = age
                # Confirm after 3-8 frames
                confirm_at = random.randint(3, 8)
                if age >= confirm_at:
                    # 3% chance of failure instead
                    if random.random() < 0.03:
                        tx["status"] = "failed"
                    else:
                        tx["status"] = "confirmed"
                        tx["confirmations"] = 1
                        tx["block"] = self._block_height
                    if h in self._pending_ages:
                        del self._pending_ages[h]
            elif tx["status"] == "confirmed":
                # Increment confirmations occasionally
                if random.random() < 0.3:
                    tx["confirmations"] = min(tx["confirmations"] + 1, 50)

        # --- Drift TPS ---
        tps_lo, tps_hi = self.TPS_RANGES[self.strategy]
        self._tps += random.randint(-5, 5)
        self._tps = max(tps_lo, min(tps_hi, self._tps))
        # Occasional spike
        if random.random() < 0.04:
            self._tps = min(500, int(self._tps * random.uniform(2.0, 4.0)))

        # --- Drift mempool depth ---
        self._mempool_depth += random.randint(-200, 200)
        self._mempool_depth = max(200, min(20000, self._mempool_depth))

        return self._get_state()
