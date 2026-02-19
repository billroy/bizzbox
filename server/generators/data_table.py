"""Scrolling data table / spreadsheet generator."""
import random
import string
from .base import BaseActivity

# Column definitions per strategy
_SCHEMAS = {
    "financial_ledger": {
        "columns": ["TIME", "ACCT", "TYPE", "AMOUNT", "BALANCE", "STATUS"],
        "generators": {
            "TIME": lambda: f"{random.randint(0,23):02d}:{random.randint(0,59):02d}:{random.randint(0,59):02d}",
            "ACCT": lambda: f"{''.join(random.choices(string.ascii_uppercase, k=2))}-{random.randint(1000,9999)}",
            "TYPE": lambda: random.choice(["CREDIT", "DEBIT", "XFER", "FEE", "DIV", "INT"]),
            "AMOUNT": lambda: f"${random.uniform(10, 50000):.2f}",
            "BALANCE": lambda: f"${random.uniform(1000, 999999):.2f}",
            "STATUS": lambda: random.choice(["CLEARED", "PENDING", "HOLD", "SETTLED"]),
        },
    },
    "intel_database": {
        "columns": ["ID", "CODENAME", "CLASS", "ORIGIN", "THREAT", "STATUS"],
        "generators": {
            "ID": lambda: f"INT-{random.randint(10000,99999)}",
            "CODENAME": lambda: random.choice([
                "NIGHTFALL", "CROSSBOW", "PHANTOM", "VIPER", "ECLIPSE",
                "IRON GATE", "SILVER FOX", "RED DAWN", "COLD SNAP", "FIREWALL",
            ]),
            "CLASS": lambda: random.choice(["TS/SCI", "SECRET", "CONF", "UNCLAS"]),
            "ORIGIN": lambda: random.choice(["SIGINT", "HUMINT", "OSINT", "GEOINT", "MASINT"]),
            "THREAT": lambda: random.choice(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]),
            "STATUS": lambda: random.choice(["ACTIVE", "CLOSED", "PENDING", "ARCHIVED"]),
        },
    },
    "server_inventory": {
        "columns": ["HOST", "IP", "CPU%", "MEM%", "DISK%", "STATUS"],
        "generators": {
            "HOST": lambda: f"srv-{random.choice(['web','db','app','cache','queue','proxy'])}-{random.randint(1,99):02d}",
            "IP": lambda: f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
            "CPU%": lambda: f"{random.uniform(2, 98):.1f}%",
            "MEM%": lambda: f"{random.uniform(10, 95):.1f}%",
            "DISK%": lambda: f"{random.uniform(15, 92):.1f}%",
            "STATUS": lambda: random.choice(["OK", "OK", "OK", "WARN", "CRIT", "MAINT"]),
        },
    },
    "flight_manifest": {
        "columns": ["FLIGHT", "ORIGIN", "DEST", "DEPART", "GATE", "STATUS"],
        "generators": {
            "FLIGHT": lambda: f"{random.choice(['AA','DL','UA','SW','BA','LH'])}{random.randint(100,9999)}",
            "ORIGIN": lambda: random.choice(["JFK", "LAX", "ORD", "LHR", "CDG", "NRT", "SFO", "DFW"]),
            "DEST": lambda: random.choice(["ATL", "MIA", "SEA", "FRA", "HND", "SIN", "DEN", "BOS"]),
            "DEPART": lambda: f"{random.randint(0,23):02d}:{random.randint(0,59):02d}",
            "GATE": lambda: f"{random.choice('ABCDEFG')}{random.randint(1,42)}",
            "STATUS": lambda: random.choice(["ON TIME", "ON TIME", "DELAYED", "BOARDING", "DEPARTED", "CANCELLED"]),
        },
    },
    "sensor_readings": {
        "columns": ["SENSOR", "TYPE", "VALUE", "UNIT", "THRESH", "STATUS"],
        "generators": {
            "SENSOR": lambda: f"S-{random.randint(1,200):03d}",
            "TYPE": lambda: random.choice(["TEMP", "PRESS", "HUMID", "FLOW", "VIBR", "PH"]),
            "VALUE": lambda: f"{random.uniform(0, 500):.2f}",
            "UNIT": lambda: random.choice(["°C", "kPa", "%RH", "L/m", "mm/s", "pH"]),
            "THRESH": lambda: f"{random.uniform(100, 400):.1f}",
            "STATUS": lambda: random.choice(["NORMAL", "NORMAL", "NORMAL", "WARN", "ALARM", "OFFLINE"]),
        },
    },
}

_N_ROWS = 12
_NEW_ROWS_PER_FRAME = (1, 2)
_CELL_UPDATE_PROB = 0.08  # probability a cell in an existing row mutates


class DataTableActivity(BaseActivity):
    activity_type = "data_table"
    strategies = list(_SCHEMAS.keys())
    titles = ["DATA TABLE", "DATABASE", "INVENTORY", "MANIFEST", "READINGS"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        schema = _SCHEMAS[self.strategy]
        self._columns = schema["columns"]
        self._generators = schema["generators"]
        self._rows = [self._make_row() for _ in range(_N_ROWS)]
        self._last_prepended = 0  # how many rows were prepended last frame

    def _make_row(self) -> list[str]:
        return [self._generators[col]() for col in self._columns]

    def _get_state(self) -> dict:
        return {
            "columns": list(self._columns),
            "rows": [list(r) for r in self._rows],
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def compute_delta(self, old_state: dict, new_state: dict) -> dict | None:
        """Send only changed cells and new prepended rows."""
        old_rows = old_state.get("rows", [])
        new_rows = new_state.get("rows", [])
        if not old_rows or not new_rows:
            return None
        if len(old_rows) != len(new_rows):
            return None  # row count changed — full frame

        n_new = self._last_prepended

        # Collect new prepended rows and changed cells in surviving rows
        prepended = new_rows[:n_new]
        changed_cells = []

        for ri in range(n_new, len(new_rows)):
            old_ri = ri - n_new
            if old_ri < len(old_rows):
                for ci in range(len(new_rows[ri])):
                    if ci < len(old_rows[old_ri]) and new_rows[ri][ci] != old_rows[old_ri][ci]:
                        changed_cells.append([ri, ci, new_rows[ri][ci]])

        return {
            "_delta": True,
            "new_rows": prepended,
            "new_rows_count": n_new,
            "changed_cells": changed_cells,
        }

    def next_frame(self) -> dict:
        # Add new rows at the top, push old ones down
        n_new = random.randint(*_NEW_ROWS_PER_FRAME)
        new_rows = [self._make_row() for _ in range(n_new)]
        self._rows = new_rows + self._rows
        if len(self._rows) > _N_ROWS:
            self._rows = self._rows[:_N_ROWS]
        self._last_prepended = n_new

        # Occasionally mutate cells in existing rows (simulating live updates)
        for row in self._rows[n_new:]:
            for ci in range(len(row)):
                if random.random() < _CELL_UPDATE_PROB:
                    row[ci] = self._generators[self._columns[ci]]()

        return self._get_state()
