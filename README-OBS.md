# BizzBox OBS Setup Guide

Use BizzBox as a browser source in OBS Studio for stream overlays, backgrounds, or full-screen visuals.

## Quick Start

1. In OBS, add a **Browser Source** (Sources panel > + > Browser)
2. Set the URL to your BizzBox instance (e.g. `http://localhost:5000`)
3. Set width and height to match your canvas (1920x1080 recommended)
4. Check **"Shutdown source when not visible"** to save resources
5. Click OK

BizzBox will run inside OBS as a live, animated overlay.

## Transparent Background Mode

Add `?obs=1` to the URL for transparent backgrounds:

```
http://localhost:5000?obs=1
```

This mode:
- Makes all backgrounds transparent (activities float over your scene)
- Hides the header bar (enters lock mode automatically)
- Removes the scanline overlay effect

**Important:** In OBS Browser Source properties, make sure the background is not set to a solid color. OBS browser sources support transparency by default.

Combine with a scene for a themed overlay:

```
http://localhost:5000?obs=1&scene=Hacker+Den
```

## Recommended URL Configurations

| Use Case | URL |
|----------|-----|
| Full-screen background | `?scene=Ambient&lock=1` |
| Themed overlay (transparent) | `?obs=1&scene=War+Room` |
| Minimal overlay | `?obs=1&layout=1x1&windows=0` |
| Muted (using own audio) | `?obs=1&muted=1` |
| Low volume background audio | `?obs=1&vol=20` |
| Kiosk mode (auto-fullscreen) | `?kiosk=1&scene=War+Room` |
| Calm ambient display | `?scene=Ambient&lock=1&intensity=2` |
| Frenetic war room | `?scene=War+Room&lock=1` |

### Vanity URLs

Built-in scenes have short URLs that work as direct paths:

```
http://localhost:5000/war-room
http://localhost:5000/hacker-den
http://localhost:5000/ambient
http://localhost:5000/starship-bridge
```

Combine with query parameters:

```
http://localhost:5000/war-room?obs=1&vol=30
```

All 28 built-in scenes have vanity URLs. The slug is the scene name in lowercase with spaces replaced by hyphens.

## Audio

OBS browser sources can play audio. BizzBox generates synthesized ambient soundscapes and event sounds via Web Audio API.

- Use the `vol` parameter to set volume: `?vol=30` (0-100, percentage)
- Use `muted=1` to start silent: `?muted=1`
- If you're using your own audio in OBS, mute BizzBox: `?obs=1&muted=1`
- In OBS, you can also control the browser source audio via the Audio Mixer

## Performance Tips

BizzBox is GPU-accelerated but can use significant CPU for complex scenes. To reduce load:

| Setting | Parameter | Effect |
|---------|-----------|--------|
| Lower intensity | `intensity=3` | Fewer animation updates per second |
| Fewer windows | `windows=0` | No floating foreground panels |
| Smaller grid | `layout=3x2` | 6 panels instead of 24+ |
| Shutdown when hidden | OBS checkbox | Frees resources when scene is inactive |

Example low-resource URL:

```
http://localhost:5000?obs=1&scene=Ambient&intensity=2&windows=0
```

## Embed Code Generator

BizzBox includes a built-in embed code generator:

1. Open BizzBox in a regular browser
2. Configure your desired scene, theme, and settings
3. Click the **"..."** button next to Scene, then **"Embed Code"**
4. Adjust options (dimensions, lock mode, muted, transparent)
5. Copy the generated `<iframe>` code or extract the URL for OBS

## Screenshot Export

Use the **SNAP** button in the header to capture a PNG screenshot of the current display (header is automatically hidden during capture). This is useful for creating OBS scene thumbnails.

## Troubleshooting

**Black screen in OBS:**
- Verify the BizzBox server is running
- Check the URL is correct and reachable from OBS
- Try opening the URL in a regular browser first

**White background instead of transparent:**
- Add `?obs=1` to the URL
- Verify OBS browser source is not forcing a background color

**No audio from browser source:**
- OBS browser sources play audio by default
- Check the Audio Mixer in OBS — browser source may be muted there
- Use `?vol=50` or remove `muted=1` from the URL

**Laggy or stuttering:**
- Lower the intensity: `?intensity=3`
- Reduce window count: `?windows=0`
- Use a smaller grid layout: `?layout=3x2`
- Check "Hardware acceleration" in OBS advanced settings

**Reconnecting / Dropped connection:**
- OBS browser sources may lose WebSocket connections after sleep/wake
- Right-click the browser source > "Refresh" to reconnect
- BizzBox auto-reconnects, but a manual refresh is faster
