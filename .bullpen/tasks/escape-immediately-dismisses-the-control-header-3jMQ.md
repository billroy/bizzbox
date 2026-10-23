---
# escape-immediately-dismisses-the-control-header-3jMQ
title: Escape immediately dismisses the control header
status: review
type: bug
priority: normal
assigned_to: 
created_at: 2026-10-23T18:14:42Z
updated_at: 2026-10-23T18:14:42Z
tags: [header, keyboard, ui]
last_stdout: ""
---

## Description

Make Escape dismiss the visible control header immediately with a fast slide-up animation.

Acceptance criteria:

- Escape closes the header whenever it is visible.
- It works even when an input, select, or overlay owns focus.
- Existing Escape behavior for modals, the command palette, and lock mode continues to work.
- The slide-up dismissal completes in approximately 100ms.
- Include regression coverage for Escape and non-Escape keys.

Implemented and verified with the complete JavaScript and Python test suites.

