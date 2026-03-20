/**
 * Preset scene definitions + custom scene persistence.
 */
import { ACTIVITY_TYPES } from './activityTypes.js';

// Dynamic Feature Zoo: one of each activity type in selector order
const zooCols = 10;
const zooRows = Math.ceil(ACTIVITY_TYPES.length / zooCols);  // 6 rows for 57 types (60 slots, 3 empty)

export const SCENES = [
  { name: 'War Room',        style: 'red',       cols: 6, rows: 4, intensity: 15, fgTarget: 5,  ambientPreset: 'war_room',         filter: null },
  { name: 'Ambient',         style: 'dark',      cols: 3, rows: 2, intensity: 2,  fgTarget: 0,  ambientPreset: 'deep_space',       filter: null },
  { name: 'Hacker Den',      style: 'neon',      cols: 4, rows: 3, intensity: 10, fgTarget: 3,  ambientPreset: 'server_room',      filter: null },
  { name: 'Mission Control', style: 'black',     cols: 6, rows: 4, intensity: 8,  fgTarget: 0,  ambientPreset: 'bunker_countdown', filter: null },
  { name: 'Surveillance',    style: 'brutalist',  cols: 5, rows: 4, intensity: 6,  fgTarget: 2,  ambientPreset: 'power_plant',      filter: null },
  { name: 'Chaos',           style: 'rainbow',   cols: 6, rows: 8, intensity: 20, fgTarget: 10, ambientPreset: null,               filter: null },
  { name: 'Starship Bridge', style: 'lcars',     cols: 5, rows: 3, intensity: 8,  fgTarget: 4,  ambientPreset: 'warp_engine',      filter: ['warp_drive', 'radar', 'orbital_view', 'satellite_telemetry', 'space_elevator', 'globe_arcs', 'network_topology'] },
  { name: 'Mech Hangar',     style: 'military',  cols: 4, rows: 3, intensity: 12, fgTarget: 3,  ambientPreset: 'mech_hangar',      filter: ['mech_bay', 'power_grid', 'server_rack', 'resource_gauges', 'process_monitor', 'oscilloscope'] },
  { name: 'Planet Forge',    style: 'amber',     cols: 3, rows: 2, intensity: 3,  fgTarget: 0,  ambientPreset: 'terraforming_drone', filter: ['terraforming', 'weather_radar', 'seismograph', 'geo_map', 'oscilloscope', 'graph'] },
  { name: 'Dungeon Crawl',   style: 'neon',      cols: 4, rows: 3, intensity: 14, fgTarget: 5,  ambientPreset: 'tavern_fire',      filter: ['dungeon_master', 'countdown', 'heart_monitor', 'progress_bars', 'notifications', 'data_table'] },
  { name: 'Launch Day',      style: 'black',     cols: 6, rows: 4, intensity: 10, fgTarget: 2,  ambientPreset: 'rocket_launch',    filter: ['mission_control', 'countdown', 'graph', 'oscilloscope', 'satellite_telemetry', 'resource_gauges'] },
  { name: 'Abyss',           style: 'arctic',    cols: 4, rows: 3, intensity: 6,  fgTarget: 2,  ambientPreset: 'submarine_sonar',  filter: ['submarine_helm', 'sonar', 'heart_monitor', 'oscilloscope', 'seismograph', 'resource_gauges'] },
  { name: 'Firebreak',       style: 'red',       cols: 5, rows: 4, intensity: 16, fgTarget: 6,  ambientPreset: 'wildfire_crackle', filter: ['wildfire_command', 'weather_radar', 'geo_map', 'flight_tracker', 'notifications', 'resource_gauges'] },
  { name: 'Transit Hub',     style: 'synthwave', cols: 5, rows: 3, intensity: 9,  fgTarget: 3,  ambientPreset: 'hyperloop_tube',   filter: ['hyperloop', 'transit_map', 'flight_tracker', 'countdown', 'data_table', 'graph'] },
  { name: 'Bio Lab',         style: 'light',     cols: 3, rows: 2, intensity: 5,  fgTarget: 1,  ambientPreset: 'genetics_hum',     filter: ['genetics_lab', 'dna_sequence', 'heart_monitor', 'graph', 'progress_bars', 'oscilloscope'] },
  { name: 'Cyber Siege',     style: 'brutalist',  cols: 6, rows: 4, intensity: 18, fgTarget: 8,  ambientPreset: 'digital_warfare',  filter: ['network_topology', 'packet_sniffer', 'cipher_decrypt', 'access_control', 'blockchain', 'code_scroll', 'terminal', 'ai_agent'] },
  { name: 'Coral Reef',      style: 'ocean',      cols: 4, rows: 3, intensity: 4,  fgTarget: 1,  ambientPreset: 'coral_reef',       filter: ['sonar', 'submarine_helm', 'weather_radar', 'seismograph', 'oscilloscope', 'heart_monitor'] },
  { name: 'Ironworks',       style: 'copper',     cols: 5, rows: 4, intensity: 14, fgTarget: 4,  ambientPreset: 'steel_mill',       filter: ['power_grid', 'server_rack', 'resource_gauges', 'process_monitor', 'progress_bars', 'graph', 'oscilloscope'] },
  { name: 'Neon Dreams',     style: 'vapor',      cols: 4, rows: 3, intensity: 7,  fgTarget: 2,  ambientPreset: 'radio_static',     filter: ['audio_spectrum', 'sdr_waterfall', 'qam_constellation', 'matrix_rain', 'wireframe_3d', 'game_of_life'] },
  { name: 'Thermal Scan',    style: 'infrared',   cols: 5, rows: 3, intensity: 11, fgTarget: 3,  ambientPreset: 'circuit_board',    filter: ['cctv_mosaic', 'facial_recognition', 'camera_feed', 'access_control', 'radar', 'geo_map'] },
  { name: 'Deep Green',      style: 'phosphor',   cols: 3, rows: 3, intensity: 6,  fgTarget: 0,  ambientPreset: 'server_room',      filter: ['terminal', 'code_scroll', 'hex_dump', 'log_tail', 'cipher_decrypt', 'packet_sniffer', 'ai_agent'] },
  { name: 'Architect',       style: 'blueprint',  cols: 4, rows: 2, intensity: 5,  fgTarget: 1,  ambientPreset: 'cathedral',        filter: ['system_topology', 'network_topology', 'wireframe_3d', 'data_table', 'graph', 'process_monitor'] },
  { name: 'Golden Hour',     style: 'sunset',     cols: 3, rows: 2, intensity: 3,  fgTarget: 0,  ambientPreset: 'train_station',    filter: ['transit_map', 'flight_tracker', 'stock_graph', 'stock_list', 'weather_radar', 'globe_arcs'] },
  { name: 'Jungle Outpost',  style: 'forest',     cols: 5, rows: 3, intensity: 9,  fgTarget: 3,  ambientPreset: 'jungle_night',     filter: ['weather_radar', 'geo_map', 'satellite_telemetry', 'radar', 'seismograph', 'notifications'] },
  { name: 'Eruption',        style: 'matrix',     cols: 6, rows: 4, intensity: 17, fgTarget: 7,  ambientPreset: 'volcano',          filter: ['seismograph', 'power_grid', 'resource_gauges', 'weather_radar', 'countdown', 'notifications', 'graph', 'oscilloscope'] },
  { name: 'Frozen Vault',    style: 'frost',      cols: 4, rows: 3, intensity: 8,  fgTarget: 2,  ambientPreset: 'ice_cave',         filter: ['blockchain', 'cipher_decrypt', 'access_control', 'data_table', 'server_rack', 'hex_dump'] },
  { name: 'Agent Den',      style: 'agent',      cols: 6, rows: 4, intensity: 10, fgTarget: 0,  ambientPreset: 'agent_den',        filter: ['ai_agent'] },
  { name: 'TTT',            style: 'neon',       cols: 6, rows: 4, intensity: 8,  fgTarget: 0,  ambientPreset: 'server_room',      filter: ['tic_tac_toe'] },
  { name: 'Life World',     style: 'phosphor',   cols: 6, rows: 4, intensity: 6,  fgTarget: 0,  ambientPreset: 'genetics_hum',     filter: ['game_of_life'] },
  { name: 'Feature Zoo',    style: 'dark',       cols: zooCols, rows: zooRows, intensity: 5,  fgTarget: 0,  ambientPreset: null, filter: null, slots: [...ACTIVITY_TYPES] },
];

const CUSTOM_KEY = 'bizzbox_custom_scenes';

export function loadCustomScenes() {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) { return []; }
}

export function saveCustomScene(scene) {
  const scenes = loadCustomScenes();
  // Replace if same name exists
  const idx = scenes.findIndex(s => s.name === scene.name);
  if (idx >= 0) scenes[idx] = scene; else scenes.push(scene);
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(scenes)); } catch (_) { /* */ }
}

export function deleteCustomScene(name) {
  const scenes = loadCustomScenes().filter(s => s.name !== name);
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(scenes)); } catch (_) { /* */ }
}

export function exportScenes() {
  const scenes = loadCustomScenes();
  return JSON.stringify(scenes, null, 2);
}

export function importScenes(json) {
  const incoming = JSON.parse(json);
  if (!Array.isArray(incoming)) throw new Error('Expected an array of scenes');
  const existing = loadCustomScenes();
  for (const scene of incoming) {
    if (!scene.name) continue;
    const idx = existing.findIndex(s => s.name === scene.name);
    if (idx >= 0) existing[idx] = scene; else existing.push(scene);
  }
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(existing)); } catch (_) { /* */ }
  return existing;
}

/**
 * Encode a scene object as a URL-safe base64 string.
 */
export function encodeSceneToBase64(scene) {
  const json = JSON.stringify(scene);
  // Use btoa with UTF-8 encoding
  return btoa(unescape(encodeURIComponent(json)));
}

/**
 * Decode a base64 string back into a scene object.
 * Returns null if invalid.
 */
export function decodeSceneFromBase64(b64) {
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    const scene = JSON.parse(json);
    if (!scene || typeof scene !== 'object') return null;
    // Minimal validation — must have at least style, cols, rows
    if (!scene.style || !scene.cols || !scene.rows) return null;
    return scene;
  } catch (_) {
    return null;
  }
}
