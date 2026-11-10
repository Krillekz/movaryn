const STORAGE_KEY = 'movaryn.apiBase';

/** Only accept an absolute http(s) URL; drop trailing slashes. */
function normalise(candidate: string | null | undefined): string {
  const value = (candidate ?? '').trim().replace(/\/+$/, '');
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return value;
  } catch {
    return '';
  }
}

function fromQuery(): string {
  try {
    const url = new URL(window.location.href);
    const candidate = normalise(url.searchParams.get('api'));
    if (!candidate) return '';
    try {
      window.localStorage.setItem(STORAGE_KEY, candidate);
    } catch {
      // Storage can be blocked; the query value still applies for this load.
    }
    url.searchParams.delete('api');
    window.history.replaceState(null, '', url);
    return candidate;
  } catch {
    return '';
  }
}

function fromStorage(): string {
  try {
    return normalise(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return '';
  }
}

/**
 * Absolute API URL, or '' to use same-origin /api (the desktop app and the
 * Node-served build). The page never holds provider keys — only this server URL.
 */
export const apiBase = fromQuery() || fromStorage() || normalise(import.meta.env.VITE_API_BASE_URL);

/** True for the static/browser build, where no API is served from the same origin. */
export const isBrowserBuild = typeof window !== 'undefined' && !window.movarynDesktop;

export function setApiBase(value: string): string {
  const clean = normalise(value);
  try {
    if (clean) window.localStorage.setItem(STORAGE_KEY, clean);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do; the setup bar will appear again after a reload.
  }
  return clean;
}
