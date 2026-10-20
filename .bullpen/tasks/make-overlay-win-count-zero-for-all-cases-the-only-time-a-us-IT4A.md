---
# make-overlay-win-count-zero-for-all-cases-the-only-time-a-us-IT4A
title: Make overlay win count zero for all cases.  the only time a user should see overlay windows is if they drag the slider to make some.
status: in_progress
type: task
priority: normal
assigned_to: 0
created_at: 2026-10-20T18:57:22Z
updated_at: 2026-10-20T19:00:48Z
tags: []
last_stdout: ""
worker_requested_status: 
handoff_depth: 0
active_task_started_at: 
usage: [{timestamp: 2026-10-20T19:00:48Z, source: worker, provider: codex, model: gpt-6-sol, slot: 0, elapsed_ms: 130857, input_tokens: 1111198, cached_input_tokens: 1057536, output_tokens: 8238, reasoning_output_tokens: 1824}]
tokens_by_provider_model: [{provider: codex, model: gpt-6-sol, input_tokens: 1111198, cached_input_tokens: 1057536, output_tokens: 8238, reasoning_output_tokens: 1824, tokens: 1119436}]
tokens: 1119436
task_time_ms: 130858
---


## Agent Output

### 2026-10-20T19:00:48Z — Fix-n-Commit Codex (codex/gpt-6-sol)

**Fixed the overlay defaults.** Every built-in scene starts with WIN COUNT at 0, and applying any scene resets it to 0. Startup preferences and URLs no longer restore floating windows. The WIN COUNT slider remains the user-facing control that creates them.

I removed the separate spawn control and window-count shortcut, updated the guides, and added a server test covering both slider creation and scene reset. Verification: **149 tests passed**; JavaScript syntax checks passed.
