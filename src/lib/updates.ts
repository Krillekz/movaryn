import { LATEST_RELEASE_URL, SITE_URL } from './links';

const RELEASES_API = 'https://api.github.com/repos/Krillekz/movaryn/releases/latest';
const CHANGELOG_JSON = `${SITE_URL}changelog.json`;
const MAX_NOTES = 320;

export interface LatestRelease {
  version: string;
  url: string;
  name: string;
  publishedAt: string;
  notes: string;
}

function excerpt(value: string): string {
  const clean = value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= MAX_NOTES) return clean;
  const cut = clean.slice(0, MAX_NOTES);
  return `${cut.slice(0, cut.lastIndexOf(' ')).trimEnd()}…`;
}

async function changelogNotes(version: string): Promise<string> {
  try {
    const response = await fetch(CHANGELOG_JSON, { cache: 'no-store' });
    if (!response.ok) return '';
    const entries = (await response.json()) as unknown;
    if (!Array.isArray(entries)) return '';
    const entry = entries.find(
      (item): item is { version?: unknown; title?: unknown; summary?: unknown } =>
        Boolean(item) && typeof item === 'object' && (item as { version?: unknown }).version === version,
    );
    if (!entry) return '';
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    const summary = typeof entry.summary === 'string' ? entry.summary.trim() : '';
    return [title, summary].filter(Boolean).join('. ');
  } catch {
    return '';
  }
}

/** Fetch the newest published GitHub release for the manual update check. */
export async function fetchLatestRelease(): Promise<LatestRelease> {
  let response: Response;
  try {
    response = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });
  } catch {
    throw new Error('GitHub could not be reached. Check your connection and try again.');
  }

  if (!response.ok) {
    throw new Error(
      response.status === 403
        ? 'GitHub rate-limited the update check. Try again later or open the latest release directly.'
        : `GitHub returned ${response.status} while checking for updates.`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('GitHub returned an unreadable update response.');
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('GitHub returned an unreadable update response.');
  }

  const record = payload as Record<string, unknown>;
  const tag = typeof record.tag_name === 'string' ? record.tag_name.trim() : '';
  const version = tag.replace(/^v/i, '');
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    throw new Error('The latest GitHub release does not have a readable version.');
  }

  const body = typeof record.body === 'string' ? record.body.trim() : '';
  const notes = excerpt(body || (await changelogNotes(version)));

  return {
    version,
    url: typeof record.html_url === 'string' ? record.html_url : LATEST_RELEASE_URL,
    name: typeof record.name === 'string' ? record.name : `Movaryn ${version}`,
    publishedAt: typeof record.published_at === 'string' ? record.published_at : '',
    notes,
  };
}
