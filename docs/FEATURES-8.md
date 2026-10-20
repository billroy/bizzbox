
Add a "Channels" feature: 
- A channel is a complete screen configuration, including all the visual and audio parameters controlled in the header of the web page, and the position of all the current activities
- Channels are known by numbers.  The first channel is Channel 1.
- Select channel: Add a Channel selector dropdown in row 1 of the header, near the left.  The selector should show all the channels and the number of viewers currently connected to that channel like: "Channel 1 (10)" 
- Add channel: Add + button next to the channel selector dropdown to create a new channel.  When a new channel is created it is populated with random content just as the current server does at startup.  The user's screen changes to show the newly created channel.  The user's client moves to a per-channel socketio room.   Any user can create a channel.  The newly created channel is named using always-increment.
- Display viewers: Add a control next to the socketio status controls showing number of viewers in the current channel and number of total viewers on the server like: "3/5 Watching".  Live update this number as viewers come and go.
- Channel state is ephemeral, vanishes at server restart.
- Empty channels persist until server restart
- Add a keyboard shortcut for channel switching.  Use alt+1 through alt+9 for channels 1 through 9, use alt+0 for channel 10, and use [/] for prev/next channel.
- Cap the number of channels at 10.  Make it a server startup command parameter.  When the number of channels is at maximum, disable the + button.
- At startup there is one channel named "Channel 1"
- Changes to a channel are broadcast to all connected clients but not to clients in other channels


