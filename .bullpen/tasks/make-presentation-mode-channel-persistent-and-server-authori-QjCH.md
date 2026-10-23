---
# make-presentation-mode-channel-persistent-and-server-authori-QjCH
title: Make presentation mode channel-persistent and server-authoritative
status: review
type: bug
priority: high
assigned_to: 
created_at: 2026-10-23T19:16:26Z
updated_at: 2026-10-23T19:16:26Z
tags: [presentation, channels]
last_stdout: ""
---

## Description

Presentation mode was owned by the initiating browser tab, so closing or reconnecting that tab stopped transitions and other windows lacked synchronized controls. Move scheduling, playlist state, countdown deadlines, and transition phases to per-channel server state. Persist active presentations across browser disconnects and process restarts until an explicit stop. Cover creating a new channel, starting presentation, changing the interval, reconnecting with a fresh client, restoring durable state, channel isolation, and synchronized client controls. Never use the user's server on port 5055 for evaluation.
