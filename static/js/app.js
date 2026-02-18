/**
 * BizzBox — Vue 3 root application.
 * Imports all components and mounts the app.
 */
import { store } from './store.js';
import { initSocket } from './socket.js';

import AppHeader       from './components/AppHeader.js';
import BackgroundGrid  from './components/BackgroundGrid.js';
import ForegroundLayer from './components/ForegroundLayer.js';
import ActivityWindow  from './components/ActivityWindow.js';

// Activity renderers
import ActivityNetworkTopology  from './components/activities/NetworkTopology.js';
import ActivityTerminal         from './components/activities/Terminal.js';
import ActivityCodeScroll       from './components/activities/CodeScroll.js';
import ActivityRadar            from './components/activities/Radar.js';
import ActivityLogTail          from './components/activities/LogTail.js';
import ActivityHexDump          from './components/activities/HexDump.js';
import ActivityFacialRecognition from './components/activities/FacialRecognition.js';
import ActivityCountdown        from './components/activities/Countdown.js';
import ActivityOscilloscope     from './components/activities/Oscilloscope.js';
import ActivityGeoMap           from './components/activities/GeoMap.js';
import ActivityResourceGauges   from './components/activities/ResourceGauges.js';
import ActivityNotifications    from './components/activities/Notifications.js';
import ActivitySdrWaterfall     from './components/activities/SdrWaterfall.js';
import ActivityQamConstellation from './components/activities/QamConstellation.js';

const { createApp } = Vue;

const RootComponent = {
  name: 'BizzBox',
  components: {
    AppHeader,
    BackgroundGrid,
    ForegroundLayer,
  },
  setup() {
    return { store };
  },
  template: `
    <AppHeader />
    <BackgroundGrid v-if="store.grid" />
    <ForegroundLayer v-if="store.grid" />
    <div v-if="!store.connected" class="boot-screen">
      <div class="boot-msg">BIZZBOX INITIALIZING...</div>
    </div>
  `,
};

const app = createApp(RootComponent);

// Register all activity components globally
app.component('activity-network-topology',   ActivityNetworkTopology);
app.component('activity-terminal',           ActivityTerminal);
app.component('activity-code-scroll',        ActivityCodeScroll);
app.component('activity-radar',              ActivityRadar);
app.component('activity-log-tail',           ActivityLogTail);
app.component('activity-hex-dump',           ActivityHexDump);
app.component('activity-facial-recognition', ActivityFacialRecognition);
app.component('activity-countdown',          ActivityCountdown);
app.component('activity-oscilloscope',       ActivityOscilloscope);
app.component('activity-geo-map',            ActivityGeoMap);
app.component('activity-resource-gauges',    ActivityResourceGauges);
app.component('activity-notifications',      ActivityNotifications);
app.component('activity-sdr-waterfall',      ActivitySdrWaterfall);
app.component('activity-qam-constellation',  ActivityQamConstellation);

app.mount('#app');

// Initialize socket after mount
initSocket();
