---
# air-routes-shows-undefined-too-much-like-mostly-CbPG
title: Air Routes shows Undefined too much, like mostly
status: review
type: task
priority: normal
assigned_to: 
created_at: 2026-10-20T18:36:12Z
updated_at: 2026-10-20T18:42:06Z
tags: []
last_stdout: ""
worker_requested_status: 
handoff_depth: 0
active_task_started_at: 
usage: [{timestamp: 2026-10-20T18:42:06Z, source: worker, provider: codex, model: gpt-6-sol, slot: 0, elapsed_ms: 44469, input_tokens: 366261, cached_input_tokens: 335488, output_tokens: 2467, reasoning_output_tokens: 366}]
tokens_by_provider_model: [{provider: codex, model: gpt-6-sol, input_tokens: 366261, cached_input_tokens: 335488, output_tokens: 2467, reasoning_output_tokens: 366, tokens: 368728}]
tokens: 368728
task_time_ms: 44471
commit_hash: 8fb220355958db56afd9e2861134c5f3ab1c4489
---


## Agent Output

### 2026-10-20T18:42:06Z — Fix-n-Commit Codex (codex/gpt-6-sol)

Fixed the “Undefined” labels in Air Routes. The client replaces the globe’s node array on each update, but those updates omitted node names. Updates now include the names, and a regression test checks that labels survive repeated updates.

Verification: 125 tests passed.

### 2026-10-20T18:42:06Z — Fix-n-Commit Codex (codex/gpt-6-sol)

Commit: 8fb220355958db56afd9e2861134c5f3ab1c4489
