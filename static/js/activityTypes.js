/**
 * Canonical list of all activity type names.
 * Used by ActivityWindow titlebar dropdown for type selection.
 * Must stay in sync with server/activity_registry.py REGISTRY keys.
 */
export const ACTIVITY_TYPES = [
  'network_topology',
  'terminal',
  'code_scroll',
  'radar',
  'log_tail',
  'hex_dump',
  'facial_recognition',
  'countdown',
  'oscilloscope',
  'geo_map',
  'resource_gauges',
  'notifications',
  'sdr_waterfall',
  'qam_constellation',
  'matrix_rain',
  'audio_spectrum',
  'progress_bars',
  'dna_sequence',
  'graph',
  'orbital_view',
  'camera_feed',
  'cipher_decrypt',
  'data_table',
  'system_topology',
  'globe_arcs',
  'heart_monitor',
  'transit_map',
  'weather_radar',
  'stock_list',
  'stock_graph',
  'chat_intercept',
  'wireframe_3d',
  'power_grid',
  'game_of_life',
  'satellite_telemetry',
  'packet_sniffer',
  'seismograph',
  'access_control',
  'blockchain',
  'flight_tracker',
  'server_rack',
  'cctv_mosaic',
  'process_monitor',
  'sonar',
  'warp_drive',
  'mech_bay',
  'terraforming',
  'dungeon_master',
  'space_elevator',
  'submarine_helm',
  'wildfire_command',
  'hyperloop',
  'genetics_lab',
  'mission_control',
  'pong',
  'tic_tac_toe',
  'ai_agent',
  'text',
];

/**
 * Thematic categories for the filter modal.
 * Every type in ACTIVITY_TYPES must appear in exactly one category.
 */
export const ACTIVITY_CATEGORIES = {
  'Ops Center': [
    'radar', 'geo_map', 'globe_arcs', 'countdown', 'satellite_telemetry',
    'flight_tracker', 'wildfire_command', 'mission_control',
  ],
  'Surveillance': [
    'facial_recognition', 'camera_feed', 'cctv_mosaic', 'access_control',
    'packet_sniffer', 'chat_intercept',
  ],
  'Sci-Fi': [
    'orbital_view', 'warp_drive', 'mech_bay', 'terraforming',
    'space_elevator', 'submarine_helm', 'hyperloop',
  ],
  'Fantasy': [
    'dungeon_master',
  ],
  'Infrastructure': [
    'network_topology', 'system_topology', 'server_rack', 'power_grid',
    'process_monitor', 'resource_gauges', 'transit_map',
  ],
  'Data & Comms': [
    'terminal', 'code_scroll', 'log_tail', 'hex_dump', 'data_table',
    'notifications', 'progress_bars', 'matrix_rain', 'wireframe_3d',
    'graph', 'cipher_decrypt', 'ai_agent', 'text',
  ],
  'Science': [
    'oscilloscope', 'seismograph', 'sdr_waterfall', 'qam_constellation',
    'audio_spectrum', 'dna_sequence', 'heart_monitor', 'weather_radar',
    'sonar', 'genetics_lab',
  ],
  'Finance': [
    'stock_graph', 'stock_list', 'blockchain',
  ],
  'Games': [
    'pong', 'tic_tac_toe', 'game_of_life',
  ],
};
