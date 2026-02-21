#!/usr/bin/env python3
"""
socket-log.py — Curses TUI Socket.IO monitor for BizzBox.

Connects as a phantom monitor (?monitor=true) to observe all socket.io
traffic across channels without inflating viewer counts.

Usage:
    python3 socket-log.py [--host HOST] [--port PORT] [--channels 1,2,3]
"""

import argparse
import asyncio
import curses
import json
import os
import sys
import time
from collections import deque
from dataclasses import dataclass, field

import socketio


# ── Data structures ────────────────────────────────────────────────

@dataclass
class EventRecord:
    """One logged socket.io event."""
    timestamp: float
    channel_id: int
    event_name: str
    payload_size: int
    payload: dict
    detail: str


@dataclass
class ChannelStats:
    """Rolling statistics for one channel."""
    channel_id: int
    connected: bool = False
    rolling: deque = field(default_factory=lambda: deque())  # (timestamp, size) tuples
    sparkline: list = field(default_factory=lambda: [0] * 60)  # last 60 1-second buckets
    spark_second: int = 0  # floor(time) of current bucket
    type_bytes: dict = field(default_factory=dict)  # activity_type -> total bytes
    total_clients: int = 0       # from channel:viewers (excludes monitors)
    channel_viewers: int = 0     # viewers on this specific channel

    def record(self, ts: float, size: int, event_name: str):
        self.rolling.append((ts, size))
        # Trim to 5-second window
        cutoff = ts - 5.0
        while self.rolling and self.rolling[0][0] < cutoff:
            self.rolling.popleft()
        # Sparkline bucket
        sec = int(ts)
        if sec != self.spark_second:
            # Roll forward
            gap = min(sec - self.spark_second, 60)
            for _ in range(gap):
                self.sparkline.append(0)
            self.sparkline = self.sparkline[-60:]
            self.spark_second = sec
        self.sparkline[-1] += size
        # Per-type tracking for activity:update
        if event_name == "activity:update":
            # Will be set to activity type by caller if available
            pass

    def events_per_sec(self) -> float:
        if not self.rolling:
            return 0.0
        window = max(0.1, time.time() - self.rolling[0][0])
        return len(self.rolling) / min(window, 5.0)

    def bytes_per_sec(self) -> float:
        if not self.rolling:
            return 0.0
        total = sum(s for _, s in self.rolling)
        window = max(0.1, time.time() - self.rolling[0][0])
        return total / min(window, 5.0)

    def avg_bytes(self) -> float:
        if not self.rolling:
            return 0.0
        return sum(s for _, s in self.rolling) / len(self.rolling)

    def estimated_total_bps(self) -> float:
        """Estimate total bandwidth: per-client * non-monitor clients."""
        bps = self.bytes_per_sec()
        clients = max(1, self.total_clients)  # totalClients already excludes monitors
        return bps * clients


# ── Formatting helpers ─────────────────────────────────────────────

SPARK_CHARS = " ▁▂▃▄▅▆▇█"

def format_size(nbytes: int) -> str:
    """Hybrid size: '64b' below 1k, '2.3k' at/above 1k."""
    if nbytes < 1024:
        return f"{nbytes}b"
    return f"{nbytes / 1024:.1f}k"


def sparkline(buckets: list, width: int = 20) -> str:
    """Render a sparkline from the last `width` buckets."""
    data = buckets[-width:]
    if not data:
        return " " * width
    mx = max(data) or 1
    return "".join(SPARK_CHARS[min(int(v / mx * 8), 8)] for v in data)


def summarize_event(event_name: str, payload: dict) -> str:
    """Generate a one-line summary of an event's payload."""
    if not payload or not isinstance(payload, dict):
        return ""

    if event_name == "activity:spawn":
        atype = payload.get("type", "?")
        aid = payload.get("id", "")[:8]
        slot = payload.get("slot", "?")
        return f"{atype} id={aid} slot={slot}"

    if event_name == "activity:despawn":
        return f"id={payload.get('id', '')[:8]}"

    if event_name == "activity:update":
        aid = payload.get("id", "")[:8]
        state = payload.get("state", {})
        delta = "Δ" if state.get("_delta") else "F"
        keys = len(state) - (1 if "_delta" in state else 0)
        return f"id={aid} {delta} keys={keys}"

    if event_name == "sync:init":
        activities = payload.get("activities", [])
        ch = payload.get("channel", {})
        ch_name = ch.get("name", "?") if ch else "?"
        return f"{ch_name} activities={len(activities)}"

    if event_name == "channel:list":
        channels = payload.get("channels", [])
        return f"{len(channels)} channels"

    if event_name == "channel:switched":
        return f"→ {payload.get('channelName', '?')}"

    if event_name == "channel:viewers":
        return f"ch={payload.get('channelViewers', '?')} total={payload.get('totalClients', '?')}"

    if event_name.startswith("configure:"):
        parts = []
        for k, v in payload.items():
            parts.append(f"{k}={v}")
        return " ".join(parts)

    if event_name.startswith("window:"):
        aid = payload.get("id", "")[:8]
        parts = [f"id={aid}"] if aid else []
        if "type" in payload:
            parts.append(payload["type"])
        if "slot" in payload:
            parts.append(f"slot={payload['slot']}")
        return " ".join(parts)

    # Fallback: show first few keys
    keys = list(payload.keys())[:4]
    return " ".join(f"{k}={payload[k]}" for k in keys if not isinstance(payload[k], (dict, list)))


# ── Event color categories ─────────────────────────────────────────

def event_color(event_name: str) -> int:
    """Return curses color pair number for an event category."""
    if event_name.startswith("activity:spawn"):
        return 1  # green
    if event_name.startswith("activity:despawn"):
        return 2  # red
    if event_name.startswith("activity:update"):
        return 7  # dim
    if event_name.startswith("configure:"):
        return 3  # yellow
    if event_name.startswith("channel:"):
        return 4  # cyan
    if event_name.startswith("window:"):
        return 5  # white
    if event_name.startswith("sync:"):
        return 6  # magenta
    return 5  # white default


# ── Suppressed events (hidden from log unless verbose) ─────────────

SUPPRESSED_EVENTS = {"activity:update", "window:move", "window:resize"}

# ── Event category filters ─────────────────────────────────────────

EVENT_CATEGORIES = {
    "activity": ["activity:spawn", "activity:update", "activity:despawn"],
    "channel":  ["channel:list", "channel:switched", "channel:viewers"],
    "configure": ["configure:style", "configure:intensity", "configure:mute",
                   "configure:sync", "configure:layout", "configure:fg_count"],
    "window":   ["window:move", "window:resize", "window:focus",
                  "window:replace", "window:close", "window:randomize",
                  "window:spawn", "window:pin", "window:unpin"],
    "sync":     ["sync:init"],
    "client":   ["client:connect"],
}


# ── Main monitor class ─────────────────────────────────────────────

class SocketMonitor:
    def __init__(self, host: str, port: int, channels: list[int]):
        self.host = host
        self.port = port
        self.url = f"http://{host}:{port}"
        self.requested_channels = channels
        self.start_time = time.time()

        # Connections: channel_id -> sio.AsyncClient
        self.clients: dict[int, socketio.AsyncClient] = {}

        # Stats
        self.channel_stats: dict[int, ChannelStats] = {}
        self.total_stats = ChannelStats(channel_id=0)

        # Event log
        self.log: deque[EventRecord] = deque(maxlen=2000)

        # UI state
        self.verbose = False
        self.paused = False
        self.pause_buffer: list[EventRecord] = []
        self.dump_next = False
        self.flash_msg = ""
        self.flash_until = 0.0
        self.scroll_offset = 0  # 0 = bottom (live), >0 = scrolled up
        self.show_types = False
        self.channel_filter: int | None = None  # None = all
        self.event_filter: set[str] | None = None  # None = all categories
        self.overlay: str | None = None  # "channel", "event", or None

        # Verbose sampling: (channel_id, activity_type) -> last_sample_time
        self._verbose_samples: dict[tuple, float] = {}

        # Known channels from server
        self._known_channels: set[int] = set()

        # Curses
        self.stdscr = None
        self._running = False

    # ── Connection management ──────────────────────────────────

    async def _connect_channel(self, channel_id: int):
        """Create and connect one AsyncClient for a channel."""
        sio = socketio.AsyncClient(reconnection=True, reconnection_delay=2)
        self.clients[channel_id] = sio
        if channel_id not in self.channel_stats:
            self.channel_stats[channel_id] = ChannelStats(channel_id=channel_id)
        stats = self.channel_stats[channel_id]

        @sio.on("*")
        async def catch_all(event, data):
            self._handle_event(channel_id, event, data)

        @sio.on("connect")
        async def on_connect():
            stats.connected = True
            # If not channel 1 (which is auto-joined), switch to our target
            if channel_id != 1:
                await sio.emit("channel:switch", {"channelId": channel_id})

        @sio.on("disconnect")
        async def on_disconnect():
            stats.connected = False

        @sio.on("channel:list")
        async def on_channel_list(data):
            self._handle_event(channel_id, "channel:list", data)
            # Discover and auto-connect to new channels
            if isinstance(data, dict):
                channels = data.get("channels", [])
                for ch in channels:
                    cid = ch.get("id")
                    if cid and cid not in self._known_channels:
                        self._known_channels.add(cid)
                        if cid not in self.clients:
                            asyncio.create_task(self._connect_channel(cid))

        try:
            await sio.connect(f"{self.url}?monitor=true",
                              transports=["websocket"],
                              socketio_path="/socket.io")
        except Exception as e:
            stats.connected = False
            self._log_system(channel_id, f"Connection failed: {e}")

    async def _disconnect_all(self):
        """Disconnect all clients."""
        for cid, sio in list(self.clients.items()):
            try:
                await sio.disconnect()
            except Exception:
                pass
        self.clients.clear()

    # ── Event handling ─────────────────────────────────────────

    def _handle_event(self, channel_id: int, event_name: str, data):
        """Process one incoming event."""
        ts = time.time()
        payload = data if isinstance(data, dict) else {}
        payload_json = json.dumps(data) if data else "{}"
        size = len(payload_json.encode("utf-8"))

        # Always record in stats
        stats = self.channel_stats.get(channel_id)
        if stats:
            stats.record(ts, size, event_name)
        self.total_stats.record(ts, size, event_name)

        # Track viewer counts from channel:viewers
        if event_name == "channel:viewers" and stats:
            stats.total_clients = payload.get("totalClients", 0)
            stats.channel_viewers = payload.get("channelViewers", 0)

        # Track per-type bytes for activity:update
        if event_name == "activity:update" and stats:
            # We don't know the activity type from the event alone,
            # just track by event name in type_bytes
            stats.type_bytes[event_name] = stats.type_bytes.get(event_name, 0) + size

        # Dump to file if requested
        if self.dump_next:
            self.dump_next = False
            self._dump_json(channel_id, event_name, payload, size)

        # Check suppression
        if event_name in SUPPRESSED_EVENTS and not self.verbose:
            return

        # Verbose sampling for activity:update
        if self.verbose and event_name == "activity:update":
            atype = "update"  # generic
            key = (channel_id, atype)
            last = self._verbose_samples.get(key, 0)
            if ts - last < 1.0:
                return  # suppress this sample
            self._verbose_samples[key] = ts

        # Channel filter
        if self.channel_filter is not None and channel_id != self.channel_filter:
            return

        # Event category filter
        if self.event_filter is not None:
            matched = False
            for cat in self.event_filter:
                if cat in EVENT_CATEGORIES:
                    if event_name in EVENT_CATEGORIES[cat]:
                        matched = True
                        break
            if not matched:
                return

        # Build record
        detail = summarize_event(event_name, payload)
        record = EventRecord(
            timestamp=ts,
            channel_id=channel_id,
            event_name=event_name,
            payload_size=size,
            payload=payload,
            detail=detail,
        )

        if self.paused:
            self.pause_buffer.append(record)
        else:
            self.log.append(record)
            # Auto-scroll to bottom when new events arrive (if already at bottom)
            if self.scroll_offset == 0:
                pass  # stay at bottom

    def _log_system(self, channel_id: int, msg: str):
        """Add a system message to the log."""
        record = EventRecord(
            timestamp=time.time(),
            channel_id=channel_id,
            event_name="[system]",
            payload_size=0,
            payload={},
            detail=msg,
        )
        self.log.append(record)

    def _dump_json(self, channel_id: int, event_name: str, payload: dict, size: int):
        """Write event to a JSON file."""
        ts_str = time.strftime("%Y%m%d-%H%M%S")
        filename = f"socket-log-dump-{ts_str}.json"
        dump = {
            "timestamp": time.time(),
            "channel_id": channel_id,
            "event": event_name,
            "payload_size": size,
            "payload": payload,
        }
        try:
            with open(filename, "w") as f:
                json.dump(dump, f, indent=2)
            self.flash_msg = f"Dumped → {filename}"
        except Exception as e:
            self.flash_msg = f"Dump failed: {e}"
        self.flash_until = time.time() + 3.0

    # ── Curses setup ───────────────────────────────────────────

    def _setup_curses(self, stdscr):
        """Initialize curses colors and settings."""
        self.stdscr = stdscr
        curses.curs_set(0)
        stdscr.nodelay(True)
        stdscr.timeout(250)  # 4Hz refresh

        curses.start_color()
        curses.use_default_colors()
        curses.init_pair(1, curses.COLOR_GREEN, -1)    # spawn
        curses.init_pair(2, curses.COLOR_RED, -1)      # despawn
        curses.init_pair(3, curses.COLOR_YELLOW, -1)   # configure
        curses.init_pair(4, curses.COLOR_CYAN, -1)     # channel
        curses.init_pair(5, curses.COLOR_WHITE, -1)    # window
        curses.init_pair(6, curses.COLOR_MAGENTA, -1)  # sync
        curses.init_pair(7, 8, -1)                     # dim (dark gray if available)
        curses.init_pair(8, curses.COLOR_BLACK, curses.COLOR_WHITE)  # status bar

    # ── Drawing ────────────────────────────────────────────────

    def _draw(self):
        """Render the full TUI."""
        if not self.stdscr:
            return
        try:
            self.stdscr.erase()
            height, width = self.stdscr.getmaxyx()
            if height < 5 or width < 40:
                self.stdscr.addstr(0, 0, "Terminal too small")
                self.stdscr.refresh()
                return

            row = 0
            row = self._draw_header(row, width)
            row = self._draw_stats(row, width)
            self._draw_separator(row, width)
            row += 1
            footer_row = height - 1
            body_height = footer_row - row
            if body_height > 0:
                if self.overlay == "channel":
                    self._draw_channel_overlay(row, body_height, width)
                elif self.overlay == "event":
                    self._draw_event_overlay(row, body_height, width)
                elif self.show_types:
                    self._draw_type_breakdown(row, body_height, width)
                else:
                    self._draw_body(row, body_height, width)
            self._draw_footer(footer_row, width)
            self.stdscr.refresh()
        except curses.error:
            pass

    def _draw_header(self, row: int, width: int) -> int:
        """Draw the title bar with connection status."""
        uptime = int(time.time() - self.start_time)
        mins, secs = divmod(uptime, 60)
        hrs, mins = divmod(mins, 60)

        # Channel status indicators
        ch_parts = []
        sorted_ids = sorted(self.channel_stats.keys())
        display_ids = sorted_ids[:4]
        for cid in display_ids:
            st = self.channel_stats[cid]
            marker = "✓" if st.connected else "✗"
            ch_parts.append(f"CH{cid}:{marker}")
        if len(sorted_ids) > 4:
            ch_parts.append(f"+{len(sorted_ids) - 4}")
        channels_str = " ".join(ch_parts)

        title = f"BizzBox Monitor │ {self.host}:{self.port} │ {hrs:d}:{mins:02d}:{secs:02d}"
        total_eps = self.total_stats.events_per_sec()
        total_bps = self.total_stats.bytes_per_sec()
        total_est = sum(st.estimated_total_bps() for st in self.channel_stats.values())
        metrics = f"{total_eps:.0f} evt/s  ({format_size(int(total_bps))}/{format_size(int(total_est))})/s"

        # Compose line
        line = f" {title} │ {metrics} │ {channels_str} "
        try:
            self.stdscr.addstr(row, 0, line[:width].ljust(width),
                               curses.color_pair(8) | curses.A_BOLD)
        except curses.error:
            pass
        return row + 1

    def _draw_stats(self, row: int, width: int) -> int:
        """Draw per-channel statistics rows."""
        sorted_ids = sorted(self.channel_stats.keys())
        display_ids = sorted_ids[:4]  # cap at 4

        for cid in display_ids:
            st = self.channel_stats[cid]
            eps = st.events_per_sec()
            bps = st.bytes_per_sec()
            avg = st.avg_bytes()
            spark = sparkline(st.sparkline, min(20, width - 50))

            est_total = st.estimated_total_bps()
            bw_display = f"({format_size(int(bps))}/{format_size(int(est_total))})"
            line = (f" CH{cid}: {eps:5.0f} evt/s  {bw_display:>14s}/s"
                    f"  avg={format_size(int(avg)):>5s}  {spark}")
            color = curses.color_pair(4) if st.connected else curses.color_pair(2)
            try:
                self.stdscr.addstr(row, 0, line[:width], color)
            except curses.error:
                pass
            row += 1

        if len(sorted_ids) > 4:
            # Summary for remaining channels
            remaining = sorted_ids[4:]
            total_eps = sum(self.channel_stats[c].events_per_sec() for c in remaining)
            total_bps = sum(self.channel_stats[c].bytes_per_sec() for c in remaining)
            line = f" +{len(remaining)} more: {total_eps:.0f} evt/s  {format_size(int(total_bps))}/s"
            try:
                self.stdscr.addstr(row, 0, line[:width], curses.color_pair(7))
            except curses.error:
                pass
            row += 1

        return row

    def _draw_separator(self, row: int, width: int):
        """Draw a horizontal separator."""
        try:
            self.stdscr.addstr(row, 0, "─" * min(width, 200), curses.color_pair(7))
        except curses.error:
            pass

    def _draw_body(self, row: int, height: int, width: int):
        """Draw the scrollable event log."""
        log_list = list(self.log)
        total = len(log_list)

        if total == 0:
            try:
                self.stdscr.addstr(row, 0, "  Waiting for events...", curses.color_pair(7))
            except curses.error:
                pass
            return

        # Calculate visible window
        end = total - self.scroll_offset
        start = max(0, end - height)
        visible = log_list[start:end]

        for i, rec in enumerate(visible):
            ts = time.strftime("%H:%M:%S", time.localtime(rec.timestamp))
            ms = f".{int((rec.timestamp % 1) * 1000):03d}"
            size_str = format_size(rec.payload_size)
            ch_str = f"CH{rec.channel_id}"

            # Truncate event name and detail to fit
            ev_name = rec.event_name[:20]
            max_detail = max(0, width - 45)
            detail = rec.detail[:max_detail]

            line = f" {ts}{ms}  {ch_str:>4s}  {ev_name:<20s}  {size_str:>6s}  {detail}"
            color = curses.color_pair(event_color(rec.event_name))
            try:
                self.stdscr.addstr(row + i, 0, line[:width], color)
            except curses.error:
                pass

        # Scroll indicator
        if self.scroll_offset > 0:
            indicator = f" ↑ +{self.scroll_offset} more ↓ "
            try:
                self.stdscr.addstr(row, width - len(indicator) - 1, indicator,
                                   curses.color_pair(3) | curses.A_BOLD)
            except curses.error:
                pass

    def _draw_type_breakdown(self, row: int, height: int, width: int):
        """Draw activity type breakdown overlay (ranked by KB/s)."""
        try:
            self.stdscr.addstr(row, 0, " Activity Type Breakdown (by total bytes)", curses.A_BOLD)
        except curses.error:
            pass
        row += 1

        # Aggregate type bytes across all channels
        all_types: dict[str, int] = {}
        for st in self.channel_stats.values():
            for tname, tbytes in st.type_bytes.items():
                all_types[tname] = all_types.get(tname, 0) + tbytes

        sorted_types = sorted(all_types.items(), key=lambda x: -x[1])
        for i, (tname, tbytes) in enumerate(sorted_types[:height - 1]):
            line = f"  {tname:<30s}  {format_size(tbytes):>8s}"
            try:
                self.stdscr.addstr(row + i, 0, line[:width], curses.color_pair(5))
            except curses.error:
                pass

    def _draw_channel_overlay(self, row: int, height: int, width: int):
        """Draw channel filter picker overlay."""
        try:
            self.stdscr.addstr(row, 0, " Channel Filter (press number or 'a' for all)",
                               curses.A_BOLD)
        except curses.error:
            pass
        row += 1

        active = self.channel_filter
        # "All" option
        marker = "●" if active is None else "○"
        try:
            self.stdscr.addstr(row, 0, f"  {marker} [a] All channels", curses.color_pair(4))
        except curses.error:
            pass
        row += 1

        for cid in sorted(self.channel_stats.keys()):
            st = self.channel_stats[cid]
            marker = "●" if active == cid else "○"
            status = "✓" if st.connected else "✗"
            eps = st.events_per_sec()
            line = f"  {marker} [{cid}] Channel {cid} ({status}) — {eps:.0f} evt/s"
            try:
                self.stdscr.addstr(row, 0, line[:width], curses.color_pair(4))
            except curses.error:
                pass
            row += 1

    def _draw_event_overlay(self, row: int, height: int, width: int):
        """Draw event category filter toggle overlay."""
        try:
            self.stdscr.addstr(row, 0, " Event Filter (press letter to toggle, 'a' for all)",
                               curses.A_BOLD)
        except curses.error:
            pass
        row += 1

        active = self.event_filter
        cats = list(EVENT_CATEGORIES.keys())
        shortcuts = {cat: cat[0] for cat in cats}
        # Handle duplicate first letters
        used = set()
        for cat in cats:
            letter = cat[0]
            if letter in used:
                # Find next unique letter
                for c in cat:
                    if c not in used:
                        letter = c
                        break
            shortcuts[cat] = letter
            used.add(letter)

        marker = "●" if active is None else "○"
        try:
            self.stdscr.addstr(row, 0, f"  {marker} [a] All events", curses.color_pair(3))
        except curses.error:
            pass
        row += 1

        for cat in cats:
            if active is not None:
                marker = "●" if cat in active else "○"
            else:
                marker = "●"
            letter = shortcuts[cat]
            events = ", ".join(e.split(":")[1] for e in EVENT_CATEGORIES[cat][:3])
            if len(EVENT_CATEGORIES[cat]) > 3:
                events += ", ..."
            line = f"  {marker} [{letter}] {cat}: {events}"
            try:
                self.stdscr.addstr(row, 0, line[:width], curses.color_pair(3))
            except curses.error:
                pass
            row += 1

    def _draw_footer(self, row: int, width: int):
        """Draw the hotkey bar or flash message."""
        if self.flash_msg and time.time() < self.flash_until:
            line = f" {self.flash_msg} "
            try:
                self.stdscr.addstr(row, 0, line[:width].ljust(width),
                                   curses.color_pair(1) | curses.A_BOLD)
            except curses.error:
                pass
            return

        pause_str = "PAUSED" if self.paused else ""
        if self.paused:
            pause_str = f"PAUSED ({len(self.pause_buffer)} buffered)"

        verbose_str = "verbose" if self.verbose else ""
        filter_str = ""
        if self.channel_filter is not None:
            filter_str = f"CH{self.channel_filter}"

        status_parts = [s for s in [pause_str, verbose_str, filter_str] if s]
        status = " │ ".join(status_parts)

        keys = "[q]uit [v]erbose [p]ause [j]son [t]ypes [c]hannel [e]vent ↑↓ PgUp/Dn"
        if status:
            line = f" {keys}  │  {status} "
        else:
            line = f" {keys} "

        try:
            self.stdscr.addstr(row, 0, line[:width].ljust(width),
                               curses.color_pair(8))
        except curses.error:
            pass

    # ── Input handling ─────────────────────────────────────────

    def _handle_key(self, key: int):
        """Process a keypress."""
        # Overlay-specific keys
        if self.overlay == "channel":
            self._handle_channel_overlay_key(key)
            return
        if self.overlay == "event":
            self._handle_event_overlay_key(key)
            return

        if key == ord("q"):
            self._running = False
        elif key == ord("v"):
            self.verbose = not self.verbose
            self.flash_msg = f"Verbose: {'ON' if self.verbose else 'OFF'}"
            self.flash_until = time.time() + 2.0
        elif key == ord("p"):
            if self.paused:
                # Unpause: flush buffer to log
                for rec in self.pause_buffer:
                    self.log.append(rec)
                self.pause_buffer.clear()
                self.paused = False
                self.scroll_offset = 0  # jump to live
                self.flash_msg = "Unpaused — jumped to live"
            else:
                self.paused = True
                self.flash_msg = "Paused — buffering events"
            self.flash_until = time.time() + 2.0
        elif key == ord("j"):
            self.dump_next = True
            self.flash_msg = "Will dump next event to JSON..."
            self.flash_until = time.time() + 2.0
        elif key == ord("t"):
            self.show_types = not self.show_types
            self.overlay = None
        elif key == ord("c"):
            self.overlay = "channel" if self.overlay != "channel" else None
            self.show_types = False
        elif key == ord("e"):
            self.overlay = "event" if self.overlay != "event" else None
            self.show_types = False
        elif key == curses.KEY_UP:
            self.scroll_offset = min(self.scroll_offset + 1, max(0, len(self.log) - 1))
        elif key == curses.KEY_DOWN:
            self.scroll_offset = max(0, self.scroll_offset - 1)
        elif key == curses.KEY_PPAGE:  # Page Up
            self.scroll_offset = min(self.scroll_offset + 20, max(0, len(self.log) - 1))
        elif key == curses.KEY_NPAGE:  # Page Down
            self.scroll_offset = max(0, self.scroll_offset - 20)
        elif key == curses.KEY_HOME:
            self.scroll_offset = max(0, len(self.log) - 1)
        elif key == curses.KEY_END:
            self.scroll_offset = 0

    def _handle_channel_overlay_key(self, key: int):
        """Handle keys while channel overlay is visible."""
        if key == ord("a"):
            self.channel_filter = None
            self.overlay = None
        elif key == 27 or key == ord("c"):  # Escape or 'c' again
            self.overlay = None
        elif ord("0") <= key <= ord("9"):
            cid = key - ord("0")
            if cid in self.channel_stats:
                self.channel_filter = cid
                self.overlay = None
            elif cid == 0:
                self.channel_filter = None
                self.overlay = None

    def _handle_event_overlay_key(self, key: int):
        """Handle keys while event overlay is visible."""
        if key == ord("a"):
            self.event_filter = None
            self.overlay = None
            return
        if key == 27 or key == ord("e"):  # Escape or 'e' again
            self.overlay = None
            return

        # Map key to category
        ch = chr(key) if 0 <= key < 256 else ""
        cats = list(EVENT_CATEGORIES.keys())
        # Simple: first letter match
        for cat in cats:
            if cat[0] == ch:
                if self.event_filter is None:
                    # Switch from "all" to just this one
                    self.event_filter = {cat}
                elif cat in self.event_filter:
                    self.event_filter.discard(cat)
                    if not self.event_filter:
                        self.event_filter = None
                else:
                    self.event_filter.add(cat)
                break

    # ── Main loop ──────────────────────────────────────────────

    async def run(self, stdscr):
        """Main async entry point — runs inside curses wrapper."""
        self._setup_curses(stdscr)
        self._running = True

        # Connect to requested channels
        connect_tasks = []
        for cid in self.requested_channels:
            self._known_channels.add(cid)
            connect_tasks.append(self._connect_channel(cid))
        await asyncio.gather(*connect_tasks, return_exceptions=True)

        # Main loop: render + input polling
        try:
            while self._running:
                # Handle input
                try:
                    key = stdscr.getch()
                    while key != -1:
                        self._handle_key(key)
                        if not self._running:
                            break
                        key = stdscr.getch()
                except curses.error:
                    pass

                if not self._running:
                    break

                # Render
                self._draw()

                # Yield to asyncio for socket events
                await asyncio.sleep(0.05)
        finally:
            await self._disconnect_all()


# ── Entry point ────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="BizzBox Socket.IO TUI Monitor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Hotkeys:
  q       Quit
  v       Toggle verbose (show sampled activity:update)
  p       Pause/unpause event log
  j       Dump next event to JSON file
  t       Toggle activity type breakdown
  c       Channel filter overlay
  e       Event filter overlay
  ↑/↓     Scroll event log
  PgUp/Dn Scroll by 20 lines
""",
    )
    parser.add_argument("--host", default="localhost",
                        help="BizzBox server host (default: localhost)")
    parser.add_argument("--port", type=int,
                        default=int(os.environ.get("BIZZBOX_PORT", 5050)),
                        help="BizzBox server port (default: $BIZZBOX_PORT or 5050)")
    parser.add_argument("--channels", default="1",
                        help="Comma-separated channel IDs to monitor (default: 1)")
    args = parser.parse_args()

    # Parse channels
    channels = []
    for part in args.channels.split(","):
        part = part.strip()
        if part.isdigit():
            channels.append(int(part))
    if not channels:
        channels = [1]

    monitor = SocketMonitor(args.host, args.port, channels)

    def curses_main(stdscr):
        asyncio.run(monitor.run(stdscr))

    try:
        curses.wrapper(curses_main)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
