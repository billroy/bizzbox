---
# oscilloscope-traces-render-as-solid-saturated-bars-iehe
title: Oscilloscope traces render as solid saturated bars
status: review
type: bug
priority: normal
assigned_to: 
created_at: 2026-10-23T18:46:43Z
updated_at: 2026-10-23T18:46:43Z
tags: [oscilloscope, visualization, regression]
last_stdout: ""
---

## Description

Fix oscilloscope activities such as BIOSIGNAL TRACE rendering as nearly solid, fully saturated bands with little visible modulation.

Root causes:

- Every signal strategy used the same one-second display window, packing high-frequency AC, carrier, and brain-wave signals too densely into small tiles.
- A fixed 8px glow merged dense traces into solid-looking bars.
- Titles were selected independently of signal strategy, allowing BIOSIGNAL TRACE to display power-grid AC or radio carrier data.

Resolution:

- Use a strategy-specific timebase so each trace has a readable number of cycles.
- Smooth sample noise and scale glow/line thickness to canvas height.
- Match titles to their generated signal strategy.
- Add regression tests for visible crossing bounds, dynamic range, and title/strategy consistency.

Verified with 28 JavaScript tests and 162 Python tests passing.

