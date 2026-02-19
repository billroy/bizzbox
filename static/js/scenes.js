/**
 * Preset scene definitions + custom scene persistence.
 */
export const SCENES = [
  { name: 'War Room',        style: 'red',       cols: 6, rows: 4, intensity: 15, fgTarget: 5,  ambientPreset: 'war_room',         filter: null },
  { name: 'Ambient',         style: 'dark',      cols: 3, rows: 2, intensity: 2,  fgTarget: 0,  ambientPreset: 'deep_space',       filter: null },
  { name: 'Hacker Den',      style: 'neon',      cols: 4, rows: 3, intensity: 10, fgTarget: 3,  ambientPreset: 'server_room',      filter: null },
  { name: 'Mission Control', style: 'black',     cols: 6, rows: 4, intensity: 8,  fgTarget: 0,  ambientPreset: 'bunker_countdown', filter: null },
  { name: 'Surveillance',    style: 'brutalist',  cols: 5, rows: 4, intensity: 6,  fgTarget: 2,  ambientPreset: 'power_plant',      filter: null },
  { name: 'Chaos',           style: 'rainbow',   cols: 6, rows: 8, intensity: 20, fgTarget: 10, ambientPreset: null,               filter: null },
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
