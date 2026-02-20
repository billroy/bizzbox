Make an application that reproduces the incidental computer display screens seen in movies and tv.  Not functional, just a pretty visual busybox.  

The idea is to have several different types of windows performing different important-looking activities like:
-Network topology diagram (animated nodes/edges)
-Simulated terminal command + output stream
-Simulated code scrolling
-Fake 3D radar/scope sweep
-Log file tail with severity color coding
-Binary/hex dump stream
-Fake facial recognition / object detection overlay
-Countdown timer to unnamed event
-"Signal" waveform oscilloscope
-Geographic map with moving markers
-System resource gauges (CPU, RAM dials)
-Toast-like notification stack

There should be 5-10 randomly chosen activities live at any moment.

Each type should have at least five generative content strategies leading to different content in the same activity format.

Activities should spawn randomly, stay on the screen for a random time with a mean of 30 seconds and SD of 15 seconds, and then despawn and vanish.

When an activity despawns another activity is spawned immediately to replace it.

The layout generator should randomly select 2-6 activities to be tiled as a background, with other activities popping up in front in random positions, potentially overlapping.  The background grid layout should be computed from the number of activities.  The background grid layout is fixed for the duration of a session.  When a background activity is removed, its slot remains empty until the replacement control is spawned into that slot.  No re-layout on despawn/respawn.  Spawn rate is implicit based on these rules.

Foreground windows should be between 1/4 and 1/3 the size of the main window in each dimension, constrained to be fully within the viewport.

Activities fade in and out on transition.

Activities appear in windows with a title bar but no controls.

Looking for a variable amount of activity from serene (1-2 updates/second) to frenetic (>10 updates/second).  The default initial intensity should be a server command line selection.  Make it an integer representing the mean number of updates per second.  Use a normal distribution with SD mean/4.  Intensity affects only update rate, not spawn rate.

Support multiple clients connected via socket.io.  The server can run in one of two modes: synced or unsynced, with the initial setting a command line flag that defaults to "unsynced".  In synced mode the activities and data are simulcast to all clients and every client shows the same thing plus or minus window size effects.  In unsynced mode every client gets a different show.  A client joining synced mode late catches up at init to show the same data as other clients; no history is necessary.

Add a way to select a "styling mode" and include styling for these cases: light, dark, brutalist, rainbow, sunshine. Controls color palette and typography.  Styling mode should be selectable in a dropdown in the page header.  A change in styling mode is broadcast to all clients.

The page header should auto-hide.  Include connection status, title ("BizzBox"), and intensity control.  Updating the intensity control should change the intensity setting in all connected clients.

Assume a full-screen single display in landscape mode.  Should scale from ipad mini 7 / landscape up to normal desktop screen sizes.  Offer a full-screen control in the header that shifts the local client to fullscreen.

Visual styling is important as this is an appearance-only app so take care to make the display distinctive and sharp.  Looking for a futuristic sci-fi vibe.

Use synthesized audio to generate two types of audio events: (1) notification sound for the coming or going of an activity window, and (2) Activities should randomly (1x/minute) emit notification sounds synchronized with content changes for an activity.  Add a mute control to the header.

Server state is ephemeral per server run.  No persistence is needed.

No admin controls for starters.  Put all the flags and toggles on command line switches.

Create the app as a python Flask application server. Ensure it is Heroku compatible.
Do not use React on the client; use Vue 3.x.  Never use GraphQL.  
Never use anything with a build step.  CDN-delivered Vue is the intended approach.
Never use polled HTTP api.  
Prefer a two-way command pattern with SocketIO as the transport substrate and JSON as the wire format.  

Consider these as candidates for the SocketIO event taxonomy.  Add additional events as needed.
- sync:init
- client:connect
- client:disconnect
- activity:spawn
- activity:update
- activity:despawn
- configure:style
- configure:intensity
- configure:mute
- configure:sync
