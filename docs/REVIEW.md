# BizzBox — Code Review & Remediation Plan

*Reviewed: 2026-03-20*

---

## Executive Summary

BizzBox is a well-structured, creative real-time display application. The core architecture is sound: clean separation between ActivityManager, SyncManager, and generators; efficient delta-update protocol; good component organisation on the frontend. The most significant gaps are (1) absence of any automated tests, (2) unprotected `int()` coercions in socket handlers that can crash greenlets, and (3) a handful of security hygiene issues appropriate to a public deployment.

---

## 1. Security

*Reviewed from the perspective of a web application security engineer.*

### CRITICAL

**C1 — `int()` coercion crashes on malformed socket input (DoS vector)**
`app.py:76,92,113,123,207,216`

Every socket handler that calls `int(data.get(...))` will raise `ValueError`/`TypeError` if a client sends a non-numeric string or explicit `None`. Flask-SocketIO does not catch these in the greenlet context, killing the event handler. A single line like `{"channelId": "x"}` from any connected client triggers this.

*Affected handlers:* `channel:switch`, `configure:intensity`, `configure:layout`, `configure:fg_count`, `window:pin`, `window:unpin`

**C2 — No exception handling in `ActivityManager._loop`**
`server/activity_manager.py:150`

If any generator's `next_frame()` raises an unhandled exception, the entire update loop greenlet terminates silently. `_running` stays `True` so no restart occurs. All activities freeze permanently until the server restarts. With 58 generators, any unexpected state in any one of them can kill the show.

---

### HIGH

**H1 — Hardcoded fallback `SECRET_KEY`**
`app.py:22`

```python
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "bizzbox-dev-secret")
```

`"bizzbox-dev-secret"` is committed publicly. Flask uses this for session signing. If the DO deployment does not set `SECRET_KEY`, session tokens are trivially forgeable for any future session-based feature.

**H2 — Wildcard CORS; no rate limiting**
`app.py:29`

```python
cors_allowed_origins="*"
```

Any origin can establish a WebSocket connection and issue commands (change theme, randomize, create channels, update text). No authentication is planned, so the mitigation is server-side rate limiting.

**Proposed rate limiting design:**

A lightweight per-SID token-bucket applied in `app.py` before delegating to `sync_manager`. Each SID gets a bucket of N tokens refilled at R tokens/second. Destructive or expensive events (`window:randomize`, `configure:slots`, `channel:create`) consume more tokens than cheap read-like events.

```python
import time

_rate_buckets: dict[str, dict] = {}  # sid → {tokens, last_refill}

RATE_LIMIT = {
    "default":           (20, 20),   # (bucket_size, refill_per_sec)
    "configure:slots":   (2,  1),
    "window:randomize":  (3,  1),
    "channel:create":    (2,  0.5),
    "text:update":       (10, 10),
}

def _check_rate(sid: str, event: str) -> bool:
    """Return True if the event is allowed, False if rate-limited."""
    size, rate = RATE_LIMIT.get(event, RATE_LIMIT["default"])
    now = time.monotonic()
    b = _rate_buckets.setdefault(sid, {"tokens": size, "last": now})
    elapsed = now - b["last"]
    b["tokens"] = min(size, b["tokens"] + elapsed * rate)
    b["last"] = now
    if b["tokens"] >= 1:
        b["tokens"] -= 1
        return True
    return False
```

Buckets are cleaned up in `handle_disconnect`. This adds negligible overhead (~1 µs per event) and requires no external dependencies.

**H3 — Text widget: no rate limiting on `text:update`**
`app.py:142–148`, `server/sync_manager.py:375–384`

A client can emit `text:update` continuously at socket speed. Each event causes the server to call `set_text`, serialize state, and broadcast to all room viewers. The 10,000-character cap is good, but frequency is uncapped.

**Proposed rate limiting design:**

`text:update` is covered by the token bucket above (`10 tokens, 10/sec`), which limits bursts to 10 consecutive updates before dropping to a steady 10 Hz. A secondary server-side debounce in `SyncManager.update_text` can further reduce broadcast frequency: only emit if the text has actually changed and at least 100 ms has elapsed since the last broadcast for that activity.

```python
# In SyncManager, add per-activity last-broadcast tracking:
self._text_last_broadcast: dict[str, float] = {}

def update_text(self, sid, activity_id, text):
    ...
    now = time.monotonic()
    last = self._text_last_broadcast.get(activity_id, 0)
    if now - last < 0.1:   # 10 Hz max broadcast rate
        return
    self._text_last_broadcast[activity_id] = now
    self._emitter.emit_update(room, activity_id, state)
```

Combined, these two layers mean a fast typist generates at most 10 broadcasts/second to the room, with burst protection, at negligible server cost.

---

### MEDIUM

**M1 — `scene_data` URL param: no bounds on `slots` list**
`static/js/scenes.js:96–107`, `app.py:136–140`

A crafted `?scene_data=` URL can embed a `slots` array of arbitrary length. The server's `configure:slots` handler checks `isinstance(slots, list)` but imposes no maximum length. Very large lists cause the server to iterate unnecessarily.

**M2 — `last_editor` exposes raw Socket.IO SID**
`server/generators/text.py:35–40`

`_get_state()` includes `last_editor: self.last_editor` (a raw `request.sid`). This is broadcast to all channel viewers on every text state transmission. SIDs are not sensitive secrets, but broadcasting internal session identifiers unnecessarily is poor practice.

---

### LOW

**L1 — `muted` default mismatch between server and client**
`server/config.py:15` vs `static/js/store.js:86`

Server defaults to `muted: True`; client defaults to `muted: false`. Corrected on first `sync:init`, but sound should be active at startup. Fix: change `server/config.py` to `muted: bool = False` so both sides agree and audio begins immediately on connect.

---

## 2. Code Quality

*Reviewed from the perspective of a senior Python/JavaScript engineer.*

### HIGH

**Q1 — `SyncManager.update_text` reaches into `ActivityManager._activities` (private)**
`server/sync_manager.py:377`

```python
rec = manager._activities.get(activity_id)
```

`_activities` is a private attribute of `ActivityManager`. `SyncManager` reaching directly into it creates tight coupling. The type-check (`activity_type != "text"`) also belongs in `ActivityManager`. Should be refactored to an `ActivityManager.update_text_activity(id, text, sid)` method.

**Q2 — Delta size comparison double-serialises JSON on every frame**
`server/activity_manager.py:160–162`

```python
if len(json.dumps(delta, ...)) < len(json.dumps(frame, ...)):
```

At 30 Hz with 24+ background slots, this can be ~1,400+ wasted JSON serialisations per second. The delta is structurally always smaller than the full frame for generators that implement `compute_delta`; the comparison rarely changes the outcome and should be removed or replaced with a fixed heuristic.

**Q3 — `doExportScenes` toast notification is dead code**
`static/js/components/AppHeader.js:246–252`

`const { showToast } = store` yields `undefined` — `showToast` is a named module export, not a property on the reactive `store` object. Falls through to `window.alert`, which works but is inconsistent. The correct import is not in `AppHeader.js`'s import list.

---

### MEDIUM

**Q4 — `suppressNextWatch` race condition in Text widget**
`static/js/components/activities/Text.js:15–36`

The boolean flip-flop only absorbs one server echo. If two server updates arrive before the watcher fires (likely during simultaneous multi-user editing), the second update applies and can move the cursor. The standard pattern is to suppress server updates for a short time window after the last local keystroke (timestamp comparison) rather than a single-use boolean.

**Q5 — `text:update` echoes back to the typing client**
`server/sync_manager.py:384`

`emit_update(room, ...)` emits to all room members including the originating client. The `suppressNextWatch` flag is the workaround, but the root fix is `skip_sid=sid` in the emit call. `update_text` already receives `sid`.

**Q6 — `set_grid` does not filter `_pending_closures`**
`server/activity_manager.py:332–336`

When the grid shrinks, pending replacements for removed slots are cancelled. `_pending_closures` is not filtered. Orphaned closure entries are harmless (`_activities.pop` is safe), but the asymmetry is a latent correctness issue.

---

### LOW

**Q7 — `GameOfLife` stable-state detector misses period-2 oscillators**
`server/generators/game_of_life.py:307–312`

The reseed condition `len(set(self._prev_populations)) == 1` detects static grids but not period-2 oscillators (alternating population counts). A single Blinker will run forever without reseeding. Adding a period-2 check (`len(set(self._prev_populations[-4:])) <= 2`) would cover the common case.

---

## 3. Code Duplication

*Reviewed from the perspective of a software architect.*

### HIGH

**D1 — `applyScene` logic duplicated between `keyboard.js` and `AppHeader.js`**
`static/js/keyboard.js:40–74`, `static/js/components/AppHeader.js:157–189`

`AppHeader._applySceneObj` is a local copy of `applyScene` from `keyboard.js`. Both emit the same sequence of `sendStyle`, `sendLayout`, `sendIntensity`, `sendFgTarget`, ambient preset, filter, and `savePrefs`. They will silently diverge as features are added. `AppHeader` should import and call the exported `applyScene` directly.

---

### MEDIUM

**D2 — `int()` conversion repeated across 6 handlers with no shared helper**
`app.py:76,92,113,123,207,216`

Six separate bare `int(...)` calls, none with error handling. A `_safe_int(val, default)` helper eliminates both the duplication and the crash vulnerability (C1) in one change.

---

## 4. Test Coverage

*Reviewed from the perspective of a QA/reliability engineer.*

### CRITICAL

**T1 — Zero automated tests exist**

No `test_*.py`, no `*.test.js`, no test configuration of any kind. The entire application is tested only manually. Critical untested paths:

| Path | Risk |
|------|------|
| `ActivityManager._loop` exception swallowing | Generator error freezes all activity |
| `SyncManager` channel isolation | Command from channel A affecting channel B |
| `configure_slots` with oversized input | Server-side iteration of huge list |
| All `int()` coercions with bad input | Crash/DoS |
| `mergeActivityDelta` for all 4 special-cased types | Silent wrong state after delta |
| `text:update` multi-user concurrent edit | Cursor jump, state desync |
| `GameOfLife.compute_delta` born/died correctness | Wrong cells displayed |
| `TextActivity.set_text` 10k char cap | Truncation at boundary |

**Proposed test suite — `tests/` directory, using `pytest` + `flask_socketio.test_client`:**

**`tests/test_generators.py`** — Generator smoke tests
```python
import pytest
from server.activity_registry import REGISTRY

@pytest.mark.parametrize("type_name,cls", REGISTRY.items())
def test_generator_smoke(type_name, cls):
    gen = cls(intensity=5)
    payload = gen.initial_payload()
    assert isinstance(payload, dict)
    prev = payload
    for _ in range(10):
        frame = gen.next_frame()
        assert isinstance(frame, dict)
        if hasattr(gen, 'compute_delta') and gen.__class__.compute_delta is not cls.__bases__[0].compute_delta:
            delta = gen.compute_delta(prev, frame)
            assert delta is None or (isinstance(delta, dict) and delta.get('_delta') is True)
        prev = frame
```

**`tests/test_activity_manager.py`** — Loop resilience and channel isolation
```python
def test_loop_survives_generator_exception(mock_socketio, mock_emitter, config):
    """A generator that raises in next_frame() must not kill the loop."""
    manager = ActivityManager(mock_socketio, mock_emitter, config, room="test")
    manager.start()
    # Inject a broken generator
    broken = BrokenGenerator()  # next_frame() raises ValueError
    manager._activities["bad"] = ActivityRecord(broken, slot=0, ...)
    gevent.sleep(0.5)
    assert manager._running  # loop still alive
    assert "bad" not in manager._activities  # bad activity removed

def test_channel_isolation(mock_socketio, mock_emitter, config):
    """A text:update on channel 1 must not affect channel 2."""
    mgr1 = ActivityManager(..., room="channel:1")
    mgr2 = ActivityManager(..., room="channel:2")
    # spawn a text activity in each
    text_id_1 = mgr1.spawn_background_text()
    text_id_2 = mgr2.spawn_background_text()
    mgr1.update_text_activity(text_id_1, "hello", "sid_a")
    assert mgr2._activities[text_id_2].generator.text == ""  # channel 2 unaffected
```

**`tests/test_socket_handlers.py`** — Input fuzzing with Flask-SocketIO test client
```python
@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def sio_client(app, client):
    return flask_socketio.test_client(app, flask_test_client=client)

@pytest.mark.parametrize("bad_val", ["abc", None, [], {}, 1e308])
def test_channel_switch_bad_input_no_crash(sio_client, bad_val):
    sio_client.emit("channel:switch", {"channelId": bad_val})
    # Server must still respond to subsequent events
    sio_client.emit("configure:style", {"style": "dark"})
    received = sio_client.get_received()
    assert any(r["name"] == "configure:style" for r in received)

# Same pattern repeated for configure:intensity, configure:layout,
# configure:fg_count, window:pin, window:unpin
```

**`tests/test_delta.py`** — Delta round-trip correctness
```python
from server.generators.game_of_life import GameOfLifeActivity
from server.generators.seismograph import SeismographActivity

def _apply_delta(old_state, delta):
    """Python port of store.js:mergeActivityDelta for game_of_life."""
    cells = set(tuple(c) for c in old_state["cells"])
    for c in delta.get("born", []):   cells.add(tuple(c))
    for c in delta.get("died", []):   cells.discard(tuple(c))
    return {**old_state, "cells": [list(c) for c in cells],
            "generation": delta["generation"], "population": delta["population"]}

def test_game_of_life_delta_roundtrip():
    gen = GameOfLifeActivity(intensity=5)
    old = gen.initial_payload()
    for _ in range(5):
        new = gen.next_frame()
        delta = gen.compute_delta(old, new)
        if delta:
            reconstructed = _apply_delta(old, delta)
            assert set(tuple(c) for c in reconstructed["cells"]) == \
                   set(tuple(c) for c in new["cells"])
        old = new
```

---

## 5. Feature Completeness

*Reviewed from the perspective of a product engineer.*

### HIGH

**F1 — Generator exceptions kill the update loop permanently**
*(Also listed under Security C2 — the fix matters for reliability, not just security.)*

---

## Prioritised Remediation Plan

### Stage 1 — Crash & Reliability Fixes ✅ COMPLETE

1. ✅ **Fix C1/D2** — Added `_safe_int(val, default)` helper in `app.py`; wrapped all 6 `int()` conversions.
2. ✅ **Fix C2/F1** — Wrapped `next_frame()` in `try/except Exception` in `ActivityManager._loop`; logs error, removes faulty activity, continues loop.
3. ✅ **Fix Q5** — Added `skip_sid` param to `EventEmitter.emit_update`; `SyncManager.update_text` passes `skip_sid=sid` to avoid self-echo.
4. ✅ **Fix L1** — Changed `server/config.py` default to `muted: bool = False`.

### Stage 2 — Security Hardening ✅ COMPLETE

5. ✅ **Fix H1** — Removed hardcoded fallback; generates random key via `secrets.token_hex(32)` with startup warning.
6. ✅ **Fix H2/H3** — Added per-SID token-bucket rate limiter; tighter limits for `text:update`, `configure:slots`, `window:randomize`, `channel:create`. Added 100 ms broadcast debounce in `SyncManager.update_text`.
7. ✅ **Fix M1** — Added `len(slots) > 500` guard in `on_configure_slots`.
8. ✅ **Fix M2** — Replaced raw SID with opaque `#NNNN` label in `TextActivity`.

### Stage 3 — Code Quality & Refactoring ✅ COMPLETE

9. ✅ **Fix Q1** — Added `ActivityManager.update_text_activity()` method; `SyncManager` no longer accesses `_activities` directly.
10. ✅ **Fix Q2** — Removed `json.dumps` size comparison; always prefer delta when `compute_delta` returns non-None. Removed unused `import json`.
11. ✅ **Fix D1** — Deleted `_applySceneObj` from AppHeader; imports and calls `applyScene` from `keyboard.js`.
12. ✅ **Fix Q3** — Imported `showToast` in `AppHeader.js`; `doExportScenes` uses toast on success, alert on clipboard failure.
13. ✅ **Fix Q4** — Replaced `suppressNextWatch` boolean with `lastLocalEdit = Date.now()` timestamp; suppresses server updates for 1s after keystroke.
14. ✅ **Fix Q6** — `set_grid` now filters `_pending_closures` when slots are removed.
15. ✅ **Fix Q7** — GameOfLife reseed check now detects period-2 oscillators (`len(set(...)) <= 2`).

### Stage 4 — Test Suite (~4–8 hours)
*Build the safety net before adding more features.*

16. **Fix T1a** — Add `tests/test_generators.py`: smoke-test all 58 generators (as specified above). `pytest` + parametrize over `REGISTRY`.
17. **Fix T1b** — Add `tests/test_activity_manager.py`: loop-survives-exception test; channel isolation test (as specified above).
18. **Fix T1c** — Add `tests/test_socket_handlers.py`: fuzz all `int()`-consuming handlers with bad input types via Flask-SocketIO test client (as specified above).
19. **Fix T1d** — Add `tests/test_delta.py`: round-trip delta correctness for `game_of_life`, `seismograph`, `data_table`, `matrix_rain` (as specified above).

---

*Total estimated effort: ~11–15 hours across 4 stages.*
*Stage 1 (~2 hours) eliminates the two crash vectors and the startup-muted issue — safe to ship in the next deploy.*
