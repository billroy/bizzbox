---
# never-ever-inherit-activities-from-the-previous-setup-when-s-Fdr1
title: Never ever inherit activities from the previous setup when switching scenes.  I still see many, many cases when switching from tictactoe to anything else ends up with a jillion tictactoe activities.
status: done
type: task
priority: normal
assigned_to: 
created_at: 2026-10-20T18:21:57Z
updated_at: 2026-10-20T18:50:38Z
tags: []
last_stdout: ""
worker_requested_status: 
handoff_depth: 0
active_task_started_at: 
task_time_ms: 153147
history:
  - {timestamp: 2026-10-20T18:23:40Z, event: retry, detail: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account."}}}
usage: [{timestamp: 2026-10-20T18:39:28Z, source: worker, provider: codex, model: gpt-6-sol, slot: 0, elapsed_ms: 145130, input_tokens: 1195954, cached_input_tokens: 1138560, output_tokens: 8717, reasoning_output_tokens: 2999}]
tokens_by_provider_model: [{provider: codex, model: gpt-6-sol, input_tokens: 1195954, cached_input_tokens: 1138560, output_tokens: 8717, reasoning_output_tokens: 2999, tokens: 1204671}]
tokens: 1204671
commit_hash: bee0d580664da9bdfd0f488a32f8b200d38d4e5f
---


## Agent Output

### 2026-10-20T18:23:40Z — Fix-n-Commit Codex (codex/gpt-5.5)

[RETRYING in 5s] {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account."}}

### 2026-10-20T18:23:48Z — Fix-n-Commit Codex (codex/gpt-5.5)

[BLOCKED] {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account."}}

### 2026-10-20T18:39:28Z — Fix-n-Commit Codex (codex/gpt-6-sol)

**Fixed scene switching.** Scene selection now sends one server operation that clears the previous activities and their delayed replacements before building the new scene. The client also clears the old activity filter when the new scene allows all types.

Added regression coverage for switching away from tic-tac-toe, including pinned activities and pending replacements. All 143 tests pass, and the changed JavaScript files pass syntax checks.

### 2026-10-20T18:39:28Z — Fix-n-Commit Codex (codex/gpt-6-sol)

Commit: bee0d580664da9bdfd0f488a32f8b200d38d4e5f
