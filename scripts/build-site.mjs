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
          <a href="roadmap.html">Roadmap</a>
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
          <a href="roadmap.html">Roadmap</a>
          <a href="changelog.html">Update log</a>
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

function parseRoadmap(text) {
  const stages = [];
  let stage = null;

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('# ')) continue;

    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) {
      stage = { title: heading[1].trim(), intro: '', items: [] };
      stages.push(stage);
      continue;
    }
    if (!stage) continue;

    const bullet = /^-\s+(.*)$/.exec(line);
    if (bullet) {
      stage.items.push(bullet[1].trim());
      continue;
    }
    stage.intro = stage.intro ? `${stage.intro} ${line}` : line;
  }

  return stages;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function renderRoadmapPage(stages) {
  const order = ['now', 'next', 'later', 'shipped'];
  const sorted = [...stages].sort(
    (a, b) => order.indexOf(a.title.toLowerCase()) - order.indexOf(b.title.toLowerCase()),
  );
  const columns = sorted.filter((stage) => stage.title.toLowerCase() !== 'shipped');
  const shipped = sorted.find((stage) => stage.title.toLowerCase() === 'shipped');

  const columnHtml = columns
    .map(
      (stage) => `        <section class="roadmap-column" id="${slugify(stage.title)}">
          <header>
            <h2>${escapeHtml(stage.title)}</h2>
            <span class="roadmap-kicker">${
              stage.title.toLowerCase() === 'now'
                ? 'In progress'
                : stage.title.toLowerCase() === 'next'
                  ? 'Planned'
                  : 'Exploring'
            }</span>
          </header>
          ${stage.intro ? `<p class="roadmap-intro">${inline(stage.intro)}</p>` : ''}
          <ul class="roadmap-list">
${stage.items.map((item) => `            <li>${inline(item)}</li>`).join('\n')}
          </ul>
        </section>`,
    )
    .join('\n');

  const shippedHtml = shipped
    ? `      <section class="roadmap-shipped" id="shipped">
        <h2>Shipped</h2>
        <ul>
${shipped.items.map((item) => `          <li>${inline(item)}</li>`).join('\n')}
        </ul>
      </section>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <title>Roadmap — Movaryn</title>
    <meta
      name="description"
      content="What Movaryn is working on now, what comes next, what is being explored and what has already shipped."
    />
    <meta name="theme-color" content="#08080b" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Roadmap — Movaryn" />
    <meta
      property="og:description"
      content="Now, next and later for the Movaryn moveset studio — plus everything already shipped."
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
          <a href="roadmap.html" aria-current="page">Roadmap</a>
          <a href="changelog.html">Update log</a>
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
          <p class="eyebrow"><span class="dot"></span> Living document</p>
          <h1>Roadmap</h1>
          <p>
            What Movaryn is working on now, what comes next and what is still being explored. It is
            updated with each release; scope and order can change, and nothing here is a promise of a
            date.
          </p>
        </div>
      </section>

      <div class="shell roadmap-layout">
        <div class="roadmap-grid">
${columnHtml}
        </div>

${shippedHtml}

        <p class="roadmap-note">
          Have a feature that would make kits easier to build? Open an issue on
          <a href="https://github.com/${repo}/issues">GitHub</a> — concrete problems are easier to act
          on than votes.
        </p>
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
          <a href="roadmap.html">Roadmap</a>
          <a href="changelog.html">Update log</a>
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

const roadmapText = await readFile(path.join(root, 'ROADMAP.md'), 'utf8');
const roadmapStages = parseRoadmap(roadmapText);
if (roadmapStages.length === 0) {
  throw new Error('No stages found in ROADMAP.md — expected "## Now" style headings.');
}
await writeFile(path.join(siteDir, 'roadmap.html'), renderRoadmapPage(roadmapStages));

console.log(
  `Built site/changelog.html and site/changelog.json (${entries.length} releases), and site/roadmap.html (${roadmapStages.length} stages).`,
);
