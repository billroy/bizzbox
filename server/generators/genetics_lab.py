"""Genetics lab — CRISPR gene editing sequencer with base pair alignment and cell viability."""
import random
from .base import BaseActivity


class GeneticsLabActivity(BaseActivity):
    activity_type = "genetics_lab"
    strategies = [
        "crispr_editing",
        "gene_therapy",
        "forensic_dna",
        "synthetic_biology",
        "ancient_dna",
    ]
    titles = [
        "GENE SEQ", "CRISPR LAB", "SEQUENCER",
        "GENETICS", "DNA ANALYSIS", "GENOME EDIT",
    ]

    _BASES = "ACGT"
    _SEQ_LENGTH = 60  # visible portion of scrolling sequence

    _GENE_TARGETS = {
        "crispr_editing":   ["BRCA1", "TP53", "CFTR", "HBB", "FOXP2"],
        "gene_therapy":     ["DMD", "SMN1", "F8", "RPE65", "HEXA"],
        "forensic_dna":     ["CODIS-D3", "CODIS-D5", "CODIS-D7", "CODIS-D8", "CODIS-D13"],
        "synthetic_biology": ["GFP", "LacZ", "CAS9", "T7-PROM", "RBS-34"],
        "ancient_dna":      ["MT-COI", "CYTB", "ND5", "16S-rRNA", "ITS2"],
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._gene_target = random.choice(self._GENE_TARGETS[self.strategy])
        self._sequence = self._generate_sequence(120)
        self._guide_rna = self._generate_sequence(20)
        self._scroll_offset = 0
        self._edit_sites = self._find_edit_sites()
        self._cell_viability_pct = round(random.uniform(85.0, 99.0), 1)
        self._batch_temp_c = round(random.uniform(36.5, 37.5), 1)
        self._match_score_pct = round(random.uniform(70.0, 98.0), 1)
        self._off_target_pct = round(random.uniform(0.5, 8.0), 2)
        self._protein_fold_conf = round(random.uniform(60.0, 95.0), 1)
        self._cycle_count = random.randint(1, 30)
        self._phase = random.choice(["denaturation", "annealing", "extension", "editing", "analysis"])

    def _generate_sequence(self, length):
        return "".join(random.choice(self._BASES) for _ in range(length))

    def _find_edit_sites(self):
        """Mark positions in the sequence where edits are being applied."""
        sites = []
        for i in range(0, len(self._sequence) - 3, random.randint(8, 20)):
            if random.random() < 0.4:
                sites.append({
                    "position": i,
                    "original": self._sequence[i],
                    "replacement": random.choice([b for b in self._BASES if b != self._sequence[i]]),
                    "status": random.choice(["pending", "applied", "verified"]),
                })
        return sites

    def _get_state(self):
        # Visible window of sequence
        start = self._scroll_offset % len(self._sequence)
        visible = ""
        for i in range(self._SEQ_LENGTH):
            idx = (start + i) % len(self._sequence)
            visible += self._sequence[idx]

        return {
            "gene_target": self._gene_target,
            "visible_sequence": visible,
            "scroll_offset": self._scroll_offset,
            "guide_rna": self._guide_rna,
            "edit_sites": [dict(s) for s in self._edit_sites],
            "cell_viability_pct": self._cell_viability_pct,
            "batch_temp_c": self._batch_temp_c,
            "match_score_pct": self._match_score_pct,
            "off_target_pct": self._off_target_pct,
            "protein_fold_conf": self._protein_fold_conf,
            "cycle_count": self._cycle_count,
            "phase": self._phase,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        # Strip gene_target, guide_rna (static)
        return {
            "_delta": True,
            "visible_sequence": new_state["visible_sequence"],
            "scroll_offset": new_state["scroll_offset"],
            "edit_sites": new_state["edit_sites"],
            "cell_viability_pct": new_state["cell_viability_pct"],
            "batch_temp_c": new_state["batch_temp_c"],
            "match_score_pct": new_state["match_score_pct"],
            "off_target_pct": new_state["off_target_pct"],
            "protein_fold_conf": new_state["protein_fold_conf"],
            "cycle_count": new_state["cycle_count"],
            "phase": new_state["phase"],
        }

    def next_frame(self) -> dict:
        # Scroll sequence
        self._scroll_offset += 1

        # Phase cycling
        phases = ["denaturation", "annealing", "extension", "editing", "analysis"]
        if random.random() < 0.05:
            idx = phases.index(self._phase)
            self._phase = phases[(idx + 1) % len(phases)]
            if self._phase == "denaturation":
                self._cycle_count += 1

        # Drift readings
        self._cell_viability_pct = round(max(50.0, min(100.0,
            self._cell_viability_pct + random.uniform(-0.3, 0.2))), 1)
        self._batch_temp_c = round(max(35.0, min(39.0,
            self._batch_temp_c + random.uniform(-0.1, 0.1))), 1)
        self._match_score_pct = round(max(50.0, min(100.0,
            self._match_score_pct + random.uniform(-0.5, 0.5))), 1)
        self._off_target_pct = round(max(0.0, min(15.0,
            self._off_target_pct + random.uniform(-0.1, 0.1))), 2)
        self._protein_fold_conf = round(max(40.0, min(100.0,
            self._protein_fold_conf + random.uniform(-0.5, 0.5))), 1)

        # Edit site progress
        for site in self._edit_sites:
            if site["status"] == "pending" and random.random() < 0.03:
                site["status"] = "applied"
            elif site["status"] == "applied" and random.random() < 0.05:
                site["status"] = "verified"

        # Occasionally mutate the sequence (simulating edits)
        if random.random() < 0.02:
            pos = random.randint(0, len(self._sequence) - 1)
            bases = list(self._sequence)
            bases[pos] = random.choice(self._BASES)
            self._sequence = "".join(bases)

        return self._get_state()
