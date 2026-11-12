import { LATEST_RELEASE_URL } from './links';

const RELEASES_API = 'https://api.github.com/repos/Krillekz/movaryn/releases/latest';

export interface LatestRelease {
  version: string;
  url: string;
  name: string;
  publishedAt: string;
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

  return {
    version,
    url: typeof record.html_url === 'string' ? record.html_url : LATEST_RELEASE_URL,
    name: typeof record.name === 'string' ? record.name : `Movaryn ${version}`,
    publishedAt: typeof record.published_at === 'string' ? record.published_at : '',
  };
}
