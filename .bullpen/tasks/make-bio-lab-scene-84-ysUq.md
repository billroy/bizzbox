---
# make-bio-lab-scene-84-ysUq
title: Make Bio Lab scene 8×4
status: review
type: task
priority: normal
assigned_to: 
created_at: 2026-10-26T18:25:48Z
updated_at: 2026-10-26T18:25:48Z
tags: []
last_stdout: ""
---

## Description

## Summary

Resize the built-in Bio Lab scene from 4×3 to 8×4.

## Changes

- Set the Bio Lab preset to 8 columns and 4 rows.
- Update the built-in scenes table in the user guide.
- Add a regression test that locks the preset dimensions to 8×4.

## Verification

- `node --experimental-vm-modules --test tests/test_scenes.mjs` — 2 passed.
- `pytest -q tests/test_scene_switch.py tests/test_presentation.py tests/test_pong_world_delivery.py` — 8 passed.

