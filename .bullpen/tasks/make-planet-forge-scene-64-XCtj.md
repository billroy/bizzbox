---
# make-planet-forge-scene-64-XCtj
title: Make Planet Forge scene 6×4
status: review
type: task
priority: normal
assigned_to: 
created_at: 2026-10-26T18:26:55Z
updated_at: 2026-10-26T18:26:55Z
tags: []
last_stdout: ""
---

## Description

## Summary

Resize the built-in Planet Forge scene from 4×3 to 6×4.

## Changes

- Set the Planet Forge preset to 6 columns and 4 rows.
- Update the built-in scenes table in the user guide.
- Add a regression test that locks the preset dimensions to 6×4.

## Verification

- `node --experimental-vm-modules --test tests/test_scenes.mjs` — 3 passed.
- `pytest -q tests/test_scene_switch.py tests/test_presentation.py tests/test_pong_world_delivery.py` — 8 passed.

