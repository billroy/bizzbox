"""Animated cipher/decrypt text effect generator."""
import random
import string
from .base import BaseActivity

_GARBLE_CHARS = string.ascii_uppercase + string.digits + "!@#$%^&*<>{}[]|/\\"

# Plaintext message pools per strategy
_MESSAGES = {
    "military_decrypt": [
        "PRIORITY ALPHA: COMMENCE OPERATION NIGHTFALL AT 0200 ZULU",
        "ASSET CONFIRMED AT GRID REF 48N 12E EXTRACTION PENDING",
        "AUTHORIZE LAUNCH SEQUENCE DELTA SEVEN NINER",
        "SIGINT INTERCEPT: HOSTILE FORCES MOVING SOUTH",
        "FLASH TRAFFIC: DEFCON STATUS CHANGE IMMINENT",
        "ECHELON REPORT: TARGET ACQUIRED SECTOR SEVEN",
        "EYES ONLY: AGENT HANDLER COMPROMISED EVACUATE",
        "TACTICAL UPDATE: AIR SUPPORT INBOUND ETA 15 MIKES",
    ],
    "password_crack": [
        "HASH: 5F4DCC3B5AA765D61D8327DEB882CF99 >> password",
        "BCRYPT $2B$12$SALT >> CRACKED: hunter2",
        "SHA256: A665A459...F0D >> PLAINTEXT: letmein",
        "NTLM: 32ED87BDB5FDC5E9CBA8 >> admin123",
        "MD5 COLLISION FOUND AT ITERATION 847293",
        "RAINBOW TABLE HIT: OFFSET 0x4F2A10",
        "DICTIONARY ATTACK: 12847 OF 14344287 TESTED",
        "GPU CLUSTER: 9.8 BILLION HASHES PER SECOND",
    ],
    "enigma_decode": [
        "ROTOR SETTING III-I-IV RING AAZ PLUG AB CD EF",
        "DECODED: U-BOAT WOLFPACK ASSEMBLING GRID AL-4920",
        "BLETCHLEY INTERCEPT 0742: CONVOY ROUTE COMPROMISED",
        "ENIGMA M4: SHARK KEY BROKEN FOR 12 MARCH 1943",
        "BOMBE RUN COMPLETE: MENU CONFIRMED AT POSITION 7",
        "TUNNY DECRYPT: PANZER DIVISION REDEPLOYING EAST",
        "LORENZ SZ42 WHEEL PATTERN: CHI-1 DELTA VERIFIED",
        "COLOSSUS RESULT: STATISTICAL MATCH AT THRESHOLD 0.7",
    ],
    "rsa_factoring": [
        "N = 1147 = 31 * 37  FACTORED IN 0.003MS",
        "SIEVING: 847291 RELATIONS COLLECTED OF 900000",
        "LATTICE REDUCTION: BASIS VECTOR FOUND DIM 256",
        "QUANTUM REGISTER: 2048 QUBITS ALLOCATED",
        "SHOR ALGORITHM: PERIOD r=42 FOUND FOR a=7",
        "CONTINUED FRACTION EXPANSION CONVERGENT K=17",
        "QUADRATIC SIEVE: SMOOTH NUMBERS B=46340",
        "GNFS: POLYNOMIAL SELECTION COMPLETE DEG 5",
    ],
    "alien_signal": [
        "FREQUENCY 1420.405 MHZ: HYDROGEN LINE ANOMALY",
        "PATTERN DETECTED: NON-RANDOM PRIME SEQUENCE",
        "DECODED SYMBOL SET: 64 UNIQUE GLYPHS IDENTIFIED",
        "SIGNAL ORIGIN: RA 19H 25M DEC +20D 11M",
        "BITSTREAM CONTAINS EMBEDDED MATHEMATICAL CONSTANTS",
        "MESSAGE STRUCTURE: HEADER + 4096 BYTE PAYLOAD",
        "TRANSLATION MATRIX: 73% CONFIDENCE ON GRAMMAR",
        "RESPONSE PROTOCOL: ISOTROPIC BEACON RECOMMENDED",
    ],
}

_LINE_COUNT = 6
_RESOLVE_STEPS = 30  # frames to fully resolve


class CipherDecryptActivity(BaseActivity):
    activity_type = "cipher_decrypt"
    strategies = list(_MESSAGES.keys())
    titles = ["CIPHER CRACK", "DECRYPTION", "CODE BREAK", "DECRYPT OPS", "DECIPHER"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._lines = [self._new_line() for _ in range(_LINE_COUNT)]

    def _new_line(self) -> dict:
        msg = random.choice(_MESSAGES[self.strategy])
        return {
            "plaintext": msg,
            "progress": 0,  # 0 = fully garbled, _RESOLVE_STEPS = fully revealed
            "max_steps": _RESOLVE_STEPS + random.randint(-5, 10),
            "hold_frames": 0,
            "status": "decrypting",
        }

    def _garble(self, text: str, progress: int, max_steps: int) -> str:
        """Return text with some characters still garbled based on progress."""
        if progress >= max_steps:
            return text
        result = []
        for i, ch in enumerate(text):
            # Each character resolves at a different time based on its position
            char_threshold = (i * max_steps) / max(1, len(text))
            if progress >= char_threshold or ch == ' ':
                result.append(ch)
            else:
                result.append(random.choice(_GARBLE_CHARS))
        return "".join(result)

    def _get_state(self) -> dict:
        return {
            "lines": [
                {
                    "text": self._garble(ln["plaintext"], ln["progress"], ln["max_steps"]),
                    "progress": round(ln["progress"] / ln["max_steps"], 3),
                    "status": ln["status"],
                }
                for ln in self._lines
            ],
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        # Stagger initial progress
        for i, ln in enumerate(self._lines):
            ln["progress"] = int(i * ln["max_steps"] / _LINE_COUNT * 0.7)
        return self._get_state()

    def next_frame(self) -> dict:
        for ln in self._lines:
            if ln["status"] == "decrypting":
                ln["progress"] += 1
                if ln["progress"] >= ln["max_steps"]:
                    ln["progress"] = ln["max_steps"]
                    ln["status"] = "complete"
                    ln["hold_frames"] = 0
            elif ln["status"] == "complete":
                ln["hold_frames"] += 1
                if ln["hold_frames"] > random.randint(10, 25):
                    # Reset with a new message
                    new = self._new_line()
                    ln["plaintext"] = new["plaintext"]
                    ln["progress"] = 0
                    ln["max_steps"] = new["max_steps"]
                    ln["hold_frames"] = 0
                    ln["status"] = "decrypting"
        return self._get_state()
