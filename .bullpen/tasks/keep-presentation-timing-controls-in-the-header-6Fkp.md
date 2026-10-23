---
# keep-presentation-timing-controls-in-the-header-6Fkp
title: Keep presentation timing controls in the header
status: review
type: bug
priority: normal
assigned_to: 
created_at: 2026-10-23T18:22:12Z
updated_at: 2026-10-23T18:22:12Z
tags: [presentation, header, regression]
last_stdout: ""
---

## Description

Restore presentation timing controls to the control header.

The countdown, 15s/30s/1m/2m/5m timing pills, and Stop button must live inside the header beside the scene controls. They must not render as a persistent floating overlay because that interferes with screen recording.

Acceptance criteria:

- Presentation controls appear inside the control header while presentation mode is active.
- Dismissing or auto-hiding the header also hides the presentation controls.
- No floating presentation toolbar remains over activity content.
- Add regression coverage that asserts the controls remain nested inside the header.

Implemented and visually verified against the running app on port 5055. The complete JavaScript suite passes.

