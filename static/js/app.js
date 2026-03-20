/**
 * BizzBox — Vue 3 root application.
 * Imports all components and mounts the app.
 */
import { store, urlOverrides, showToast, THEME_LIST } from './store.js';
import { initSocket, sendChannelSwitch, sendStyle } from './socket.js';
import { initKeyboard } from './keyboard.js';

import AppHeader       from './components/AppHeader.js';
import BackgroundGrid  from './components/BackgroundGrid.js';
import ForegroundLayer from './components/ForegroundLayer.js';
import ActivityWindow  from './components/ActivityWindow.js';
import HelpOverlay     from './components/HelpOverlay.js';
import FilterModal     from './components/FilterModal.js';
import EmbedModal      from './components/EmbedModal.js';
import Toast           from './components/Toast.js';

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
import ActivityBlockchain         from './components/activities/Blockchain.js';
import ActivityFlightTracker     from './components/activities/FlightTracker.js';
import ActivityServerRack        from './components/activities/ServerRack.js';
import ActivityCctvMosaic        from './components/activities/CctvMosaic.js';
import ActivityProcessMonitor    from './components/activities/ProcessMonitor.js';
import ActivitySonar             from './components/activities/Sonar.js';
import ActivityWarpDrive         from './components/activities/WarpDrive.js';
import ActivityMechBay           from './components/activities/MechBay.js';
import ActivityTerraforming      from './components/activities/Terraforming.js';
import ActivityDungeonMaster     from './components/activities/DungeonMaster.js';
import ActivitySpaceElevator     from './components/activities/SpaceElevator.js';
import ActivitySubmarineHelm     from './components/activities/SubmarineHelm.js';
import ActivityWildfireCommand   from './components/activities/WildfireCommand.js';
import ActivityHyperloop         from './components/activities/Hyperloop.js';
import ActivityGeneticsLab       from './components/activities/GeneticsLab.js';
import ActivityMissionControl    from './components/activities/MissionControl.js';
import ActivityPong              from './components/activities/Pong.js';
import ActivityTicTacToe         from './components/activities/TicTacToe.js';
import ActivityAiAgent           from './components/activities/AiAgent.js';
import ActivityText              from './components/activities/Text.js';
import ActivityAquarium          from './components/activities/Aquarium.js';
import ActivityAntFarm           from './components/activities/AntFarm.js';

const { createApp } = Vue;

const RootComponent = {
  name: 'BizzBox',
  components: {
    AppHeader,
    BackgroundGrid,
    ForegroundLayer,
    HelpOverlay,
    FilterModal,
    EmbedModal,
    Toast,
  },
  setup() {
    // Apply lock mode from URL override
    if (urlOverrides.lock) {
      store.lockMode = true;
    }
    // Kiosk mode: hide all chrome, implies lock mode
    if (urlOverrides.kiosk) {
      store.kioskMode = true;
      store.lockMode = true;
      document.body.classList.add('kiosk-mode', 'lock-mode');
      // Auto-fullscreen on first user interaction (browsers require gesture)
      const enterFs = () => {
        document.documentElement.requestFullscreen?.().catch(() => {});
        document.removeEventListener('click', enterFs);
        document.removeEventListener('keydown', enterFs);
      };
      document.addEventListener('click', enterFs, { once: true });
      document.addEventListener('keydown', enterFs, { once: true });
    }

    // OBS mode: transparent background for use as OBS browser source
    if (urlOverrides.obs) {
      document.documentElement.classList.add('obs-mode');
      store.lockMode = true;
    }

    // Viewer mode: simplified mobile experience — hides chrome, allows gestures + tap info
    if (urlOverrides.viewer) {
      store.viewerMode = true;
      store.lockMode = true;
      document.body.classList.add('viewer-mode', 'lock-mode');
      // Auto-fullscreen on first interaction
      const enterFs = () => {
        document.documentElement.requestFullscreen?.().catch(() => {});
        document.removeEventListener('click', enterFs);
        document.removeEventListener('touchstart', enterFs);
      };
      document.addEventListener('click', enterFs, { once: true });
      document.addEventListener('touchstart', enterFs, { once: true });
    }

    // ── Swipe gestures for channel switching ────────────────────
    let touchStartX = 0;
    let touchStartY = 0;
    document.addEventListener('touchstart', (evt) => {
      touchStartX = evt.touches[0].clientX;
      touchStartY = evt.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (evt) => {
      const dx = evt.changedTouches[0].clientX - touchStartX;
      const dy = evt.changedTouches[0].clientY - touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Horizontal swipe (> 80px, dominant): cycle channels
      if (absDx >= 80 && absDx >= absDy * 1.5) {
        const channels = store.channels;
        if (channels.length < 2) return;
        const curIdx = channels.findIndex(c => c.id === store.currentChannel);
        if (curIdx < 0) return;

        let nextIdx;
        if (dx < 0) {
          nextIdx = (curIdx + 1) % channels.length;
        } else {
          nextIdx = (curIdx - 1 + channels.length) % channels.length;
        }
        sendChannelSwitch(channels[nextIdx].id);
        showToast(channels[nextIdx].name.toUpperCase());
        return;
      }

      // Vertical swipe (> 80px, dominant): cycle themes
      if (absDy >= 80 && absDy >= absDx * 1.5) {
        const idx = THEME_LIST.indexOf(store.config.style);
        let next;
        if (dy < 0) {
          // Swipe up = next theme
          next = THEME_LIST[(idx + 1) % THEME_LIST.length];
        } else {
          // Swipe down = prev theme
          next = THEME_LIST[(idx - 1 + THEME_LIST.length) % THEME_LIST.length];
        }
        sendStyle(next);
        showToast('THEME: ' + next.toUpperCase());
      }
    }, { passive: true });

    // Viewer mode: tap to toggle info bar
    const { ref } = Vue;
    const viewerInfoVisible = ref(false);
    let viewerInfoTimer = null;
    if (store.viewerMode) {
      document.addEventListener('click', (evt) => {
        // Ignore if it was a swipe or drag
        if (evt.detail === 0) return;
        viewerInfoVisible.value = !viewerInfoVisible.value;
        clearTimeout(viewerInfoTimer);
        if (viewerInfoVisible.value) {
          viewerInfoTimer = setTimeout(() => { viewerInfoVisible.value = false; }, 4000);
        }
      });
    }

    return { store, viewerInfoVisible };
  },
  template: `
    <AppHeader />
    <BackgroundGrid v-if="store.grid" />
    <ForegroundLayer v-if="store.grid" />
    <HelpOverlay v-if="store.helpOverlay" />
    <FilterModal v-if="store.filterModalOpen" />
    <EmbedModal v-if="store.embedModalOpen" />
    <Toast />
    <div v-if="store.lockMode" class="lock-overlay"></div>
    <div v-if="store.viewerMode && viewerInfoVisible" class="viewer-info-bar">
      <span>{{ store.config.style.toUpperCase() }}</span>
      <span class="viewer-sep">|</span>
      <span>CH {{ store.currentChannel }}</span>
      <span class="viewer-sep">|</span>
      <span>{{ store.channelViewers }} watching</span>
    </div>
    <div v-if="store.reconnecting && !store.kioskMode && !store.viewerMode" class="boot-screen reconnect-screen">
      <div class="boot-msg reconnect-pulse">RECONNECTING...</div>
      <div class="reconnect-attempt">ATTEMPT {{ store.reconnectAttempts }}</div>
    </div>
    <div v-else-if="!store.connected" class="boot-screen">
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
app.component('activity-blockchain',              ActivityBlockchain);
app.component('activity-flight-tracker',         ActivityFlightTracker);
app.component('activity-server-rack',            ActivityServerRack);
app.component('activity-cctv-mosaic',            ActivityCctvMosaic);
app.component('activity-process-monitor',        ActivityProcessMonitor);
app.component('activity-sonar',                  ActivitySonar);
app.component('activity-warp-drive',             ActivityWarpDrive);
app.component('activity-mech-bay',               ActivityMechBay);
app.component('activity-terraforming',           ActivityTerraforming);
app.component('activity-dungeon-master',         ActivityDungeonMaster);
app.component('activity-space-elevator',         ActivitySpaceElevator);
app.component('activity-submarine-helm',         ActivitySubmarineHelm);
app.component('activity-wildfire-command',        ActivityWildfireCommand);
app.component('activity-hyperloop',              ActivityHyperloop);
app.component('activity-genetics-lab',           ActivityGeneticsLab);
app.component('activity-mission-control',        ActivityMissionControl);
app.component('activity-pong',                   ActivityPong);
app.component('activity-tic-tac-toe',            ActivityTicTacToe);
app.component('activity-ai-agent',              ActivityAiAgent);
app.component('activity-text',                  ActivityText);
app.component('activity-aquarium',              ActivityAquarium);
app.component('activity-ant-farm',              ActivityAntFarm);

app.mount('#app');

// Initialize socket and keyboard after mount
initSocket();
initKeyboard();
