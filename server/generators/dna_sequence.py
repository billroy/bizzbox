"""Scrolling DNA / binary / cryptographic sequence generator."""
import random
import math
from .base import BaseActivity

# Character alphabets per strategy
_ALPHABETS: dict[str, str] = {
    "genome_sequencing": "ATCG",
    "binary_stream":     "01",
    "protein_folding":   "ACDEFGHIKLMNPQRSTVWY",
    "cryptanalysis":     "0123456789ABCDEF",
    "virus_signature":   "0123456789ABCDEF",
}

# Highlight labels per strategy
_HIGHLIGHT_LABELS: dict[str, list[str]] = {
    "genome_sequencing": [
        "EXON", "INTRON", "PROMOTER", "CDS", "UTR", "SNP", "REPEAT", "TELOMERE",
        "ENHANCER", "SILENCER", "PRIMER", "ORF",
    ],
    "binary_stream": [
        "HEADER", "PAYLOAD", "CHECKSUM", "OPCODE", "FLAGS", "ADDR", "MAGIC",
        "CRC", "PREAMBLE", "EOF", "SOF", "PADDING",
    ],
    "protein_folding": [
        "ALPHA-HELIX", "BETA-SHEET", "LOOP", "DOMAIN", "MOTIF", "SITE",
        "TERMINUS", "SIGNAL", "CLEAVAGE", "POCKET",
    ],
    "cryptanalysis": [
        "NONCE", "BLOCK", "IV", "TAG", "KEY", "CIPHER", "HMAC", "SALT",
        "PAD", "HEADER", "MAC", "SIG",
    ],
    "virus_signature": [
        "SIGNATURE", "PAYLOAD", "DROPPER", "STUB", "HOOK", "SHELLCODE",
        "NOP-SLED", "OBFUSC", "TRIGGER", "MARKER", "C2-ADDR",
    ],
}

# Annotation message pools per strategy
_ANNOTATIONS: dict[str, list[str]] = {
    "genome_sequencing": [
        "SCANNING...",
        "SEQUENCING STRAND",
        "ALIGNMENT IN PROGRESS",
        "MATCH FOUND AT 0x{hex}",
        "READING FRAME +1",
        "READING FRAME +2",
        "READING FRAME -1",
        "COVERAGE: {pct}%",
        "ASSEMBLY COMPLETE",
        "QUALITY FILTER ACTIVE",
        "MAPPING TO REFERENCE",
        "BASE CALL CONFIDENCE: {pct}%",
    ],
    "binary_stream": [
        "SCANNING...",
        "PARSING BITSTREAM",
        "MATCH FOUND AT 0x{hex}",
        "BIT ERROR RATE: {pct}%",
        "SYNC LOCKED",
        "FRAME ALIGNED",
        "ENTROPY: {pct}%",
        "DECODING STREAM",
        "BUFFER FILL: {pct}%",
        "PROTOCOL DETECTED",
    ],
    "protein_folding": [
        "FOLDING...",
        "ENERGY MINIMIZATION",
        "CONTACT MAP UPDATING",
        "STABILITY: {pct}%",
        "HYDROPHOBIC CORE DETECTED",
        "SECONDARY STRUCTURE ASSIGNED",
        "CLASH SCORE: {pct}",
        "ALIGNMENT SCORE: {pct}",
        "DISORDER PREDICTED",
        "BINDING SITE FOUND",
    ],
    "cryptanalysis": [
        "ANALYZING...",
        "KEY SEARCH IN PROGRESS",
        "MATCH FOUND AT 0x{hex}",
        "ENTROPY: {pct}%",
        "FREQUENCY ANALYSIS ACTIVE",
        "PLAINTEXT CANDIDATE FOUND",
        "BLOCK 0x{hex} DECRYPTED",
        "COLLISION DETECTED",
        "DIFFERENTIAL TRACE ACTIVE",
        "SIDE-CHANNEL SAMPLING",
    ],
    "virus_signature": [
        "SCANNING...",
        "SIGNATURE MATCH AT 0x{hex}",
        "THREAT DETECTED",
        "HEURISTIC LEVEL: {pct}%",
        "UNPACKING LAYER {n}",
        "EMULATION ACTIVE",
        "CLEAN",
        "QUARANTINE CANDIDATE",
        "BEHAVIORAL SCORE: {pct}",
        "ROOTKIT CHECK ACTIVE",
    ],
}

_LINE_LEN = 60
_N_LINES = 20
_MIN_HIGHLIGHT_LEN = 4
_MAX_HIGHLIGHT_LEN = 12
_HIGHLIGHT_PROB = 0.15
_NEW_LINES_PER_FRAME_MIN = 1
_NEW_LINES_PER_FRAME_MAX = 3
# How many frames before annotation can change
_ANNOTATION_CHANGE_PROB = 0.12


def _rand_line(alphabet: str, length: int = _LINE_LEN) -> str:
    return "".join(random.choice(alphabet) for _ in range(length))


def _make_highlight(strategy: str) -> dict:
    start = random.randint(0, _LINE_LEN - _MAX_HIGHLIGHT_LEN - 1)
    length = random.randint(_MIN_HIGHLIGHT_LEN, _MAX_HIGHLIGHT_LEN)
    end = min(start + length, _LINE_LEN - 1)
    label = random.choice(_HIGHLIGHT_LABELS[strategy])
    return {"start": start, "end": end, "label": label}


def _make_line(strategy: str) -> dict:
    alphabet = _ALPHABETS[strategy]
    text = _rand_line(alphabet)
    highlights = []
    if random.random() < _HIGHLIGHT_PROB:
        highlights.append(_make_highlight(strategy))
    return {"text": text, "highlights": highlights}


def _format_annotation(template: str) -> str:
    return (template
            .replace("{hex}", format(random.randint(0, 0xFFFFFF), '06X'))
            .replace("{pct}", str(random.randint(60, 99)))
            .replace("{n}", str(random.randint(1, 5))))


class DnaSequenceActivity(BaseActivity):
    activity_type = "dna_sequence"
    strategies = [
        "genome_sequencing", "binary_stream", "protein_folding",
        "cryptanalysis", "virus_signature",
    ]
    titles = ["GENOME SEQ", "BINARY ANALYSIS", "PROTEIN FOLD", "CRYPTANALYSIS", "VIRUS SCAN"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._lines = [_make_line(self.strategy) for _ in range(_N_LINES)]
        ann_tmpl = random.choice(_ANNOTATIONS[self.strategy])
        self._annotation = _format_annotation(ann_tmpl)
        self._frame = 0

    def _get_state(self) -> dict:
        return {
            "lines": [
                {"text": ln["text"], "highlights": list(ln["highlights"])}
                for ln in self._lines
            ],
            "strategy": self.strategy,
            "annotation": self._annotation,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        self._frame += 1
        # Add 1-3 new lines at the bottom, shift old ones up
        n_new = random.randint(_NEW_LINES_PER_FRAME_MIN, _NEW_LINES_PER_FRAME_MAX)
        new_lines = [_make_line(self.strategy) for _ in range(n_new)]
        self._lines = self._lines[n_new:] + new_lines
        self._last_added = n_new

        # Occasionally update the annotation
        if random.random() < _ANNOTATION_CHANGE_PROB:
            ann_tmpl = random.choice(_ANNOTATIONS[self.strategy])
            self._annotation = _format_annotation(ann_tmpl)

        return self._get_state()

    def compute_delta(self, old_state, new_state):
        n = getattr(self, '_last_added', 0)
        if n and new_state["lines"]:
            return {
                "_delta": True,
                "_limits": {"lines": _N_LINES},
                "append_lines": new_state["lines"][-n:],
                "annotation": new_state["annotation"],
            }
        return None
