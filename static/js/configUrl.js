/**
 * Config URL builder — serializes current app state into a shareable URL.
 * Used by the LINK button, context menu, and embed code generator.
 */
import { store } from './store.js';
import { ACTIVITY_TYPES } from './activityTypes.js';
import { encodeSceneToBase64 } from './scenes.js';

/**
 * Build a full shareable URL from the current app state.
 * Uses individual query params when possible for readability;
 * falls back to scene_data encoding when filter or ambient is active.
 */
export function buildConfigUrl() {
  const origin = window.location.origin;
  const path = window.location.pathname;

  const allFilterEnabled = ACTIVITY_TYPES.every(t => store.activityFilter[t]);
  const hasAmbient = !!store.ambientPreset;

  // If filter or ambient is active, encode as scene_data (compact)
  if (!allFilterEnabled || hasAmbient) {
    const scene = {
      name: 'Shared',
      style: store.config.style,
      cols: store.grid.cols,
      rows: store.grid.rows,
      intensity: store.config.intensity,
      fgTarget: store.config.fgTarget,
      ambientPreset: store.ambientPreset || null,
      filter: allFilterEnabled ? null : ACTIVITY_TYPES.filter(t => store.activityFilter[t]),
    };
    const url = new URL(`${origin}${path}`);
    url.searchParams.set('scene_data', encodeSceneToBase64(scene));
    if (store.config.muted) url.searchParams.set('muted', '1');
    if (store.config.volume !== 100) url.searchParams.set('vol', store.config.volume);
    return url.toString();
  }

  // Simple params for basic configs
  const params = new URLSearchParams();
  params.set('style', store.config.style);
  params.set('layout', `${store.grid.cols}x${store.grid.rows}`);
  params.set('intensity', store.config.intensity);
  params.set('windows', store.config.fgTarget);
  if (store.config.muted) params.set('muted', '1');
  if (store.config.volume !== 100) params.set('vol', store.config.volume);

  return `${origin}${path}?${params}`;
}

/**
 * Copy the config URL to the clipboard.
 * Returns a promise that resolves with the URL string.
 */
export function copyConfigUrl() {
  const url = buildConfigUrl();
  return navigator.clipboard.writeText(url).then(() => url).catch(() => {
    // Fallback for insecure contexts
    window.prompt('Copy this URL:', url);
    return url;
  });
}
