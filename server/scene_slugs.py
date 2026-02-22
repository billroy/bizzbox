"""
Mapping of URL slugs to built-in scene names for vanity URLs.
"""
import re


def slugify(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


SCENE_SLUGS = {
    'war-room': 'War Room',
    'ambient': 'Ambient',
    'hacker-den': 'Hacker Den',
    'mission-control': 'Mission Control',
    'surveillance': 'Surveillance',
    'chaos': 'Chaos',
    'starship-bridge': 'Starship Bridge',
    'mech-hangar': 'Mech Hangar',
    'planet-forge': 'Planet Forge',
    'dungeon-crawl': 'Dungeon Crawl',
    'launch-day': 'Launch Day',
    'abyss': 'Abyss',
    'firebreak': 'Firebreak',
    'transit-hub': 'Transit Hub',
    'bio-lab': 'Bio Lab',
    'cyber-siege': 'Cyber Siege',
    'coral-reef': 'Coral Reef',
    'ironworks': 'Ironworks',
    'neon-dreams': 'Neon Dreams',
    'thermal-scan': 'Thermal Scan',
    'deep-green': 'Deep Green',
    'architect': 'Architect',
    'golden-hour': 'Golden Hour',
    'jungle-outpost': 'Jungle Outpost',
    'eruption': 'Eruption',
    'frozen-vault': 'Frozen Vault',
    'agent-den': 'Agent Den',
    'feature-zoo': 'Feature Zoo',
}

SCENE_NAMES_TO_SLUGS = {v: k for k, v in SCENE_SLUGS.items()}
