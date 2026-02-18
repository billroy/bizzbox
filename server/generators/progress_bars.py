"""Concurrent progress bar activity generator."""
import random
import math
from .base import BaseActivity

# Label templates per strategy. {N} is replaced with a random number.
_LABELS: dict[str, list[str]] = {
    "file_transfer": [
        "Uploading config.tar.gz",
        "Syncing node-{N}",
        "Transferring database.sql",
        "Pushing assets/bundle-{N}.js",
        "Uploading logs/access-{N}.log",
        "Syncing media/video-{N}.mp4",
        "Transferring backup-{N}.tar",
        "Uploading dist/main-{N}.css",
        "Pushing src/index-{N}.ts",
        "Transferring images-{N}.zip",
        "Uploading schema-v{N}.json",
        "Syncing certs/node{N}.pem",
        "Transferring events-{N}.parquet",
        "Uploading fixtures-{N}.sql",
        "Pushing release-{N}.tar.gz",
    ],
    "system_update": [
        "Updating kernel modules",
        "Patching libc-{N}.so",
        "Installing package openssl-{N}",
        "Applying hotfix-{N}.patch",
        "Upgrading firmware rev{N}",
        "Updating driver v{N}.ko",
        "Patching CVE-2024-{N}",
        "Installing systemd unit {N}",
        "Rebuilding initramfs",
        "Updating GRUB config",
        "Patching glibc headers",
        "Applying security policy {N}",
        "Installing cert bundle {N}",
        "Updating NSS database",
        "Applying iptables ruleset {N}",
    ],
    "data_migration": [
        "Migrating table users_{N}",
        "Exporting shard-{N}.db",
        "Transforming events batch {N}",
        "Loading dim_product_{N}",
        "Reindexing collection_{N}",
        "Merging partition p{N}",
        "Validating schema v{N}",
        "Copying blob storage {N}",
        "Reconciling ledger {N}",
        "Archiving audit_log_{N}",
        "Migrating redis key-{N}",
        "Syncing replica set {N}",
        "Compacting segment {N}",
        "Migrating sessions_{N}",
        "Rebuilding index_{N}",
    ],
    "compilation": [
        "Compiling src/core/engine.cpp",
        "Linking librender-{N}.a",
        "Assembling module_{N}.o",
        "Optimizing IR pass {N}",
        "Generating bindings v{N}",
        "Compiling shader_{N}.glsl",
        "Building target release-{N}",
        "Preprocessing header_{N}.h",
        "Linking stdlib-{N}.so",
        "Compiling proto_{N}.pb.cc",
        "Generating debug symbols",
        "Stripping binary {N}",
        "Running LTO pass {N}",
        "Bundling assets chunk {N}",
        "Minifying output-{N}.js",
    ],
    "encryption": [
        "Encrypting volume-{N}",
        "Generating RSA-4096 key {N}",
        "Hashing shard {N} (SHA-512)",
        "Sealing payload-{N}.bin",
        "Deriving subkey {N}",
        "Signing certificate {N}",
        "Encrypting partition p{N}",
        "Verifying HMAC block {N}",
        "Rotating AES key {N}",
        "Encrypting keystore {N}",
        "Generating IV for chunk {N}",
        "Sealing vault entry {N}",
        "Hashing manifest {N}",
        "Encrypting log segment {N}",
        "Authenticating token {N}",
    ],
}

# Speed ranges per strategy (progress points per frame, before random factor)
_SPEEDS: dict[str, tuple[float, float]] = {
    "file_transfer": (0.8, 2.5),
    "system_update": (0.4, 1.2),
    "data_migration": (0.5, 1.8),
    "compilation": (0.6, 2.0),
    "encryption": (0.3, 1.0),
}


def _make_label(strategy: str) -> str:
    tmpl = random.choice(_LABELS[strategy])
    return tmpl.replace("{N}", str(random.randint(1, 999)))


def _make_bar(strategy: str, status: str = "active") -> dict:
    lo, hi = _SPEEDS[strategy]
    return {
        "label": _make_label(strategy),
        "progress": round(random.uniform(0, 30) if status == "active" else 0.0, 2),
        "speed": round(random.uniform(lo, hi), 3),
        "status": status,
        "_complete_frames": 0,   # internal counter, clients may ignore
    }


class ProgressBarsActivity(BaseActivity):
    activity_type = "progress_bars"
    strategies = ["file_transfer", "system_update", "data_migration", "compilation", "encryption"]
    titles = ["FILE TRANSFER", "SYSTEM UPDATE", "DATA MIGRATION", "BUILD STATUS", "ENCRYPTION"]

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        # 4-8 bars depending on intensity
        n_bars = int(4 + round(4 * (intensity / 10)))
        n_bars = max(4, min(8, n_bars))
        # Stagger initial progress so not all bars start together
        self._bars = [_make_bar(self.strategy) for _ in range(n_bars)]
        for i, bar in enumerate(self._bars):
            bar["progress"] = round(random.uniform(0, 80 * (i / max(1, n_bars - 1))), 2)

    def _get_state(self) -> dict:
        return {
            "bars": [
                {
                    "label": b["label"],
                    "progress": b["progress"],
                    "speed": b["speed"],
                    "status": b["status"],
                }
                for b in self._bars
            ],
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        for bar in self._bars:
            if bar["status"] == "active":
                delta = bar["speed"] * random.uniform(0.5, 1.5)
                bar["progress"] = min(100.0, round(bar["progress"] + delta, 2))
                if bar["progress"] >= 100.0:
                    bar["progress"] = 100.0
                    bar["status"] = "complete"
                    bar["_complete_frames"] = 0

            elif bar["status"] == "complete":
                bar["_complete_frames"] += 1
                hold_frames = random.randint(3, 5)
                if bar["_complete_frames"] >= hold_frames:
                    # Reset to a fresh bar
                    lo, hi = _SPEEDS[self.strategy]
                    bar["label"] = _make_label(self.strategy)
                    bar["progress"] = 0.0
                    bar["speed"] = round(random.uniform(lo, hi), 3)
                    bar["status"] = "active"
                    bar["_complete_frames"] = 0

        return self._get_state()
