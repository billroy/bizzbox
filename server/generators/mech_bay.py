"""Mech bay / giant robot maintenance and loadout station with subsystem status."""
import random
from .base import BaseActivity


class MechBayActivity(BaseActivity):
    activity_type = "mech_bay"
    strategies = [
        "assault_mech",
        "scout_mech",
        "siege_mech",
        "support_mech",
        "stealth_mech",
    ]
    titles = [
        "MECH BAY", "LOADOUT", "MECH STATUS", "HANGAR",
        "UNIT READINESS", "BAY MONITOR", "FRAME STATUS",
    ]

    _MECH_NAMES = {
        "assault_mech":  ["ATLAS", "MARAUDER", "WARHAMMER", "BATTLEMASTER", "HIGHLANDER"],
        "scout_mech":    ["LOCUST", "SPIDER", "RAVEN", "FIRESTARTER", "JENNER"],
        "siege_mech":    ["ANNIHILATOR", "KING CRAB", "DEMOLISHER", "DEVASTATOR", "STALKER"],
        "support_mech":  ["HUNCHBACK", "CATAPULT", "ARCHER", "LONGBOW", "VULTURE"],
        "stealth_mech":  ["PHANTOM", "SPECTER", "WRAITH", "SHADOW", "GHOST"],
    }

    # Limb/section definitions: (id, label, y_frac on wireframe)
    _SECTIONS = [
        ("head",       "HEAD",       0.05),
        ("torso_ct",   "CENTER TORSO", 0.20),
        ("torso_lt",   "LEFT TORSO",   0.20),
        ("torso_rt",   "RIGHT TORSO",  0.20),
        ("arm_la",     "LEFT ARM",     0.35),
        ("arm_ra",     "RIGHT ARM",    0.35),
        ("leg_ll",     "LEFT LEG",     0.65),
        ("leg_rl",     "RIGHT LEG",    0.65),
    ]

    _WEAPON_POOLS = {
        "assault_mech":  ["AC/20", "PPC", "LRM-20", "SRM-6", "LRG LASER", "MED LASER", "GAUSS"],
        "scout_mech":    ["MED LASER", "SRM-2", "MG", "TAG", "FLAMER", "SML LASER"],
        "siege_mech":    ["AC/20", "LRM-20", "LRM-15", "PPC", "LRG LASER", "GAUSS", "UAC/5"],
        "support_mech":  ["LRM-20", "LRM-15", "LRM-10", "SRM-6", "PPC", "LRG LASER", "NARC"],
        "stealth_mech":  ["ER MED LASER", "STREAK SRM-4", "ECM", "TAG", "ER SML LASER", "LBX-10"],
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._mech_name = random.choice(self._MECH_NAMES[self.strategy])
        self._sections = self._build_sections()
        self._weapons = self._build_weapons()
        self._coolant = round(random.uniform(60.0, 100.0), 1)
        self._neural_link = round(random.uniform(80.0, 100.0), 1)
        self._heat = round(random.uniform(10.0, 40.0), 1)
        self._reactor_output = round(random.uniform(70.0, 100.0), 1)

    def _build_sections(self):
        sections = []
        for sid, label, y_frac in self._SECTIONS:
            armor = random.randint(60, 100)
            sections.append({
                "id": sid,
                "label": label,
                "y_frac": y_frac,
                "armor_pct": armor,
                "internal_pct": 100,
                "servo_status": "nominal",
            })
        return sections

    def _build_weapons(self):
        pool = self._WEAPON_POOLS[self.strategy]
        count = random.randint(4, 7)
        weapons = []
        for i in range(count):
            w = random.choice(pool)
            mount = random.choice(["arm_la", "arm_ra", "torso_lt", "torso_rt", "torso_ct"])
            weapons.append({
                "name": w,
                "mount": mount,
                "status": "ready",
                "ammo_pct": random.randint(50, 100) if "LASER" not in w and "PPC" not in w and "FLAMER" not in w else None,
            })
        return weapons

    def _get_state(self):
        return {
            "mech_name": self._mech_name,
            "sections": [dict(s) for s in self._sections],
            "weapons": [dict(w) for w in self._weapons],
            "coolant_pct": self._coolant,
            "neural_link_pct": self._neural_link,
            "heat_pct": self._heat,
            "reactor_output_pct": self._reactor_output,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        # Drift coolant, neural link, heat, reactor
        self._coolant = round(max(20.0, min(100.0, self._coolant + random.uniform(-1.5, 1.5))), 1)
        self._neural_link = round(max(50.0, min(100.0, self._neural_link + random.uniform(-0.5, 0.5))), 1)
        self._heat = round(max(5.0, min(95.0, self._heat + random.uniform(-2.0, 2.0))), 1)
        self._reactor_output = round(max(60.0, min(100.0, self._reactor_output + random.uniform(-1.0, 1.0))), 1)

        # Section damage/repair drift
        for section in self._sections:
            if random.random() < 0.04 * (self.intensity / 10.0):
                section["armor_pct"] = max(0, section["armor_pct"] - random.randint(1, 5))
            elif random.random() < 0.06:
                section["armor_pct"] = min(100, section["armor_pct"] + random.randint(1, 3))

            # Servo status flicker
            if random.random() < 0.02:
                section["servo_status"] = random.choice(["nominal", "degraded", "fault"])
            elif section["servo_status"] != "nominal" and random.random() < 0.1:
                section["servo_status"] = "nominal"

        # Weapon status drift
        for weapon in self._weapons:
            if random.random() < 0.02:
                weapon["status"] = random.choice(["ready", "cycling", "jammed", "offline"])
            elif weapon["status"] != "ready" and random.random() < 0.15:
                weapon["status"] = "ready"
            if weapon["ammo_pct"] is not None:
                weapon["ammo_pct"] = max(0, weapon["ammo_pct"] - random.randint(0, 1))

        return self._get_state()
