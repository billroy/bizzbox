---
# make-a-pong-world-scene-with-max-row-x-col-pong-play-klsA
title: Make a "Pong world" scene with max row x col pong play
status: review
type: task
priority: normal
assigned_to: 
created_at: 2026-10-20T19:07:48Z
updated_at: 2026-10-20T19:28:09Z
tags: []
last_stdout: ""
worker_requested_status: 
handoff_depth: 0
active_task_started_at: 
usage: [{timestamp: 2026-10-20T19:12:13Z, source: worker, provider: codex, model: gpt-6-sol, slot: 0, elapsed_ms: 66525, input_tokens: 371904, cached_input_tokens: 336896, output_tokens: 3299, reasoning_output_tokens: 1149}]
tokens_by_provider_model: [{provider: codex, model: gpt-6-sol, input_tokens: 371904, cached_input_tokens: 336896, output_tokens: 3299, reasoning_output_tokens: 1149, tokens: 375203}]
tokens: 375203
task_time_ms: 66526
commit_hash: 610a004ddf69bb1ed53faafb39c6adc421fd5af2
---
## Correction

The first implementation was not actually using the app's maximum selectable layout. It hard-coded `8×10`, which is not one of the layout presets, while the app's maximum preset and the `m` shortcut both resolve to `10×7`.

`Pong World` now derives its dimensions from the shared `MAX_GRID_PRESET`, so selecting the scene creates 70 background Pong activities with zero overlay windows. The `m` shortcut uses the same shared value to prevent the two features from drifting apart.

## Verification

- 15 JavaScript tests passed, including a new Pong World regression test.
- 151 Python tests passed.
- Pong World is present in the built-in scene selector, uses `10×7`, filters to `pong`, and sets `fgTarget` to `0`.
