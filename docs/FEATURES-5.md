# FEATURES-5

## 1. Keyboard shortcuts

Add keyboard controls that work when the header is hidden:

- `M` — toggle mute
- `F` — toggle fullscreen
- `R` — shuffle/randomize all activities
- `+` / `=` — increase intensity
- `-` — decrease intensity
- `[` — decrease foreground window count
- `]` — increase foreground window count
- `Space` — show/hide header (toggle pinned)
- `L` — lock mode (see item 2)

Display a small "?" help overlay (toggled by `?` or `H`) showing available shortcuts.

## 2. Lock mode

A display-only mode for running BizzBox as an ambient installation:

- Hides the header completely (not just auto-hide — fully disabled)
- Disables all mouse interaction (no drag, no resize, no right-click menus)
- Cursor hidden after 2 seconds of inactivity
- Only `L` or `Escape` exits lock mode
- URL param `?lock=1` enters lock mode on load

## 3. URL query parameter overrides

Support configuration via URL query string so bookmarks/embeds can set initial state:

- `?style=red`
- `?layout=6x4`
- `?intensity=12`
- `?windows=3` (fg_target)
- `?muted=0` or `?muted=1`
- `?lock=1`

Parameters override server defaults on initial connect. Multiple params combine: `?style=neon&layout=5x3&intensity=15&lock=1`

## 4. Activity type filter / exclusion

Let users disable specific activity types from the random spawn pool:

- New header button "FILTER" opens a modal/overlay listing all 30 activity types with checkboxes
- Unchecked types are excluded from random selection (but can still be manually spawned via the type dropdown)
- Filter state is sent to server: `configure:activity_filter` with list of enabled types
- Server-side: `ActivityManager` passes the filter to `registry.random_type()` to exclude disabled types
- Default: all enabled

## 5. Ambient background soundscape

Add a continuous low-level background audio layer:

- Subtle server room hum / electronic drone (synthesized, no audio files)
- Layered: low-frequency oscillator + filtered noise + occasional subtle sweep
- Volume scales with intensity slider (intensity 1 = barely audible, intensity 20 = prominent)
- Independent of the mute toggle — has its own "AMBIENCE" on/off in the header, but master mute overrides it
- Smooth crossfade when toggling

## 6. Spawn transition effects

Replace the uniform fade-in/fade-out with more cinematic transitions:

- On spawn: brief static/noise flash (canvas overlay, 100-200ms) before the activity fades in
- On despawn: glitch effect (brief horizontal slice displacement, 150ms) then fade out
- Background activities: quick cut (no fade) for a more "switching channels" feel
- Foreground windows: keep the current smooth fade but add a subtle scale-up on spawn (0.95→1.0)

## 7. New activity: Chat/Comms Intercept

Simulated intercepted communications feed:

- Strategies: `military_comms`, `diplomatic_cable`, `field_ops`, `cyber_intel`, `emergency_dispatch`
- State: array of message objects with `timestamp`, `callsign_from`, `callsign_to`, `body`, `classification` (UNCLASSIFIED, CONFIDENTIAL, SECRET, TOP SECRET), `redacted_pct`
- Callsigns are randomly generated (e.g., FALCON-7, BRAVO ACTUAL, STATION-12)
- Some words in message body are replaced with `[REDACTED]` blocks (percentage varies by classification)
- Messages appear one at a time, scrolling up
- Client renderer: HTML/CSS (not canvas) — styled like a secure terminal printout with color-coded classification banners

## 8. New activity: 3D Wireframe

Rotating wireframe mesh rendered with simple 3D→2D projection:

- Strategies: `cube`, `torus`, `icosahedron`, `double_helix`, `random_mesh`
- Server sends vertex and edge arrays, plus a rotation matrix that advances each frame
- Client renders with canvas line drawing — green/cyan lines on black, with depth-based opacity (far edges dimmer)
- Slow continuous rotation on two axes
- Optional: vertex labels with coordinates

## 9. New activity: Power Grid

Animated electrical/circuit schematic:

- Strategies: `power_plant`, `data_center_ups`, `industrial_control`, `home_automation`, `spacecraft_eps`
- State: `nodes` (generators, transformers, breakers, loads) with position, type, status (online/offline/fault), `edges` (power lines) with current flow value, `readings` (voltage, amperage, frequency, load %)
- Nodes blink or pulse when status changes
- Current flow animated as moving dashes along edges (direction indicates flow)
- Client: canvas renderer with schematic-style drawing (straight lines, right angles, standard electrical symbols)

## 10. Preset scenes

Save and recall named configurations:

- A "SCENES" dropdown in the header with built-in presets:
  - **War Room** — red theme, 6×4, intensity 15, 5 windows
  - **Ambient** — dark theme, 3×2, intensity 2, 0 windows
  - **Hacker Den** — neon theme, 4×3, intensity 10, 3 windows
  - **Mission Control** — black theme, 6×4, intensity 8, 0 windows
  - **Surveillance** — brutalist theme, 5×4, intensity 6, 2 windows
  - **Chaos** — rainbow theme, 6×8, intensity 20, 10 windows
- Selecting a preset applies theme + layout + intensity + fg_target all at once
- Future: allow saving custom presets (localStorage on client)

## 11. Tune activity weights

Adjust the spawn weights in `activity_registry.py` for more dramatic differentiation:

- Visually spectacular types get higher weights: `matrix_rain` 2.0, `globe_arcs` 1.8, `orbital_view` 1.8, `cipher_decrypt` 1.6, `heart_monitor` 1.5, `weather_radar` 1.5, `stock_graph` 1.5
- Less visually interesting types get lower weights: `countdown` 0.3, `notifications` 0.4, `progress_bars` 0.5, `data_table` 0.5
- This makes the random pool feel more curated without removing any types
