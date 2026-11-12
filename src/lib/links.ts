/** Public site pages, used by the in-app update notes and About tab. */
export const SITE_URL = 'https://krillekz.github.io/movaryn/';
export const CHANGELOG_URL = `${SITE_URL}changelog.html`;
export const ROADMAP_URL = `${SITE_URL}roadmap.html`;
export const LATEST_RELEASE_URL = 'https://github.com/Krillekz/movaryn/releases/latest';

/**
 * Opens a public page in a new tab. Kept as a helper so the command palette
 * and dialogs all use the same rel/target pair instead of window.open().
 */
export function openExternal(url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noreferrer noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
