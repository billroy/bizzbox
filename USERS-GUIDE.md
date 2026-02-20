# BizzBox User's Guide

BizzBox is a real-time cinematic operations dashboard that generates an endless stream of simulated activity panels. It displays network maps, radar sweeps, seismographs, terminal feeds, stock tickers, and dozens more — all procedurally generated with no real data. Designed for ambient displays, video backgrounds, escape rooms, film sets, and anyone who wants their screen to look like a movie command center.

---

## Table of Contents

- [Getting Started](#getting-started)
- [The Display](#the-display)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Themes](#themes)
- [Ambient Audio](#ambient-audio)
- [Grid Layout](#grid-layout)
- [Foreground Windows](#foreground-windows)
- [Activity Types](#activity-types)
- [Filtering Activities](#filtering-activities)
- [Pinning Slots](#pinning-slots)
- [Scenes](#scenes)
- [Channels](#channels)
- [Lock Mode](#lock-mode)
- [URL Parameters](#url-parameters)
- [Command-Line Options](#command-line-options)
- [Multi-Client Sync](#multi-client-sync)
- [Saved Preferences](#saved-preferences)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Requirements

- Python 3.10 or higher

### Installation

```bash
git clone <repo-url> bizzbox
cd bizzbox
pip install -r requirements.txt
```

Dependencies: Flask, Flask-SocketIO, eventlet, python-dotenv.

### Running

```bash
python app.py
```

Open **http://localhost:5000** in your browser. That's it — BizzBox starts immediately with a default 3×2 grid, 5 floating windows, the dark theme, and intensity 5.

---

## The Display

BizzBox has three visual layers:

1. **Background Grid** — A fixed grid of activity panels that fills the entire viewport. Each cell contains one activity that auto-rotates on a timer.

2. **Foreground Windows** — Draggable, resizable floating panels that hover above the grid. They appear and disappear on their own, or you can control them manually.

3. **Header Bar** — A translucent control strip along the top edge. It auto-hides when you move the mouse away. Press **Space** to pin it in place.

Every panel displays a different simulated visualization — radar sweeps, scrolling code, network graphs, heartbeat monitors, and 40 more types. All data is procedurally generated; nothing is real.

---

## Keyboard Shortcuts

All shortcuts work when no input field is focused.

| Key | Action |
|-----|--------|
| **T** | Cycle through all 13 themes |
| **A** | Cycle through ambient audio presets (or turn off) |
| **M** | Toggle mute (all audio on/off) |
| **F** | Toggle fullscreen |
| **R** | Shuffle — replace all activities with new random ones |
| **+** or **=** | Increase intensity (max 20) |
| **-** | Decrease intensity (min 1) |
| **}** | Add a foreground window (max 20) |
| **{** | Remove a foreground window (min 0) |
| **]** | Next channel |
| **[** | Previous channel |
| **Alt+1**–**Alt+9** | Jump to channel 1–9 |
| **Alt+0** | Jump to channel 10 |
| **Space** | Pin/unpin the header bar |
| **L** | Enter lock mode (cinematic, all UI hidden) |
| **Escape** | Exit lock mode |
| **?** or **H** | Toggle the help overlay |

Each shortcut shows a brief toast notification confirming the action.

---

## Themes

BizzBox includes 13 color themes. Press **T** to cycle through them, or select one from the header dropdown.

| Theme | Description |
|-------|-------------|
| **Dark** | Deep blue-black with cyan and lime accents. The default. |
| **Light** | Light gray background, blue and green accents. For well-lit rooms. |
| **Brutalist** | Pure black and white. Maximum contrast. |
| **Neon** | Deep purple with hot pink, lime, and violet. Cyberpunk energy. |
| **Rainbow** | Dark background with a full ROYGBIV color spectrum. |
| **Sunshine** | Warm cream background with orange and green. Daylight feel. |
| **Red** | Very dark red with red/orange accents. DEFCON alert mode. |
| **Black** | Pure black with bright green. Classic hacker terminal. |
| **LCARS** | Black with orange, pink, and lavender. Star Trek TNG aesthetic. |
| **Amber** | Dark brown with amber/yellow text. Retro phosphor CRT. |
| **Arctic** | Cold dark blue with ice-blue and cyan accents. Glacial. |
| **Synthwave** | Dark purple with cyan, green, and yellow. 1980s retro-futurism. |
| **Military** | Olive-dark with green and red. Tactical operations. |

Themes are applied via CSS custom properties, so every element — canvas visualizations, text panels, borders, headers — all adapt instantly.

You can also set a theme via URL (`?style=lcars`) or at startup (`--style red`).

---

## Ambient Audio

BizzBox synthesizes immersive background soundscapes using the Web Audio API — no audio files are needed. Press **A** to cycle through presets, or select one from the header.

| Preset | Character |
|--------|-----------|
| **Server Room** | Low 55Hz drone with filtered noise. Data center comfort. |
| **Forest Rain** | Rain patter with rolling thunder rumble. Soothing and natural. |
| **Drone Approaching** | Sawtooth motor hum, rotor chop, wind. Ominous and mechanical. |
| **Bunker Countdown** | Deep sub-bass pulse, fluorescent hum, ticking. Underground tension. |
| **Deep Space** | Slow detuned pads, cosmic crackle, infrasonic rumble. Vast and mysterious. |
| **War Room** | Low brass, radio static, heartbeat pulse. High alert. |
| **Ocean Depth** | Underwater rumble, whale calls, bubbles, deep currents. Aquatic. |
| **Power Plant** | 60/120/180Hz transformer harmonics, steam, machinery throb. Industrial. |
| **Arctic Wind** | Howling bandpassed wind, ice creaks, pressure rumble. Frozen and desolate. |
| **Coral Reef** | Gentle currents, bubble rhythm, whale calls, surface shimmer. Serene and alive. |
| **Thunderstorm** | Heavy rain, wind gusts, thunder rumble, lightning crackle. Dramatic. |

Volume scales with the intensity setting — higher intensity means louder ambient audio. Press **M** to mute all audio.

---

## Grid Layout

The background grid defines how many activity panels fill the screen. Choose a layout from the header dropdown or set it via URL parameter.

Available presets range from **2×1** (2 panels) up to **6×8** (48 panels). Some examples:

| Layout | Panels | Good For |
|--------|--------|----------|
| 3×2 | 6 | Default, casual viewing |
| 4×3 | 12 | Medium density |
| 6×4 | 24 | War room, large displays |
| 6×8 | 48 | Maximum density, video walls |

Panels are separated by a 2px gap. Each activity auto-scales to fill its cell. The grid is responsive to your viewport size.

---

## Foreground Windows

Floating windows appear above the grid, each showing its own activity. They add depth and visual interest.

**Controls:**

- **Drag** the title bar to move a window
- **Drag** any edge or corner to resize
- **Click** the **×** button to close
- **Click** anywhere on a window to bring it to front
- Press **}** to add a window, **{** to remove one
- The header has a window count control as well

Windows have random positions and sizes, and auto-replace themselves on a timer (roughly every 5–150 seconds). The target count (default 5) can be set from 0 to 20.

Each window's title bar shows the activity type. You can click the dropdown to replace it with a specific type or a random one.

---

## Activity Types

BizzBox includes **44 activity types** — 30 canvas-based animated visualizations and 14 DOM/text-based panels. Each type has multiple strategy variants with different titles and data patterns.

### Canvas Visualizations

| Type | What It Shows |
|------|---------------|
| **Radar** | Rotating sweep with contact blips (air traffic, sonar, weather, missile defense, astronomy) |
| **Network Topology** | Animated node graph with traffic flow pulses |
| **Oscilloscope** | Multi-channel waveform display (audio, EKG, seismic, logic analyzer) |
| **Geo Map** | World map with animated markers and highlighted regions |
| **SDR Waterfall** | Radio frequency spectrum with scrolling waterfall |
| **QAM Constellation** | Modulation phase-amplitude scatter plot |
| **Orbital View** | Satellite paths orbiting Earth |
| **Globe Arcs** | 3D globe with animated connection arcs between cities |
| **Weather Radar** | Doppler-style precipitation radar sweep |
| **Wireframe 3D** | Rotating wireframe objects (cube, torus, icosahedron, etc.) |
| **Game of Life** | Conway's cellular automata with auto-reseed |
| **Matrix Rain** | Falling green character streams |
| **Audio Spectrum** | Frequency analyzer bars |
| **Seismograph** | Three-channel seismic waveform monitor with magnitude display |
| **Facial Recognition** | Simulated face detection with bounding boxes and confidence scores |
| **Resource Gauges** | Circular and bar meters for CPU, memory, disk, network |
| **Camera Feed** | Simulated security camera view with grid overlay |
| **Heart Monitor** | ECG waveform with vital signs readout |
| **Transit Map** | Animated subway/rail map with moving trains |
| **Power Grid** | Electrical grid schematic with generator, transformer, and load nodes |
| **Satellite Telemetry** | Spacecraft instrument readouts and status panels |
| **Packet Sniffer** | Network packet capture flow visualization |
| **Access Control** | Badge/entry log with timestamps |
| **Stock Graph** | Candlestick or line chart with OHLC data |
| **Sonar** | Sonar sweep with bearing-time waterfall and contact returns |
| **Process Monitor** | System process table with CPU/memory bars |
| **CCTV Mosaic** | Multi-camera surveillance grid with scan lines |
| **Server Rack** | Rack unit display with LEDs, fans, CPU bars, and status badges |
| **Flight Tracker** | Aircraft radar with range rings, trails, and data tags |
| **Blockchain** | Block creation, transaction feed, mempool visualization |

### Text/DOM Panels

| Type | What It Shows |
|------|---------------|
| **Terminal** | Scrolling command-line output (intrusion detection, sysadmin, crypto mining, AI training) |
| **Code Scroll** | Syntax-highlighted source code streaming (Python, JavaScript, C, SQL, assembly) |
| **Log Tail** | Application log feed color-coded by severity |
| **Hex Dump** | Scrolling hex memory dump with ASCII sidebar |
| **Countdown** | Multi-field countdown timers (mission launch, system purge, detonation) |
| **Notifications** | Stacking alert cards with auto-dismiss |
| **Progress Bars** | Multiple animated progress bars with ETA |
| **DNA Sequence** | Scrolling colored nucleotide sequence (ACGT) |
| **Data Table** | Live-updating spreadsheet with cell-level changes |
| **Stock List** | Ticker-style scrolling price list |
| **Chat Intercept** | Simulated message intercept feed |
| **Cipher Decrypt** | Animated cipher-breaking process |
| **System Topology** | ASCII system architecture diagram |
| **Graph** | Dynamic line/bar/scatter chart |

Every type has 5 strategy variants with unique titles and data characteristics. The server picks randomly from weighted probabilities when spawning activities.

---

## Filtering Activities

If you don't want certain activity types to appear, you can filter them out.

1. Click the **filter icon** (funnel) in the header to open the filter modal
2. Uncheck any types you want to exclude
3. Close the modal

Filtered types won't spawn in new slots or windows. Already-running activities of filtered types continue until they naturally expire. The filter is saved automatically.

The filter modal includes a search box to quickly find specific types, and activities are organized by category.

---

## Pinning Slots

You can pin any background grid slot to always show a specific activity type.

1. **Right-click** on a background grid cell
2. Select an activity type from the context menu
3. That slot will now always respawn with the chosen type

To unpin, right-click the slot again and select **Random** (or **Unpin**).

Pinning is useful for creating a custom layout — for example, pin radar in the top-left, terminal in the center, and stock graphs along the bottom.

---

## Scenes

Scenes are preset combinations of theme, grid layout, intensity, window count, and ambient audio. Load one instantly from the header's scene dropdown.

### Built-In Scenes

| Scene | Theme | Grid | Intensity | Windows | Ambient |
|-------|-------|------|-----------|---------|---------|
| **War Room** | Red | 6×4 | 15 | 5 | War Room |
| **Ambient** | Dark | 3×2 | 2 | 0 | Deep Space |
| **Hacker Den** | Neon | 4×3 | 10 | 3 | Server Room |
| **Mission Control** | Black | 6×4 | 8 | 0 | Bunker Countdown |
| **Surveillance** | Brutalist | 5×4 | 6 | 2 | Power Plant |
| **Chaos** | Rainbow | 6×8 | 20 | 10 | (none) |

### Custom Scenes

You can save your current configuration as a custom scene:

1. Set up the display exactly how you want it
2. Open the scene dropdown in the header
3. Click **Save Current as Scene**
4. Give it a name

Custom scenes are stored in your browser's localStorage and persist across page reloads. You can delete them from the same dropdown.

---

## Channels

Channels let multiple independent shows run on the same server. Each channel has its own activities, theme, intensity, layout, and window count. Clients can switch between channels to watch different shows or create new channels with fresh random content.

### How Channels Work

- The server starts with **Channel 1** as the default
- Any client can create new channels up to the server's maximum (default 10)
- Each channel runs its own ActivityManager with independent content and timing
- Changes to a channel (theme, intensity, layout, etc.) are broadcast only to clients viewing that channel
- Channel state is ephemeral — all channels are lost on server restart
- Empty channels persist until server restart

### Channel Controls

The header bar shows a **channel selector dropdown** near the left, displaying all channels with their current viewer counts (e.g., "Channel 1 (3)"). Next to it, a **+** button creates a new channel and switches you to it. The button is disabled when the maximum number of channels has been reached.

A **viewer count** indicator shows how many clients are in your current channel and the total across all channels (e.g., "3/5 Watching").

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **[** | Switch to previous channel |
| **]** | Switch to next channel |
| **Alt+1**–**Alt+9** | Jump directly to channel 1–9 |
| **Alt+0** | Jump directly to channel 10 |

### Selecting a Channel via URL

You can link directly to a specific channel by name:

```
http://localhost:5000?channel=Channel+3
```

The match is case-insensitive. If the named channel exists when the page loads, the client automatically switches to it. If it does not exist, the client stays on the default channel.

This is useful for setting up dedicated displays — for example, one screen per channel on a video wall.

### Server Configuration

The maximum number of channels is controlled at startup:

```bash
python app.py --max-channels 20
```

The default is 10, and the allowed range is 1–50.

---

## Lock Mode

Lock mode hides all UI elements for a clean, cinematic display — perfect for video backgrounds, escape rooms, or unattended ambient screens.

**Enter:** Press **L** or use the header button.

**In lock mode:**
- Header, footer, and all controls are hidden
- Mouse cursor disappears after 2 seconds of inactivity (reappears on movement)
- All keyboard shortcuts are disabled except **L** and **Escape** to exit
- Activities continue animating normally
- Audio continues playing

**Exit:** Press **L** or **Escape**.

You can also start in lock mode via URL: `?lock=1`

---

## URL Parameters

Override any setting by adding query parameters to the URL:

```
http://localhost:5000?style=red&intensity=15&layout=6x4&windows=0&muted=1&lock=1
```

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `style` | Any theme name | `dark` | Color theme |
| `intensity` | 1–20 | 5 | Update speed |
| `layout` | `COLSxROWS` | `3x2` | Grid dimensions |
| `windows` | 0–20 | 5 | Foreground window count |
| `muted` | `0` or `1` | `0` | Start muted |
| `lock` | `1` | off | Start in lock mode |
| `channel` | Channel name | `Channel 1` | Join a specific channel by name (case-insensitive) |

URL parameters override saved preferences, which override server defaults.

### Example URLs

```bash
# Calm ambient display
http://localhost:5000?style=dark&intensity=2&layout=3x2&windows=0

# Intense war room
http://localhost:5000?style=red&intensity=15&layout=6x4&windows=5

# LCARS in lock mode (Star Trek bridge)
http://localhost:5000?style=lcars&lock=1

# Minimal, muted
http://localhost:5000?intensity=3&windows=0&muted=1

# Join Channel 3 directly
http://localhost:5000?channel=Channel+3
```

---

## Command-Line Options

Configure the server at startup:

```bash
python app.py [OPTIONS]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--style` | `dark` | Initial theme (any of the 13 theme names) |
| `--intensity` | `5` | Mean updates per second (1 = serene, 20 = frenetic) |
| `--fg-target` | `5` | Starting foreground window count (0–20) |
| `--sync-mode` | `synced` | `synced` (all clients share one show) or `unsynced` (independent) |
| `--max-channels` | `10` | Maximum number of channels (1–50) |
| `--host` | `0.0.0.0` | Bind address |
| `--port` | `5000` | Bind port (or set `$PORT` env var) |

### Examples

```bash
# Calm ambient with no floating windows
python app.py --style dark --intensity 2 --fg-target 0

# High-energy red war room
python app.py --style red --intensity 15 --fg-target 8

# Each browser gets its own independent show
python app.py --sync-mode unsynced

# LCARS theme on a custom port
python app.py --style lcars --port 8080
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `SECRET_KEY` | `bizzbox-dev-secret` | Flask secret key |

You can create a `.env` file for local environment variables.

---

## Multi-Client Sync

BizzBox supports multiple browser clients connecting to the same server.

### Synced Mode (default)

All connected clients in the same **channel** see the exact same show — same activities, same positions, same timing. Changes made on one client (theme, intensity, layout) propagate to all others in that channel. Clients in different channels are completely independent. This is ideal for display walls, installations, and synchronized presentations.

See [Channels](#channels) for details on creating and switching between channels.

### Unsynced Mode

Each client gets its own independent show with different randomly-generated activities. Set at startup with `--sync-mode unsynced`. Channels are not available in unsynced mode. Useful for multi-user exploration or when you want each screen to be unique.

| Feature | Synced | Unsynced |
|---------|--------|----------|
| Activities | Same for all clients in a channel | Different per client |
| Theme changes | All clients in channel update | Only sender updates |
| Intensity changes | All clients in channel update | Only sender updates |
| Pinned slots | Shared within channel | Independent |
| Channels | Yes (up to max) | Not available |

Sync mode is set at server startup and cannot be changed at runtime.

---

## Saved Preferences

Your settings are automatically saved to your browser's localStorage and restored when you reload the page. Saved preferences include:

- Theme
- Grid layout
- Intensity
- Mute state
- Ambient preset
- Activity filter
- Foreground window count
- Header pinned state
- Custom scenes

**Priority order:** URL parameters > saved preferences > server defaults.

To clear all saved preferences, open your browser's developer console and run:

```js
localStorage.removeItem('bizzbox_prefs');
localStorage.removeItem('bizzbox_custom_scenes');
```

Then reload the page.

---

## Troubleshooting

**Activities not updating?**
Check the intensity setting (press **+** to increase). If the display seems frozen, try pressing **R** to shuffle. If you see a reconnection overlay, the server may have restarted — the client will auto-reconnect.

**No audio?**
Press **M** to unmute. If still silent, make sure you've interacted with the page (clicked or pressed a key) — browsers require a user gesture before playing audio. Check that an ambient preset is selected (press **A**).

**Display is lagging?**
Reduce the intensity (press **-**), remove foreground windows (press **{**), or choose a smaller grid layout. Close other browser tabs to free up resources.

**UI elements disappeared?**
You may be in lock mode. Press **L** or **Escape** to exit. Or press **Space** to toggle the header if it's auto-hiding.

**"RECONNECTING..." overlay?**
The connection to the server was lost. BizzBox will automatically retry with exponential backoff. Make sure the server is still running. Once reconnected, the display will restore itself and show a "RECONNECTED" toast.

**Different clients showing different things in synced mode?**
This is expected briefly during transitions. If it persists, reload the page — the client will receive the full current state on reconnect.
