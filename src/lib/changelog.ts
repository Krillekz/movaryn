export interface ChangelogSection {
  version: string;
  title: string;
  body: string;
}

/**
 * Splits CHANGELOG.md into release sections. The file is imported raw by the
 * app, so the in-app notes and the public update log come from one source.
 */
export function splitChangelog(raw: string, limit = 3): ChangelogSection[] {
  const lines = (raw ?? '').replace(/\r\n?/g, '\n').split('\n');
  const sections: ChangelogSection[] = [];
  let current: { version: string; title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      if (current) {
        sections.push({
          version: current.version,
          title: current.title,
          body: current.lines.join('\n').trim(),
        });
      }
      const [version, ...rest] = heading[1].split(' — ');
      current = {
        version: version.trim(),
        title: rest.join(' — ').trim() || 'Release',
        lines: [],
      };
      continue;
    }
    if (/^#\s+/.test(line)) continue;
    if (current) current.lines.push(line);
  }

  if (current) {
    sections.push({
      version: current.version,
      title: current.title,
      body: current.lines.join('\n').trim(),
    });
  }

  return sections.slice(0, Math.max(1, limit));
}
