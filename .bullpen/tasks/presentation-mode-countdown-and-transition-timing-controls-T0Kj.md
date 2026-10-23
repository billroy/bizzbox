---
# presentation-mode-countdown-and-transition-timing-controls-T0Kj
title: Presentation mode countdown and transition timing controls
status: review
type: feature
priority: normal
assigned_to: 
created_at: 2026-10-23T18:11:05Z
updated_at: 2026-10-23T18:11:05Z
tags: [presentation, ui]
last_stdout: ""
---

## Description

Add persistent presentation-mode timing controls:

- Show a live countdown to the next scene transition while presentation mode is active.
- Provide 15s, 30s, 1m, 2m, and 5m timing pills.
- Reset the upcoming transition when a timing pill is selected and use that timing for subsequent transitions.
- Keep the toolbar visible when the main header auto-hides.
- Clear countdown and timers when presentation mode stops.

Implemented with focused timer tests. JavaScript and Python test suites pass.

