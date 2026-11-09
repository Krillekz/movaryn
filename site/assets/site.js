// Small, dependency-free enhancements: latest version, direct asset links,
// and a preview of the newest update-log entries. Everything degrades to
// static links when fetch is unavailable.

const REPO = 'Krillekz/movaryn';

async function loadLatestRelease() {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function applyRelease(release) {
  if (!release) return;
  const version = String(release.tag_name || '').replace(/^v/, '');
  if (!version) return;

  document.querySelectorAll('[data-version-line]').forEach((node) => {
    node.textContent = `Version ${version} · Windows 10/11 · x64`;
  });

  const assets = Array.isArray(release.assets) ? release.assets : [];
  const find = (pattern) => assets.find((asset) => pattern.test(asset.name || ''));

  const setup = find(/Setup.*\.exe$/i);
  const portable = find(/Portable.*\.exe$/i);

  const links = {
    setup: setup?.browser_download_url,
    portable: portable?.browser_download_url,
  };

  document.querySelectorAll('[data-download]').forEach((node) => {
    const target = links[node.dataset.download];
    if (target) node.setAttribute('href', target);
  });

  document.querySelectorAll('[data-file]').forEach((node) => {
    const asset = node.dataset.file === 'portable' ? portable : setup;
    if (asset?.name) node.textContent = asset.name;
  });
}

async function renderLatestUpdates() {
  const container = document.getElementById('latest-updates');
  if (!container) return;
  try {
    const response = await fetch('changelog.json');
    if (!response.ok) return;
    const entries = await response.json();
    if (!Array.isArray(entries) || entries.length === 0) return;

    container.replaceChildren(
      ...entries.slice(0, 3).map((entry) => {
        const item = document.createElement('a');
        item.className = 'update-item';
        item.href = `changelog.html#v${entry.version}`;

        const version = document.createElement('span');
        version.className = 'update-version';
        version.textContent = entry.version;

        const body = document.createElement('div');
        const title = document.createElement('h3');
        title.textContent = entry.title;
        const summary = document.createElement('p');
        summary.textContent = entry.summary || '';
        body.append(title, summary);

        const more = document.createElement('span');
        more.className = 'update-link';
        more.textContent = 'Details →';

        item.append(version, body, more);
        return item;
      }),
    );
  } catch {
    // Keep the static fallback link.
  }
}

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

void loadLatestRelease().then(applyRelease);
void renderLatestUpdates();
