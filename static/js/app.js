/**
 * BizzBox — Vue 3 root application.
 * Imports all components and mounts the app.
 */
import { store, urlOverrides } from './store.js';
import { initSocket } from './socket.js';
import { initKeyboard } from './keyboard.js';

import AppHeader       from './components/AppHeader.js';
import BackgroundGrid  from './components/BackgroundGrid.js';
import ForegroundLayer from './components/ForegroundLayer.js';
import ActivityWindow  from './components/ActivityWindow.js';
import HelpOverlay     from './components/HelpOverlay.js';
import FilterModal     from './components/FilterModal.js';

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
import ActivityMatrixRain       from './components/activities/MatrixRain.js';
import ActivityAudioSpectrum    from './components/activities/AudioSpectrum.js';
import ActivityProgressBars     from './components/activities/ProgressBars.js';
import ActivityDnaSequence      from './components/activities/DnaSequence.js';
import ActivityGraph            from './components/activities/Graph.js';
import ActivityOrbitalView     from './components/activities/OrbitalView.js';
import ActivityCameraFeed      from './components/activities/CameraFeed.js';
import ActivityCipherDecrypt   from './components/activities/CipherDecrypt.js';
import ActivityDataTable       from './components/activities/DataTable.js';
import ActivitySystemTopology  from './components/activities/SystemTopology.js';
import ActivityGlobeArcs       from './components/activities/GlobeArcs.js';
import ActivityHeartMonitor    from './components/activities/HeartMonitor.js';
import ActivityTransitMap      from './components/activities/TransitMap.js';
import ActivityWeatherRadar    from './components/activities/WeatherRadar.js';
import ActivityStockList       from './components/activities/StockList.js';
import ActivityStockGraph      from './components/activities/StockGraph.js';
import ActivityChatIntercept  from './components/activities/ChatIntercept.js';
import ActivityWireframe3d    from './components/activities/Wireframe3d.js';
import ActivityPowerGrid      from './components/activities/PowerGrid.js';
import ActivityGameOfLife          from './components/activities/GameOfLife.js';
import ActivitySatelliteTelemetry from './components/activities/SatelliteTelemetry.js';
import ActivityPacketSniffer      from './components/activities/PacketSniffer.js';
import ActivitySeismograph        from './components/activities/Seismograph.js';
import ActivityAccessControl      from './components/activities/AccessControl.js';

const { createApp } = Vue;

const RootComponent = {
  name: 'BizzBox',
  components: {
    AppHeader,
    BackgroundGrid,
    ForegroundLayer,
    HelpOverlay,
    FilterModal,
  },
  setup() {
    // Apply lock mode from URL override
    if (urlOverrides.lock) {
      store.lockMode = true;
    }
    return { store };
  },
  template: `
    <AppHeader />
    <BackgroundGrid v-if="store.grid" />
    <ForegroundLayer v-if="store.grid" />
    <HelpOverlay v-if="store.helpOverlay" />
    <FilterModal v-if="store.filterModalOpen" />
    <div v-if="store.lockMode" class="lock-overlay"></div>
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
app.component('activity-matrix-rain',        ActivityMatrixRain);
app.component('activity-audio-spectrum',     ActivityAudioSpectrum);
app.component('activity-progress-bars',      ActivityProgressBars);
app.component('activity-dna-sequence',       ActivityDnaSequence);
app.component('activity-graph',              ActivityGraph);
app.component('activity-orbital-view',       ActivityOrbitalView);
app.component('activity-camera-feed',        ActivityCameraFeed);
app.component('activity-cipher-decrypt',     ActivityCipherDecrypt);
app.component('activity-data-table',        ActivityDataTable);
app.component('activity-system-topology',   ActivitySystemTopology);
app.component('activity-globe-arcs',        ActivityGlobeArcs);
app.component('activity-heart-monitor',    ActivityHeartMonitor);
app.component('activity-transit-map',      ActivityTransitMap);
app.component('activity-weather-radar',    ActivityWeatherRadar);
app.component('activity-stock-list',       ActivityStockList);
app.component('activity-stock-graph',      ActivityStockGraph);
app.component('activity-chat-intercept',  ActivityChatIntercept);
app.component('activity-wireframe-3d',    ActivityWireframe3d);
app.component('activity-power-grid',      ActivityPowerGrid);
app.component('activity-game-of-life',          ActivityGameOfLife);
app.component('activity-satellite-telemetry',  ActivitySatelliteTelemetry);
app.component('activity-packet-sniffer',       ActivityPacketSniffer);
app.component('activity-seismograph',          ActivitySeismograph);
app.component('activity-access-control',       ActivityAccessControl);

app.mount('#app');

// Initialize socket and keyboard after mount
initSocket();
initKeyboard();
