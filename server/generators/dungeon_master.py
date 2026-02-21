"""Dungeon master screen — RPG raid encounter tracker with party stats and combat log."""
import random
from .base import BaseActivity


class DungeonMasterActivity(BaseActivity):
    activity_type = "dungeon_master"
    strategies = [
        "dragon_raid",
        "dungeon_crawl",
        "undead_siege",
        "demon_portal",
        "pvp_arena",
    ]
    titles = [
        "RAID STATUS", "ENCOUNTER", "PARTY MONITOR",
        "COMBAT LOG", "DUNGEON MASTER", "RAID TRACKER",
    ]

    _CLASS_POOLS = {
        "dragon_raid":   ["Paladin", "Mage", "Ranger", "Cleric", "Rogue", "Warlock"],
        "dungeon_crawl": ["Fighter", "Wizard", "Thief", "Bard", "Druid", "Monk"],
        "undead_siege":  ["Paladin", "Cleric", "Necromancer", "Ranger", "Warrior", "Priest"],
        "demon_portal":  ["Warlock", "Paladin", "Sorcerer", "Knight", "Shaman", "Assassin"],
        "pvp_arena":     ["Gladiator", "Duelist", "Berserker", "Battlemage", "Shadow", "Champion"],
    }

    _BOSS_NAMES = {
        "dragon_raid":   ["DRAKONITH", "SMAURGON", "VYRMTHAS", "SCORCHFANG"],
        "dungeon_crawl": ["THE LICH KING", "MIND FLAYER", "BEHOLDER", "MIMIC LORD"],
        "undead_siege":  ["BONE EMPEROR", "PLAGUE LORD", "WRAITH KING", "DEATHKNIGHT"],
        "demon_portal":  ["AZMODAN", "BALOR LORD", "PIT FIEND", "DEMON PRINCE"],
        "pvp_arena":     ["CHAMPION ZARA", "THE UNDEFEATED", "WARLORD KRIX", "GRAND MASTER"],
    }

    _PLAYER_NAMES = [
        "xXDarkSlayerXx", "Healbot9000", "TankMcTankface", "ArrowsOnly",
        "CritFisher", "NotABot", "LootGoblin", "AggroMagnet",
        "BardOfDoom", "StealthyBoi", "NerfMe", "BuffMePlz",
        "RNGesus", "PullTimer", "DontStandInFire", "ManaAddict",
    ]

    _ABILITIES = [
        "Fireball", "Smite", "Backstab", "Heal", "Shield Bash",
        "Lightning Bolt", "Arrow Volley", "Holy Light", "Shadow Strike",
        "Frost Nova", "Cleave", "Summon Elemental", "Poison Dagger",
        "Divine Shield", "Chain Lightning", "Meteor Strike",
    ]

    _STATUS_EFFECTS = [
        "Burning", "Poisoned", "Stunned", "Blessed", "Hasted",
        "Shielded", "Weakened", "Frozen", "Enraged", "Silenced",
    ]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._boss = self._make_boss()
        self._party = self._build_party()
        self._combat_log = []
        self._boss_phase = 1
        self._elapsed_sec = 0
        # Generate some initial combat log entries
        for _ in range(5):
            self._generate_log_entry()

    def _make_boss(self):
        return {
            "name": random.choice(self._BOSS_NAMES[self.strategy]),
            "hp_pct": 100,
            "phase": 1,
            "max_phases": random.randint(2, 4),
            "enrage_timer": random.randint(180, 360),
            "status_effects": [],
        }

    def _build_party(self):
        classes = self._CLASS_POOLS[self.strategy]
        names = random.sample(self._PLAYER_NAMES, min(6, len(self._PLAYER_NAMES)))
        party = []
        for i, name in enumerate(names):
            cls = classes[i % len(classes)]
            max_hp = random.randint(800, 3000)
            max_mp = random.randint(200, 1500)
            party.append({
                "name": name,
                "class": cls,
                "hp": max_hp,
                "max_hp": max_hp,
                "mp": max_mp,
                "max_mp": max_mp,
                "status_effects": [],
                "dps": random.randint(50, 400),
                "alive": True,
            })
        return party

    def _generate_log_entry(self):
        alive = [p for p in self._party if p["alive"]]
        if not alive:
            return
        player = random.choice(alive)
        ability = random.choice(self._ABILITIES)
        damage = random.randint(50, 800)
        entries = [
            f"{player['name']} casts {ability} for {damage} dmg",
            f"{self._boss['name']} strikes {player['name']} for {damage} dmg",
            f"{player['name']} heals for {damage // 2} HP",
            f"{player['name']} lands a CRITICAL {ability}! {damage * 2} dmg",
            f"{self._boss['name']} uses AOE — party takes {damage // 3} dmg each",
        ]
        entry = random.choice(entries)
        self._combat_log.append(entry)
        if len(self._combat_log) > 12:
            self._combat_log = self._combat_log[-12:]

    def _get_state(self):
        return {
            "boss": dict(self._boss),
            "party": [dict(p) for p in self._party],
            "combat_log": list(self._combat_log),
            "boss_phase": self._boss_phase,
            "elapsed_sec": self._elapsed_sec,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        # Strip party name/class/max_hp/max_mp (static until boss reset)
        party = []
        for p in new_state["party"]:
            party.append({
                "hp": p["hp"],
                "mp": p["mp"],
                "status_effects": p["status_effects"],
                "dps": p["dps"],
                "alive": p["alive"],
            })
        return {
            "_delta": True,
            "boss": new_state["boss"],
            "party": party,
            "combat_log": new_state["combat_log"],
            "boss_phase": new_state["boss_phase"],
            "elapsed_sec": new_state["elapsed_sec"],
        }

    def next_frame(self) -> dict:
        self._elapsed_sec += 1

        # Boss HP drain
        total_dps = sum(p["dps"] for p in self._party if p["alive"])
        drain = total_dps * 0.003 * random.uniform(0.5, 1.5)
        self._boss["hp_pct"] = max(0, round(self._boss["hp_pct"] - drain * 0.05, 1))

        # Phase transitions
        phase_thresholds = [75, 50, 25]
        for i, threshold in enumerate(phase_thresholds):
            if self._boss["hp_pct"] <= threshold and self._boss_phase <= i + 1:
                self._boss_phase = i + 2
                self._boss["phase"] = self._boss_phase
                self._combat_log.append(f"** {self._boss['name']} enters PHASE {self._boss_phase}! **")

        # Boss enrage timer
        self._boss["enrage_timer"] = max(0, self._boss["enrage_timer"] - 1)

        # Boss reset when dead
        if self._boss["hp_pct"] <= 0:
            self._combat_log.append(f"** {self._boss['name']} DEFEATED! **")
            self._boss = self._make_boss()
            self._boss_phase = 1
            # Restore party
            for p in self._party:
                p["hp"] = p["max_hp"]
                p["mp"] = p["max_mp"]
                p["alive"] = True

        # Party damage/healing
        for player in self._party:
            if not player["alive"]:
                # Chance to resurrect
                if random.random() < 0.02:
                    player["alive"] = True
                    player["hp"] = player["max_hp"] // 2
                    self._combat_log.append(f"{player['name']} has been resurrected!")
                continue

            # Take boss damage
            if random.random() < 0.15 * (self.intensity / 10.0):
                dmg = random.randint(50, 300) * self._boss_phase
                player["hp"] = max(0, player["hp"] - dmg)
                if player["hp"] == 0:
                    player["alive"] = False
                    self._combat_log.append(f"{player['name']} has been slain!")

            # Healing
            if random.random() < 0.2:
                heal = random.randint(30, 150)
                player["hp"] = min(player["max_hp"], player["hp"] + heal)

            # MP drain/regen
            player["mp"] = max(0, min(player["max_mp"],
                player["mp"] + random.randint(-20, 15)))

            # DPS fluctuation
            player["dps"] = max(0, player["dps"] + random.randint(-20, 20))

            # Status effects
            if random.random() < 0.05:
                effect = random.choice(self._STATUS_EFFECTS)
                if effect not in player["status_effects"]:
                    player["status_effects"].append(effect)
                    if len(player["status_effects"]) > 3:
                        player["status_effects"] = player["status_effects"][-3:]
            elif player["status_effects"] and random.random() < 0.1:
                player["status_effects"].pop(0)

        # Generate combat log entry
        if random.random() < 0.6:
            self._generate_log_entry()

        if len(self._combat_log) > 12:
            self._combat_log = self._combat_log[-12:]

        return self._get_state()
