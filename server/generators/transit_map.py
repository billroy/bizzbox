"""Random transit map with moving vehicles along routes."""
import random
import math
from .base import BaseActivity


# Transit line color palette
LINE_COLORS = [
    "#e53935", "#1e88e5", "#43a047", "#fb8c00", "#8e24aa",
    "#00acc1", "#f4511e", "#6d4c41", "#c0ca33", "#d81b60",
]

# Station name pools
STATION_NAMES = [
    "Central", "Union", "Park", "Main St", "Broadway", "Market",
    "Harbor", "Airport", "University", "Civic Ctr", "Downtown",
    "Midtown", "Uptown", "Riverside", "Lakeshore", "Highland",
    "Elm St", "Oak Ave", "Pine Rd", "Cedar Blvd", "Maple Dr",
    "1st Ave", "5th St", "14th St", "23rd St", "42nd St",
    "Grand", "Pacific", "Atlantic", "Summit", "Valley",
    "North End", "South Gate", "East Side", "West End",
    "Tech Park", "Hospital", "Stadium", "Museum", "Plaza",
]

LINE_NAMES = {
    "subway": ["RED LINE", "BLUE LINE", "GREEN LINE", "ORANGE LINE", "PURPLE LINE",
               "YELLOW LINE", "BROWN LINE", "PINK LINE"],
    "light_rail": ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8"],
    "bus_network": ["BUS 1", "BUS 7", "BUS 12", "BUS 23", "BUS 38", "BUS 45",
                    "BUS 71", "BUS 99"],
    "commuter_rail": ["CR-1", "CR-2", "CR-3", "CR-4", "CR-5", "CR-6", "CR-7"],
    "metro": ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8"],
}


class TransitMapActivity(BaseActivity):
    activity_type = "transit_map"
    strategies = ["subway", "light_rail", "bus_network", "commuter_rail", "metro"]
    titles = [
        "TRANSIT MAP", "METRO MAP", "ROUTE MAP",
        "SYSTEM MAP", "NETWORK MAP", "RAIL MAP",
    ]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._lines = self._generate_lines()
        self._stations = self._generate_stations()
        self._vehicles = self._generate_vehicles()

    def _generate_lines(self):
        """Generate 5-8 random transit lines with route points."""
        count = random.randint(5, 8)
        names = random.sample(LINE_NAMES[self.strategy], min(count, len(LINE_NAMES[self.strategy])))
        colors = random.sample(LINE_COLORS, count)
        lines = []
        for i in range(count):
            # Generate a route as a series of connected points
            num_points = random.randint(5, 10)
            points = []
            # Start from a random position
            x = random.uniform(0.1, 0.9)
            y = random.uniform(0.1, 0.9)
            for _ in range(num_points):
                points.append({"x": round(x, 3), "y": round(y, 3)})
                # Move in a mostly-consistent direction with some wandering
                x += random.uniform(-0.15, 0.15)
                y += random.uniform(-0.15, 0.15)
                x = max(0.03, min(0.97, x))
                y = max(0.03, min(0.97, y))
            lines.append({
                "color": colors[i],
                "name": names[i] if i < len(names) else f"LINE {i+1}",
                "points": points,
            })
        return lines

    def _generate_stations(self):
        """Place stations along the route lines."""
        used_names = set()
        stations = []
        for li, line in enumerate(self._lines):
            pts = line["points"]
            # Place a station every 2-3 points
            for pi in range(0, len(pts), random.randint(2, 3)):
                pt = pts[pi]
                name = None
                for _ in range(20):
                    candidate = random.choice(STATION_NAMES)
                    if candidate not in used_names:
                        name = candidate
                        used_names.add(candidate)
                        break
                if name is None:
                    name = f"STA-{len(stations)+1}"
                stations.append({
                    "x": pt["x"],
                    "y": pt["y"],
                    "name": name,
                    "line_idx": li,
                })
        return stations

    def _generate_vehicles(self):
        """Place 2-3 vehicles per line with random progress."""
        vehicles = []
        for li in range(len(self._lines)):
            num_vehicles = random.randint(2, 3)
            for _ in range(num_vehicles):
                vehicles.append({
                    "line_idx": li,
                    "progress": round(random.uniform(0.0, 1.0), 3),
                    "speed": round(random.uniform(0.005, 0.02), 4),
                    "direction": random.choice([1, -1]),
                    "label": f"V{random.randint(100, 999)}",
                })
        return vehicles

    def _get_state(self):
        return {
            "lines": self._lines,
            "stations": self._stations,
            "vehicles": [
                {"line_idx": v["line_idx"], "progress": v["progress"], "label": v["label"]}
                for v in self._vehicles
            ],
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        # Move vehicles along their lines
        for v in self._vehicles:
            v["progress"] += v["speed"] * v["direction"]
            # Bounce at ends
            if v["progress"] >= 1.0:
                v["progress"] = 1.0
                v["direction"] = -1
            elif v["progress"] <= 0.0:
                v["progress"] = 0.0
                v["direction"] = 1
            v["progress"] = round(v["progress"], 3)
        return self._get_state()
