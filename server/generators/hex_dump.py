"""Binary/hex dump stream generator."""
import random
import struct
from .base import BaseActivity


class HexDumpActivity(BaseActivity):
    activity_type = "hex_dump"
    update_interval_override = 0.33  # ~3 Hz — all rows shift each frame
    strategies = ["network_packet", "executable_header", "encrypted_stream", "image_data", "memory_dump"]
    titles = [
        "HEX DUMP", "BINARY ANALYSIS", "MEMORY INSPECTOR",
        "PACKET CAPTURE", "BINARY STREAM", "CORE DUMP FRAGMENT",
        "PAYLOAD ANALYSIS",
    ]

    # Seeded byte patterns per strategy
    HEADERS = {
        "network_packet": bytes([
            0xff, 0xff, 0xff, 0xff, 0xff, 0xff,  # dst MAC broadcast
            0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e,  # src MAC
            0x08, 0x00,                            # EtherType: IPv4
            0x45, 0x00, 0x00, 0x3c,              # IP: ver/IHL/ToS/len
            0x1c, 0x46, 0x40, 0x00,              # IP: ID/flags/frag
            0x40, 0x06, 0x00, 0x00,              # TTL/proto(TCP)/checksum
            0xc0, 0xa8, 0x01, 0x01,              # src IP
            0xc0, 0xa8, 0x01, 0x02,              # dst IP
            0x1f, 0x90, 0xc3, 0x50,              # TCP: src/dst port
            0x00, 0x00, 0x00, 0x01,              # seq
        ]),
        "executable_header": bytes([
            0x7f, 0x45, 0x4c, 0x46,  # ELF magic
            0x02, 0x01, 0x01, 0x00,  # 64bit LE Linux
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x02, 0x00, 0x3e, 0x00,  # ET_EXEC, x86_64
            0x01, 0x00, 0x00, 0x00,
            0x40, 0x10, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x18, 0x1c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ]),
        "image_data": bytes([
            0xff, 0xd8, 0xff, 0xe0,  # JPEG SOI + APP0 marker
            0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,  # JFIF
            0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48,  # version+density
            0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00,  # quantization
            0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
            0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a,
        ]),
        "encrypted_stream": b"",  # high entropy, no header
        "memory_dump": b"",       # mixed patterns
    }

    def __init__(self, activity_id=None, intensity=5):
        super().__init__(activity_id, intensity)
        self._offset = random.randint(0, 0x4000) * 16
        header = self.HEADERS.get(self.strategy, b"")
        self._buffer = bytearray(header) + self._gen_body(128)
        self._rows = []
        self._build_rows()

    def _gen_body(self, n):
        if self.strategy == "encrypted_stream":
            return bytes([random.randint(0, 255) for _ in range(n)])
        elif self.strategy == "memory_dump":
            # Mix of nulls, printable ASCII, and random bytes
            out = []
            for _ in range(n):
                r = random.random()
                if r < 0.2:
                    out.append(0x00)
                elif r < 0.5:
                    out.append(random.randint(0x20, 0x7e))
                else:
                    out.append(random.randint(0, 255))
            return bytes(out)
        else:
            return bytes([random.randint(0, 255) for _ in range(n)])

    def _build_rows(self):
        self._rows = []
        for i in range(0, min(len(self._buffer), 16 * 20), 16):
            chunk = self._buffer[i:i+16]
            hex_part = ' '.join(f'{b:02x}' for b in chunk)
            ascii_part = ''.join(chr(b) if 0x20 <= b < 0x7f else '.' for b in chunk)
            self._rows.append({
                "offset": f"0x{(self._offset + i):08x}",
                "hex": hex_part,
                "ascii": ascii_part,
            })

    def _get_state(self):
        return {"rows": self._rows, "strategy": self.strategy}

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        # Scroll by adding new rows at bottom, remove from top
        new_bytes = self._gen_body(16 * random.randint(1, 3))
        self._buffer.extend(new_bytes)
        if len(self._buffer) > 16 * 40:
            remove = len(self._buffer) - 16 * 40
            self._buffer = self._buffer[remove:]
            self._offset += remove
        self._build_rows()
        return self._get_state()

    def compute_delta(self, old_state, new_state):
        # All rows change each frame (offsets shift), send full rows but omit strategy
        return {
            "_delta": True,
            "rows": new_state["rows"],
        }
