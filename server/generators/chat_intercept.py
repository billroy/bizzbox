"""Intercepted communications feed — classified military/intelligence chat messages."""
import random
import uuid
import time
from .base import BaseActivity


# Callsign prefix pool
_CALLSIGN_PREFIXES = [
    "FALCON", "BRAVO", "EAGLE", "VIPER", "SHADOW", "OMEGA", "DELTA",
    "RAVEN", "PHOENIX", "TITAN", "COBRA", "WOLF", "SPECTER", "TALON",
    "RAPTOR", "ANVIL", "CRIMSON", "DAGGER", "FROSTBITE", "GRANITE",
    "HAMMER", "JAGUAR", "KODIAK", "LANCE", "MUSTANG", "NIGHTHAWK",
    "ONYX", "PYTHON", "REAPER", "STINGER", "TRIDENT", "WARDEN",
]

# Names used for "{NAME} ACTUAL" style callsigns
_ACTUAL_NAMES = [
    "OVERLORD", "KINGPIN", "SUNDOWN", "BLACKJACK", "IRONSIDE",
    "CROSSBOW", "FIRESTORM", "WATCHDOG", "LIGHTHOUSE", "THUNDERBOLT",
    "SABRE", "PATRIOT", "VANGUARD", "SENTINEL", "BASTION",
]

# Classification levels and their redaction percentages (min, max)
_CLASSIFICATIONS = {
    "UNCLASSIFIED":  (0.00, 0.05),
    "CONFIDENTIAL":  (0.10, 0.20),
    "SECRET":        (0.25, 0.40),
    "TOP SECRET":    (0.40, 0.60),
}

_CLASSIFICATION_WEIGHTS = {
    "military_comms":     [("UNCLASSIFIED", 10), ("CONFIDENTIAL", 40), ("SECRET", 35), ("TOP SECRET", 15)],
    "diplomatic_cable":   [("UNCLASSIFIED", 5),  ("CONFIDENTIAL", 25), ("SECRET", 45), ("TOP SECRET", 25)],
    "field_ops":          [("UNCLASSIFIED", 15), ("CONFIDENTIAL", 35), ("SECRET", 35), ("TOP SECRET", 15)],
    "cyber_intel":        [("UNCLASSIFIED", 5),  ("CONFIDENTIAL", 20), ("SECRET", 40), ("TOP SECRET", 35)],
    "emergency_dispatch": [("UNCLASSIFIED", 40), ("CONFIDENTIAL", 35), ("SECRET", 20), ("TOP SECRET", 5)],
}

# Message template pools per strategy
# Templates use {GRID}, {FREQ}, {NUM}, {UNIT}, {ZONE}, {TIME} placeholders
_MESSAGE_TEMPLATES = {
    "military_comms": [
        "Convoy Alpha proceeding through checkpoint {GRID}. No hostile contact. Request route clearance for secondary approach.",
        "Artillery battery at grid {GRID} reports ammunition expenditure at forty percent. Requesting resupply priority {NUM}.",
        "Air defense network sector {ZONE} reports unidentified track bearing {NUM} degrees. Attempting IFF interrogation.",
        "Forward observer confirms target coordinates {GRID}. Fire mission authorized. Adjust elevation plus {NUM} mils.",
        "QRF deployed from staging area {ZONE}. ETA to contact point is {NUM} minutes. Maintain overwatch on route.",
        "Enemy signals intercepted on frequency {FREQ} megahertz. Pattern suggests battalion-level coordination in sector {ZONE}.",
        "Medevac request for two priority urgent casualties at grid {GRID}. Landing zone is cold. Pop smoke on approach.",
        "Perimeter breach detected at sector {ZONE} northwest quadrant. Dispatching reaction force. All units stand to.",
        "Logistics train holding at phase line {UNIT}. Road conditions degraded. Engineer assessment required before proceeding.",
        "Rotary wing assets inbound from the south. Flight of two at altitude {NUM} feet. Confirm friendly corridor is open.",
        "Unmanned aerial surveillance over grid {GRID} shows movement of twelve vehicles heading eastbound on main supply route.",
        "Counter-mortar radar detected point of origin at {GRID}. Fire mission submitted for immediate suppression.",
        "Bridge assessment complete at crossing site {ZONE}. Maximum load class {NUM}. Heavy armor must use alternate route.",
        "Communications relay at hilltop {GRID} is operational. All subordinate units switch to alternate frequency {FREQ}.",
        "Night vision observation post reports foot patrol of approximately eight personnel moving through grid {GRID}.",
    ],
    "diplomatic_cable": [
        "Embassy {ZONE} reports host nation foreign minister expressed concern over recent naval exercises in the region.",
        "Station chief advises summit bilateral scheduled for {NUM} hundred hours. Principal requests updated threat brief.",
        "Trade delegation from sector {ZONE} presented revised terms. Tariff reduction of {NUM} percent on industrial goods under review.",
        "Source CARDINAL reports internal power struggle within ruling coalition. Defense minister faction gaining influence.",
        "Ambassador requests immediate guidance on evacuation planning. Civil unrest in capital has escalated significantly.",
        "Naval attache confirms host nation acquired patrol vessels from third-party supplier. Delivery expected within {NUM} days.",
        "Cultural exchange program cover operation in sector {ZONE} proceeding on schedule. No indicators of compromise.",
        "Economic reporting cable: central bank reserves depleted by {NUM} percent. Currency devaluation anticipated within quarter.",
        "Political officer assessment: opposition leader under house arrest since day {NUM}. International community response muted.",
        "Station {ZONE} reports new intelligence sharing agreement between host nation and regional adversary. Details forthcoming.",
        "Visa section flagged {NUM} applications with inconsistent biographic data matching known alias patterns in database.",
        "Defense cooperation agreement signing postponed. Host nation parliament demands renegotiation of basing rights in sector {ZONE}.",
        "Humanitarian corridor negotiations stalled at checkpoint {GRID}. Both parties accuse each other of violations.",
        "Source NIGHTINGALE provides updated order of battle for host nation ground forces. Significant restructuring observed.",
        "Regional stability assessment: probability of interstate conflict elevated to {NUM} percent. Recommend posture adjustment.",
    ],
    "field_ops": [
        "Team VIPER in position at observation point {GRID}. Eyes on target building. No movement for the last {NUM} minutes.",
        "Extraction vehicle staged at rally point {ZONE}. Window opens at {TIME} hours local. All elements confirm ready.",
        "Asset meeting confirmed for grid {GRID}. Cover status intact. Handler will approach from the market side.",
        "Surveillance reports target left residence at {TIME} hours accompanied by two unknown males. Vehicle is dark sedan.",
        "Dead drop serviced at site {ZONE}. Contents recovered and sent to processing. Next scheduled service in {NUM} days.",
        "Team has crossed the phase line at {GRID}. Moving to secondary objective. Request drone coverage for {NUM} minutes.",
        "Counterintelligence sweep of safehouse at grid {GRID} complete. No electronic devices detected. Location is clean.",
        "Target communications device cloned successfully during brush pass at location {ZONE}. Data extraction in progress.",
        "Advance element reports bridge at {GRID} is intact but under observation. Recommend crossing during limited visibility.",
        "Ground truth confirms imagery analysis. Facility at grid {GRID} has three new structures consistent with storage.",
        "Local contact reports increased checkpoint activity in sector {ZONE}. Alternate infiltration route may be required.",
        "Thermal imaging from OP {ZONE} shows {NUM} personnel inside compound. Two appear to be posted as sentries.",
        "Cache site at grid {GRID} compromised. Local nationals observed in the area. Recommend immediate sanitization.",
        "Team leader requests abort authority for phase two. Conditions on the ground have changed since last brief.",
        "Mobile surveillance unit tracking target vehicle northbound on highway {NUM}. Speed consistent with normal travel.",
    ],
    "cyber_intel": [
        "Malware sample recovered from node {GRID} matches signature associated with threat group COZY LYNX. Analyzing payload.",
        "Network intrusion detected on subnet {FREQ}. Lateral movement observed across {NUM} endpoints. Containment initiated.",
        "Dark web monitoring flagged auction of stolen credentials from sector {ZONE} infrastructure. Approximately {NUM} records.",
        "Phishing campaign targeting personnel in sector {ZONE} uses compromised domain mimicking internal portal. Takedown requested.",
        "Threat actor established persistence via scheduled task on server {GRID}. Beacon interval is {NUM} seconds to C2 node.",
        "Decrypted traffic from node {GRID} reveals exfiltration of engineering schematics. Data volume approximately {NUM} megabytes.",
        "Zero-day exploit targeting firmware version {NUM} confirmed in the wild. All assets in sector {ZONE} are vulnerable.",
        "Honeypot at grid {GRID} captured automated scanning from {NUM} unique source addresses. Patterns suggest coordinated recon.",
        "Supply chain compromise identified in software package deployed across sector {ZONE}. Backdoor activates on version {NUM}.",
        "Signals intelligence correlates IP address at node {GRID} with known command and control infrastructure for APT group.",
        "Cryptographic key material recovered from memory dump of compromised workstation. Affects {NUM} encrypted channels in sector {ZONE}.",
        "Forensic analysis of server {GRID} confirms data wiping tool executed at {TIME} hours. Recovery of {NUM} percent possible.",
        "Botnet traffic spike detected. Approximately {NUM} thousand compromised nodes sending beacons to controller in sector {ZONE}.",
        "Email header analysis reveals forged sender domain routing through relay at node {GRID}. Campaign active for {NUM} days.",
        "Insider threat indicators flagged: user at station {ZONE} accessed {NUM} classified documents outside normal work pattern.",
    ],
    "emergency_dispatch": [
        "All units vicinity grid {GRID}: reports of explosion at industrial complex. First responders requested. Establish perimeter.",
        "Dispatch confirms multiple casualty event at sector {ZONE}. Triage area established. Additional ambulances en route, ETA {NUM} min.",
        "Hazardous materials team requested at grid {GRID}. Unknown chemical release from overturned transport vehicle on highway.",
        "Evacuation order issued for sector {ZONE} within {NUM} kilometer radius. Wind direction carrying plume northeast.",
        "Search and rescue teams deployed to grid {GRID}. Structure collapse with estimated {NUM} occupants unaccounted for.",
        "Wildfire advancing on residential area sector {ZONE}. Rate of spread {NUM} acres per hour. Air support requested.",
        "Flash flood warning for all units in sector {ZONE}. Water levels rising rapidly. Evacuate low-lying positions immediately.",
        "Active threat reported at facility grid {GRID}. Law enforcement on scene. All civilian traffic diverted from area.",
        "Power grid failure affecting sector {ZONE}. Approximately {NUM} thousand residents without electricity. Backup generators deploying.",
        "Maritime distress signal received from coordinates {GRID}. Vessel reports {NUM} souls on board. Coast guard responding.",
        "Bridge structural integrity compromised at grid {GRID}. All vehicular and foot traffic halted pending engineering assessment.",
        "Communications tower at site {ZONE} damaged by storm. Backup relay {FREQ} activated. Coverage degraded by {NUM} percent.",
        "Medical helicopter requested for critical patient at grid {GRID}. Landing zone is parking structure rooftop level {NUM}.",
        "Train derailment reported near sector {ZONE}. {NUM} cars off track. No hazardous cargo per manifest. Injuries unknown.",
        "Earthquake aftershock measured at magnitude {NUM}. All teams maintain situational awareness. Reassess structural safety before entry.",
    ],
}


def _gen_callsign() -> str:
    """Generate a random callsign like FALCON-17 or OVERLORD ACTUAL."""
    if random.random() < 0.2:
        return f"{random.choice(_ACTUAL_NAMES)} ACTUAL"
    prefix = random.choice(_CALLSIGN_PREFIXES)
    num = random.randint(1, 99)
    return f"{prefix}-{num:02d}"


def _pick_classification(strategy: str) -> str:
    """Pick a classification level with strategy-appropriate weighting."""
    levels, weights = zip(*_CLASSIFICATION_WEIGHTS[strategy])
    return random.choices(levels, weights=weights, k=1)[0]


def _redact_message(text: str, classification: str) -> str:
    """Replace a percentage of words with [REDACTED] based on classification level."""
    lo, hi = _CLASSIFICATIONS[classification]
    redact_pct = random.uniform(lo, hi)
    words = text.split()
    if not words:
        return text
    num_to_redact = max(0, int(len(words) * redact_pct))
    if num_to_redact == 0:
        return text
    # Choose random word indices to redact (prefer longer words for realism)
    candidates = [i for i, w in enumerate(words) if len(w) > 3]
    if len(candidates) < num_to_redact:
        candidates = list(range(len(words)))
    indices = set(random.sample(candidates, min(num_to_redact, len(candidates))))
    result = []
    for i, word in enumerate(words):
        if i in indices:
            result.append("[REDACTED]")
        else:
            result.append(word)
    return " ".join(result)


def _fill_template(template: str) -> str:
    """Replace placeholders in a message template with random values."""
    replacements = {
        "{GRID}": f"{random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ')}{random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ')}-{random.randint(1000, 9999)}",
        "{FREQ}": f"{random.randint(30, 400)}.{random.randint(0, 99):02d}",
        "{NUM}": str(random.randint(2, 97)),
        "{UNIT}": random.choice(["ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOXTROT", "GOLF", "HOTEL"]),
        "{ZONE}": random.choice(["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"]) + "-" + str(random.randint(1, 9)),
        "{TIME}": f"{random.randint(0, 23):02d}{random.randint(0, 59):02d}",
    }
    result = template
    for k, v in replacements.items():
        result = result.replace(k, v)
    return result


class ChatInterceptActivity(BaseActivity):
    activity_type = "chat_intercept"
    strategies = [
        "military_comms",
        "diplomatic_cable",
        "field_ops",
        "cyber_intel",
        "emergency_dispatch",
    ]
    titles = [
        "COMMS INTERCEPT",
        "SIGINT FEED",
        "INTEL STREAM",
        "CLASSIFIED FEED",
        "INTERCEPT LOG",
    ]

    MAX_MESSAGES = 8

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._templates = _MESSAGE_TEMPLATES[self.strategy]
        self._messages = []
        self._msg_counter = 0
        # Seed the initial message buffer
        for _ in range(random.randint(3, self.MAX_MESSAGES)):
            self._generate_message()

    def _generate_message(self):
        """Create a single intercepted message and append it to the buffer."""
        self._msg_counter += 1
        classification = _pick_classification(self.strategy)
        raw_body = _fill_template(random.choice(self._templates))
        body = _redact_message(raw_body, classification)

        callsign_from = _gen_callsign()
        callsign_to = _gen_callsign()
        # Ensure sender and receiver are different
        while callsign_to == callsign_from:
            callsign_to = _gen_callsign()

        msg = {
            "id": f"msg_{self._msg_counter:04d}_{uuid.uuid4().hex[:6]}",
            "timestamp": time.strftime("%H:%M:%S", time.gmtime()),
            "callsign_from": callsign_from,
            "callsign_to": callsign_to,
            "body": body,
            "classification": classification,
        }
        self._messages.append(msg)
        # Trim to max
        if len(self._messages) > self.MAX_MESSAGES:
            self._messages = self._messages[-self.MAX_MESSAGES:]

    def _get_state(self) -> dict:
        return {
            "messages": list(self._messages),
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        # Probability of a new message scales with intensity (1-10)
        # At intensity 1: ~30% chance, at intensity 10: ~95% chance
        probability = 0.25 + (self.intensity / 10.0) * 0.70
        if random.random() < probability:
            self._generate_message()
        # Small chance of a second message burst at higher intensities
        if self.intensity >= 6 and random.random() < (self.intensity - 5) * 0.08:
            self._generate_message()
        return self._get_state()
