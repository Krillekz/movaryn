/**
 * The version is injected by Vite at build time, so the About tab and the
 * What's New dialog show the real build version even when the local API is
 * unreachable. Importing package.json into the browser bundle would leak the
 * whole manifest, so this stays a single define.
 */
declare const __APP_VERSION__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__ ? __APP_VERSION__ : '0.0.0';

/** Remembers which release the user has already seen notes for. */
export const WHATS_NEW_KEY = 'movaryn:whats-new-seen';
