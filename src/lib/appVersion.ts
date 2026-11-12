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

/** Compare numeric major.minor.patch versions. Returns null when either is unreadable. */
export function compareVersions(left: string, right: string): number | null {
  const parse = (value: string): number[] | null => {
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(value);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
  };
  const a = parse(left);
  const b = parse(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

export function isNewerVersion(candidate: string, current: string): boolean {
  return (compareVersions(candidate, current) ?? 0) > 0;
}
