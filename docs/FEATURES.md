Feature Candidates:

## Layout & Window Management

- **Configurable grid layout**: Add the ability to specify the layout (number of activities wide x high) for the base grid. Recommend a dropdown with preset options (2x1, 3x1, 2x2, 3x2, 4x2, 3x3, 4x3) — presets keep the grid looking good and avoid edge cases. The current `GRID_CONFIGS` in layout.js already has this mapping pattern to build on.

- **Default 3x2 layout**: Make the default layout have six activities in the background grid, 3 wide by 2 high.

- **Resizable windows**: Make the activity windows resizable via corner/edge drag handles with min/max constraints. Should broadcast size changes via socket (like `window:move` does for position) to keep synced clients consistent.

## Window Header Controls

- **Selectable activity type in header**: Add a dropdown to the activity header with all the activity types. Selecting one despawns the current activity and spawns a new window of the selected type with the same size and position. The registry already maps type names to classes so this is straightforward.

- **Respawn button**: Add a "respawn" button to the activity header with a recycle-style icon. Clicking replaces the current activity window (same mechanism as the dropdown) with a different, randomly chosen activity in the same window size and position. Good complement to the dropdown for quick variety.

## Themes

- **"Red" style mode**: Military/DEFCON red alert aesthetic. Deep black background, red-only accents, minimal glow, maybe a subtle red-tinted scanline overlay. Fits the existing theme system pattern perfectly.

## New Activity Types

- **Graph**: Line chart of a variable like stock price, temperature, or population over time. Should include animated real-time scrolling with new data points arriving at the leading edge. A movie-screen staple.
  - Strategies: `stock_ticker`, `temperature_monitoring`, `population_growth`, `network_throughput`, `seismic_amplitude`

- **Orbital View**: 3D view of the Earth with 1–30 satellite orbits superimposed. Satellites update position in real time. Display a mix of LEO, Mid, and Geosynchronous orbits with random inclinations and argument of perigee.  Use Canvas with orthographic or perspective projection.
  - Strategies: `leo_constellation`, `gps_network`, `spy_satellites`, `space_debris`, `comms_relay`

- **Matrix Rain**: The iconic falling green characters effect — a cinematic classic that's conspicuously absent from the current set. Columns of characters cascading at varying speeds with bright leading edges and fading tails.
  - Strategies: `classic_green`, `kanji_mix`, `binary_rain`, `cipher_stream`, `multicolor`

- **Audio Spectrum Analyzer**: Animated bar or curve frequency visualization, like music visualizer displays often seen on "hacker screens" and command centers. Bars react to simulated audio signal data.
  - Strategies: `eq_bars`, `smooth_curve`, `mirrored_spectrum`, `octave_bands`, `waveform_peaks`

- **Data Table / Spreadsheet**: Scrolling rows of tabular data with highlighted and changing cells. Think financial trading desks, intelligence databases, or logistics dashboards.
  - Strategies: `financial_ledger`, `intel_database`, `server_inventory`, `flight_manifest`, `sensor_readings`

- **Progress Bar Panel**: Multiple concurrent progress bars (file transfers, uploads, decryption, compilation) each advancing at different rates, completing and restarting with new tasks.
  - Strategies: `file_transfer`, `system_update`, `data_migration`, `compilation`, `encryption`

- **Binary / DNA Sequence**: Scrolling DNA base pairs (ATCG) or binary streams with highlighted pattern matches and annotations. Biotech and crypto aesthetic.
  - Strategies: `genome_sequencing`, `binary_stream`, `protein_folding`, `cryptanalysis`, `virus_signature`

- **Camera Feed Grid**: Simulated multi-camera security feed with static noise texture, timestamp overlays, and occasional "signal lost" glitches. 2x2 or 3x3 sub-grid within the activity window.
  - Strategies: `building_security`, `traffic_cams`, `satellite_feeds`, `drone_surveillance`, `underwater_cams`

- **Cipher / Decrypt Animation**: Animated text decryption effect where garbled characters progressively resolve into readable text, then restart with new content. The classic "cracking the code" visual.
  - Strategies: `military_decrypt`, `password_crack`, `enigma_decode`, `rsa_factoring`, `alien_signal`

- **System Topology / Rack Diagram**: Visual server rack with blinking status indicator lights and animated data flow lines between components. Top-down or front-facing rack view.
  - Strategies: `data_center_rack`, `network_closet`, `mission_control`, `telecom_exchange`, `lab_equipment`

- **Globe with Connection Arcs**: Rotating wireframe globe with animated arc connections between cities/nodes. Different from Orbital View — this focuses on network/data flow visualization rather than satellite orbits.
  - Strategies: `cdn_network`, `cyber_attacks`, `trade_routes`, `submarine_cables`, `airline_routes`
