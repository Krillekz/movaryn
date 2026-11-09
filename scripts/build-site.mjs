#!/usr/bin/env node
// Builds the public site's update log from CHANGELOG.md, so the page and the
// changelog can never disagree. Also copies the favicon and writes a small
// changelog.json used by the landing page's "latest releases" list.

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteDir = path.join(root, 'site');
const repo = 'Krillekz/movaryn';

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function inline(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function plain(value) {
  return value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseChangelog(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const entries = [];
  let entry = null;
  let list = null;
  let paragraph = null;

  const flushList = () => {
    if (entry && list && list.length > 0) entry.blocks.push({ type: 'list', items: list });
    list = null;
  };
  const flushParagraph = () => {
    if (entry && paragraph) entry.blocks.push({ type: 'p', text: paragraph });
    paragraph = null;
  };
  const flushAll = () => {
    flushList();
    flushParagraph();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^#\s+/.test(line)) continue;

    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flushAll();
      const [version, ...rest] = heading[1].split(' — ');
      entry = {
        version: version.trim(),
        title: rest.join(' — ').trim() || 'Release',
        blocks: [],
      };
      entries.push(entry);
      continue;
    }

    if (!entry) continue;

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const bullet = /^-\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      if (!list) list = [];
      list.push(bullet[1].trim());
      continue;
    }

    if (/^\s{2,}\S/.test(line) && list && list.length > 0) {
      list[list.length - 1] += ` ${line.trim()}`;
      continue;
    }

    const subheading = /^\*\*(.+?)\*\*\s*$/.exec(line.trim());
    if (subheading) {
      flushAll();
      entry.blocks.push({ type: 'h', text: subheading[1] });
      continue;
    }

    flushList();
    paragraph = paragraph ? `${paragraph} ${line.trim()}` : line.trim();
  }

  flushAll();
  return entries;
}

function renderEntry(entry, index) {
  const blocks = entry.blocks
    .map((block) => {
      if (block.type === 'list') {
        const items = block.items.map((item) => `          <li>${inline(item)}</li>`).join('\n');
        return `        <ul>\n${items}\n        </ul>`;
      }
      if (block.type === 'h') return `        <h3>${inline(block.text)}</h3>`;
      return `        <p>${inline(block.text)}</p>`;
    })
    .join('\n');

  return `      <article class="log-entry" id="v${entry.version}">
        <header class="log-entry-header">
          <h2>${entry.version}</h2>
          <span class="log-title">${inline(entry.title)}</span>
          ${index === 0 ? '<span class="log-latest">Latest</span>' : ''}
        </header>
${blocks}
        <a class="log-release-link" href="https://github.com/${repo}/releases/tag/v${entry.version}">
          Release notes on GitHub <span aria-hidden="true">→</span>
        </a>
      </article>`;
}

function renderPage(entries) {
  const latest = entries[0];
  const index = entries
    .map(
      (entry) => `        <li>
          <a href="#v${entry.version}">
            ${entry.version}
            <small>${escapeHtml(entry.title)}</small>
          </a>
        </li>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <title>Update log — Movaryn</title>
    <meta
      name="description"
      content="Every Movaryn release, newest first: what changed, what was fixed and what was added."
    />
    <meta name="theme-color" content="#08080b" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Update log — Movaryn" />
    <meta
      property="og:description"
      content="Every Movaryn release, newest first: what changed, what was fixed and what was added."
    />
    <link rel="icon" type="image/svg+xml" href="favicon.svg" />
    <link rel="stylesheet" href="assets/site.css" />
  </head>
  <body>
    <a class="skip" href="#main">Skip to content</a>

    <header class="nav">
      <div class="shell nav-inner">
        <a class="brand" href="./" aria-label="Movaryn home">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none">
              <path
                d="M15 44 L23.5 19 L32 35 L40.5 19 L49 44"
                stroke="currentColor"
                stroke-width="5.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle cx="32" cy="49.5" r="3.1" fill="currentColor" />
            </svg>
          </span>
          <span class="brand-text">
            <strong>Movaryn</strong>
            <small>Moveset studio</small>
          </span>
        </a>

        <nav class="nav-links" aria-label="Primary">
          <a href="./#features">Features</a>
          <a href="./#workflow">Workflow</a>
          <a href="changelog.html" aria-current="page">Update log</a>
          <a href="https://github.com/${repo}" rel="noreferrer">GitHub</a>
        </nav>

        <a
          class="btn btn-primary nav-cta"
          href="https://github.com/${repo}/releases/latest"
          data-download="setup"
        >
          Download
        </a>
      </div>
    </header>

    <main id="main">
      <section class="log-hero">
        <div class="shell">
          <p class="eyebrow"><span class="dot"></span> ${entries.length} releases</p>
          <h1>Update log</h1>
          <p>
            What changed in every Movaryn build, newest first. The newest release is
            <strong>${latest.version}</strong> — ${inline(latest.title)}.
          </p>
        </div>
      </section>

      <div class="shell log-layout">
        <aside class="log-index">
          <p>All releases</p>
          <ol>
${index}
          </ol>
        </aside>

        <section class="log-entries" aria-label="Release notes">
${entries.map(renderEntry).join('\n\n')}
        </section>
      </div>
    </main>

    <footer class="footer">
      <div class="shell footer-grid">
        <div>
          <a class="brand" href="./" aria-label="Movaryn home">
            <span class="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 64 64" fill="none">
                <path
                  d="M15 44 L23.5 19 L32 35 L40.5 19 L49 44"
                  stroke="currentColor"
                  stroke-width="5.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <circle cx="32" cy="49.5" r="3.1" fill="currentColor" />
              </svg>
            </span>
            <span class="brand-text"><strong>Movaryn</strong><small>Moveset studio</small></span>
          </a>
          <p class="footer-note">
            Designed and built by <strong>Raevik</strong>. Ideas are yours; the keys never leave your
            machine.
          </p>
        </div>
        <nav class="footer-links" aria-label="Footer">
          <a href="./">Home</a>
          <a href="./#features">Features</a>
          <a href="https://github.com/${repo}" rel="noreferrer">GitHub</a>
          <a href="https://github.com/${repo}/releases" rel="noreferrer">Releases</a>
        </nav>
      </div>
      <div class="shell footer-base">
        <span>© <span id="year">${new Date().getFullYear()}</span> Movaryn</span>
        <span>Not affiliated with any game or studio mentioned.</span>
      </div>
    </footer>

    <script src="assets/site.js" defer></script>
  </body>
</html>
`;
}

const changelog = await readFile(path.join(root, 'CHANGELOG.md'), 'utf8');
const entries = parseChangelog(changelog);

if (entries.length === 0) {
  throw new Error('No releases found in CHANGELOG.md — expected "## <version> — <title>" headings.');
}

await mkdir(siteDir, { recursive: true });
await writeFile(path.join(siteDir, 'changelog.html'), renderPage(entries));

const summary = entries.map((entry) => {
  const firstList = entry.blocks.find((block) => block.type === 'list');
  const firstParagraph = entry.blocks.find((block) => block.type === 'p');
  const text =
    (firstList && firstList.items[0]) || firstParagraph?.text || plain(entry.title);
  const clean = plain(text);
  return {
    version: entry.version,
    title: plain(entry.title),
    summary: clean.length > 150 ? `${clean.slice(0, 149).trimEnd()}…` : clean,
  };
});

await writeFile(path.join(siteDir, 'changelog.json'), `${JSON.stringify(summary, null, 2)}\n`);
await copyFile(path.join(root, 'public', 'favicon.svg'), path.join(siteDir, 'favicon.svg'));

console.log(`Built site/changelog.html and site/changelog.json (${entries.length} releases).`);
