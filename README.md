# BizzBox

A real-time, cinematic operations dashboard that generates an endless stream of simulated activity panels — network maps, seismographs, radar sweeps, terminal feeds, stock tickers, and dozens more. Built for ambient displays, video backgrounds, escape rooms, film sets, or anyone who wants their screen to look like a high-tech command center.

No data is real. No databases required. Everything is procedurally generated in real-time.

## Features

- **38 activity types** — canvas-rendered visualizations (radar, globe arcs, wireframe 3D, game of life, weather radar, etc.) and DOM-based panels (terminals, log tails, data tables, stock tickers, chat intercepts, etc.)
- **11 color themes** — Dark, Light, Brutalist, Neon, Rainbow, Sunshine, Red, Black, LCARS, Amber, Arctic
- **9 synthesized ambient soundscapes** — server room hum, forest rain, deep space drone, war room tension, and more — all generated via Web Audio API with zero audio files
- **6 preset scenes** — War Room, Ambient, Hacker Den, Mission Control, Surveillance, Chaos — plus custom scene save/load
- **Configurable grid layouts** — from 2x1 to 6x8 background panels
- **Draggable/resizable foreground windows** with z-ordering
- **Background slot pinning** — right-click any background panel to lock it to a specific activity type
- **Activity type filtering** — exclude specific activity types from spawning
- **Lock mode** — hides all UI for clean ambient display; cursor auto-hides after 2 seconds
- **Multi-client sync** — all connected browsers see the same show (synced mode) or run independently (unsynced mode)
- **Delta state compression** — bandwidth-optimized updates for data-heavy activities (seismograph, game of life, data tables)
- **URL query parameters** — link directly to a specific configuration
- **localStorage persistence** — your preferences survive page reloads
- **Zero build step** — no webpack, no npm, no bundler. Vue 3 and Socket.IO loaded directly. Just Python.

## Quick Start

### Prerequisites

- Python 3.10+

### Install

```bash
git clone <repo-url> bizzbox
cd bizzbox
pip install -r requirements.txt
```

### Run

```bash
python app.py
```

Open **http://localhost:5000** in your browser.

### CLI Options

```
python app.py [OPTIONS]

  --style THEME        Initial theme (default: dark)
                       Choices: dark, light, brutalist, neon, rainbow,
                       sunshine, red, black, lcars, amber, arctic

  --intensity N        Mean updates per second, 1-20 (default: 5)
                       1 = serene, 5 = moderate, 10+ = frenetic

  --fg-target N        Foreground floating windows, 0-20 (default: 5)

  --sync-mode MODE     synced = all clients share one show (default)
                       unsynced = each client gets its own

  --host HOST          Bind address (default: 0.0.0.0)
  --port PORT          Bind port (default: 5000, or $PORT env var)
```

**Examples:**

```bash
# Calm ambient display, no floating windows
python app.py --style dark --intensity 2 --fg-target 0

# Frenetic war room with red theme
python app.py --style red --intensity 15 --fg-target 8

# LCARS theme for a Star Trek bridge set piece
python app.py --style lcars --intensity 4
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `M` | Toggle mute |
| `F` | Toggle fullscreen |
| `R` | Randomize all activities |
| `+` / `=` | Increase intensity |
| `-` | Decrease intensity |
| `]` | Add a foreground window |
| `[` | Remove a foreground window |
| `Space` | Toggle header bar visibility |
| `A` | Cycle ambient audio presets |
| `L` | Enter lock mode (press `L` or `Esc` to exit) |
| `?` / `H` | Toggle help overlay |

## URL Parameters

Override any setting via query string:

```
http://localhost:5000?style=red&intensity=15&layout=6x4&windows=0&muted=0&lock=1
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `style` | Any theme name | Override color theme |
| `intensity` | 1-20 | Override update speed |
| `layout` | `COLSxROWS` (e.g. `6x4`) | Override background grid size |
| `windows` | 0-20 | Override foreground window count |
| `muted` | `0` or `1` | Start unmuted or muted |
| `lock` | `1` | Start in lock mode |

URL parameters take priority over saved preferences.

## Scenes

Six built-in scenes configure theme, layout, intensity, window count, and ambient audio as a preset:

| Scene | Theme | Grid | Intensity | Windows | Ambient |
|-------|-------|------|-----------|---------|---------|
| War Room | Red | 6x4 | 15 | 5 | War Room |
| Ambient | Dark | 3x2 | 2 | 0 | Deep Space |
| Hacker Den | Neon | 4x3 | 10 | 3 | Server Room |
| Mission Control | Black | 6x4 | 8 | 0 | Bunker Countdown |
| Surveillance | Brutalist | 5x4 | 6 | 2 | Power Plant |
| Chaos | Rainbow | 6x8 | 20 | 10 | None |

Custom scenes can be saved and loaded from the header dropdown. They persist in localStorage.

## Activity Types

### Canvas Visualizations

| Activity | Description |
|----------|-------------|
| Radar | Rotating sweep with contact blips |
| Network Topology | Animated node graph with traffic pulses |
| Oscilloscope | Multi-channel waveform display |
| Geo Map | Geographic map with highlighted regions |
| SDR Waterfall | Software-defined radio spectrum waterfall |
| QAM Constellation | Modulation constellation diagram |
| Orbital View | Satellite orbital paths around Earth |
| Globe Arcs | 3D globe with connection arcs between cities |
| Weather Radar | Doppler-style precipitation map |
| Wireframe 3D | Rotating 3D wireframe objects |
| Game of Life | Conway's cellular automata with auto-reseed |
| Matrix Rain | Falling green character streams |
| Audio Spectrum | Frequency spectrum analyzer bars |
| Seismograph | Three-channel seismic waveform monitor |
| Facial Recognition | Simulated face detection with bounding boxes |
| Resource Gauges | Animated circular/bar resource meters |
| Camera Feed | Simulated security camera views |
| Heart Monitor | ECG/vitals display with waveforms |
| Transit Map | Animated transit/subway map |
| Power Grid | Electrical grid with load visualization |
| Satellite Telemetry | Satellite systems telemetry readouts |
| Packet Sniffer | Network packet capture visualization |
| Access Control | Badge/access log with entry tracking |
| Stock Graph | Candlestick/line stock chart |

### DOM/Text Panels

| Activity | Description |
|----------|-------------|
| Terminal | Scrolling command-line output |
| Code Scroll | Syntax-highlighted code streaming |
| Log Tail | Application log feed with severity levels |
| Hex Dump | Scrolling hexadecimal memory dump |
| Countdown | Multi-field countdown timers |
| Notifications | Stacking alert/notification cards |
| Progress Bars | Animated multi-bar progress display |
| DNA Sequence | Scrolling nucleotide sequence |
| Data Table | Live-updating spreadsheet/table |
| Stock List | Ticker-style stock price list |
| Chat Intercept | Simulated message intercept feed |
| Cipher Decrypt | Animated cipher-breaking display |
| System Topology | System architecture diagram |

Each activity type has multiple visual strategies (e.g., Game of Life has random soup, glider storm, oscillator garden, spaceship fleet, and methuselah seedings).

## Architecture

```
Client (Browser)                    Server (Python)
─────────────────                   ────────────────
Vue 3 reactive store     <──WS──>   Flask-SocketIO + gevent
  ├── BackgroundGrid                  ├── SyncManager (rooms, state sync)
  ├── ForegroundLayer                 ├── ActivityManager (lifecycle loop)
  ├── AppHeader                       └── Generators (38 BaseActivity subclasses)
  └── 36 activity components              └── Each produces state dicts at ~30 Hz
```

- **Server** runs a ~30 Hz loop per room, ticking each activity generator and emitting state updates over WebSocket. Activities have randomized lifespans and are automatically replaced when they expire.
- **Client** receives state dicts and renders them via Vue 3 components. Canvas-based activities draw directly; DOM activities use reactive templates. No build step — Vue 3 and Socket.IO are loaded as global scripts.
- **Delta compression** reduces bandwidth for large-state activities. The server diffs each frame against the previous one and sends only changes when smaller. Full keyframes are sent every 30 updates to prevent drift.

## Deployment

### Heroku

The included `Procfile` and `runtime.txt` support direct Heroku deployment:

```bash
heroku create my-bizzbox
git push heroku main
```

### Docker (manual)

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["python", "app.py"]
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `SECRET_KEY` | `bizzbox-dev-secret` | Flask secret key (change in production) |

Copy `.env.example` to `.env` to configure locally.

## License

MIT License. See [LICENSE.txt](LICENSE.txt) for details.
