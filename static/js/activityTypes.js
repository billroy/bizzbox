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
];
