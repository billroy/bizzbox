#!/usr/bin/env python3
"""Measure per-activity-type bandwidth over Socket.IO for BizzBox.

Usage:
    python3 measure_bandwidth.py [--port PORT] [--duration SECS]

Connects to a running BizzBox server, captures all activity:update events,
maps IDs→types from sync:init and activity:spawn, and reports bandwidth.
"""
import argparse
import json
import time
import sys
import threading
import socketio

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=5051)
    parser.add_argument("--duration", type=int, default=30)
    args = parser.parse_args()

    url = f"http://127.0.0.1:{args.port}"
    duration = args.duration

    id_to_type = {}          # activity_id -> activity_type (never cleared)
    type_bytes_delta = {}    # type -> total delta bytes
    type_bytes_full = {}     # type -> total full-state bytes
    type_count_delta = {}    # type -> count of delta updates
    type_count_full = {}     # type -> count of full updates
    total_bytes = 0
    total_msgs = 0
    unknown_ids = set()
    lock = threading.Lock()
    connected_event = threading.Event()

    sio = socketio.Client(logger=False, engineio_logger=False)

    @sio.on("sync:init")
    def on_sync_init(data):
        with lock:
            for act in data.get("activities", []):
                aid = act.get("id")
                atype = act.get("type")
                if aid and atype:
                    id_to_type[aid] = atype
        print(f"  sync:init → registered {len(data.get('activities', []))} activities")

    @sio.on("activity:spawn")
    def on_spawn(data):
        with lock:
            aid = data.get("id")
            atype = data.get("type")
            if aid and atype:
                id_to_type[aid] = atype

    @sio.on("activity:despawn")
    def on_despawn(data):
        pass  # keep the mapping, don't remove

    @sio.on("activity:update")
    def on_update(data):
        nonlocal total_bytes, total_msgs
        raw = json.dumps(data, separators=(",", ":"))
        size = len(raw.encode("utf-8"))
        aid = data.get("id", "")
        state = data.get("state", {})
        is_delta = state.get("_delta", False)

        with lock:
            total_bytes += size
            total_msgs += 1
            atype = id_to_type.get(aid)
            if not atype:
                unknown_ids.add(aid)
                atype = f"UNKNOWN({aid[:8]})"

            if is_delta:
                type_bytes_delta[atype] = type_bytes_delta.get(atype, 0) + size
                type_count_delta[atype] = type_count_delta.get(atype, 0) + 1
            else:
                type_bytes_full[atype] = type_bytes_full.get(atype, 0) + size
                type_count_full[atype] = type_count_full.get(atype, 0) + 1

    @sio.event
    def connect():
        connected_event.set()
        print(f"  Connected to {url}")
        # Join channel 1
        sio.emit("channel:join", {"channel": 1})

    @sio.event
    def connect_error(data):
        print(f"  Connection error: {data}")

    print(f"Connecting to {url}...")
    try:
        sio.connect(url, transports=["websocket"])
    except Exception as e:
        print(f"Failed to connect: {e}")
        sys.exit(1)

    if not connected_event.wait(timeout=5):
        print("Timed out waiting for connection")
        sys.exit(1)

    # Wait a moment for sync:init
    time.sleep(1)
    print(f"  Registered {len(id_to_type)} activity IDs from sync:init")
    print(f"  Measuring for {duration} seconds...\n")

    # Reset counters after registration
    with lock:
        total_bytes = 0
        total_msgs = 0
        type_bytes_delta.clear()
        type_bytes_full.clear()
        type_count_delta.clear()
        type_count_full.clear()
        unknown_ids.clear()

    time.sleep(duration)

    sio.disconnect()

    # --- Report ---
    with lock:
        all_types = sorted(set(list(type_bytes_delta.keys()) + list(type_bytes_full.keys())))

    print("=" * 90)
    print(f"  Bandwidth Report  —  {duration}s measurement window")
    print("=" * 90)
    print(f"{'Type':<25} {'Delta KB/s':>10} {'Full KB/s':>10} {'Total KB/s':>10} {'Δ msgs':>8} {'F msgs':>8}")
    print("-" * 90)

    grand_delta = 0
    grand_full = 0
    rows = []
    for t in all_types:
        db = type_bytes_delta.get(t, 0)
        fb = type_bytes_full.get(t, 0)
        dc = type_count_delta.get(t, 0)
        fc = type_count_full.get(t, 0)
        d_kbps = db / duration / 1024
        f_kbps = fb / duration / 1024
        t_kbps = d_kbps + f_kbps
        grand_delta += db
        grand_full += fb
        rows.append((t, d_kbps, f_kbps, t_kbps, dc, fc))

    # Sort by total KB/s descending
    rows.sort(key=lambda r: r[3], reverse=True)
    for t, d_kbps, f_kbps, t_kbps, dc, fc in rows:
        print(f"{t:<25} {d_kbps:>10.1f} {f_kbps:>10.1f} {t_kbps:>10.1f} {dc:>8} {fc:>8}")

    print("-" * 90)
    gd = grand_delta / duration / 1024
    gf = grand_full / duration / 1024
    gt = gd + gf
    print(f"{'TOTAL':<25} {gd:>10.1f} {gf:>10.1f} {gt:>10.1f} {'':>8} {'':>8}")
    print(f"\nTotal messages: {total_msgs}  |  Total bytes: {total_bytes:,}")
    print(f"Unknown IDs: {len(unknown_ids)}")
    if unknown_ids:
        print(f"  Sample unknown IDs: {list(unknown_ids)[:5]}")
    print()

if __name__ == "__main__":
    main()
