import type { Project } from '../../shared/types';
import { briefModeLabel } from '../../shared/brief';
import {
  presetForGame,
  runSandbox,
  scoreKit,
  type SandboxPresetId,
} from '../../shared/sandbox';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function paragraph(value?: string): string {
  return value?.trim() ? `<p>${escapeHtml(value.trim()).replace(/\n/g, '<br>')}</p>` : '';
}

/**
 * A self-contained sheet the user can download, open in a browser and print.
 * Printing inside the packaged app would depend on window.open, which the
 * Electron shell blocks, so the file is the reliable path.
 */
export function projectSheetHtml(project: Project): string {
  const presetId = (project.sandboxPreset as SandboxPresetId | undefined) ?? presetForGame(project.game);
  const report = runSandbox(project.moves, presetId);
  const scores = scoreKit(project.moves, report);
  const facts = project.brief?.facts ?? [];

  const moveRows = project.moves
    .map(
      (move, index) => `
      <section class="move">
        <h3>${index + 1}. ${escapeHtml(move.name)}${move.purpose ? ` <span class="role">${escapeHtml(move.purpose)}</span>` : ''}</h3>
        <p>${escapeHtml(move.description).replace(/\n/g, '<br>')}</p>
      </section>`,
    )
    .join('');

  const frameRows = report.frames
    .map(
      (frame) => `<tr>
        <td>${escapeHtml(frame.name)}</td>
        <td>${frame.startup}</td><td>${frame.active}</td><td>${frame.recovery}</td>
        <td>${frame.total}</td><td>${frame.basis === 'text' ? 'stated' : 'estimated'}</td>
      </tr>`,
    )
    .join('');

  const counterRows = report.counterplay
    .map(
      (line) =>
        `<li><strong>${escapeHtml(line.answer)}</strong> — ${escapeHtml(line.verdict)}: ${escapeHtml(line.detail)}</li>`,
    )
    .join('');

  const factRows = facts
    .map(
      (fact) =>
        `<li>${escapeHtml(fact.text)}${fact.source ? ` <span class="source">[${escapeHtml(fact.source)}]</span>` : ''}</li>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(project.name || 'Movaryn kit')}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; margin: 32px auto; max-width: 760px; color: #16161c; line-height: 1.5; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .12em; color: #6a6a78; margin: 28px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 15px; margin: 0 0 4px; }
  .meta { color: #555; font-size: 13px; }
  .role { font-weight: 400; color: #666; font-size: 12px; }
  .move { border: 1px solid #e2e2e8; border-radius: 8px; padding: 10px 12px; margin: 0 0 8px; break-inside: avoid; }
  .move p { margin: 0; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border-bottom: 1px solid #e6e6ec; padding: 5px 6px; text-align: left; }
  ul { margin: 6px 0 0 18px; padding: 0; font-size: 13px; }
  .note { font-size: 12px; color: #6a6a78; }
  .source { color: #6a6a78; }
  @media print { body { margin: 12mm; max-width: none; } .note { color: #444; } }
</style>
</head>
<body>
  <h1>${escapeHtml(project.name || 'Untitled character')}</h1>
  <p class="meta">${[project.game, project.theme].filter(Boolean).map((value) => escapeHtml(value as string)).join(' · ') || 'Movaryn kit'}</p>
  ${paragraph(project.description)}
  ${project.constraints?.trim() ? `<h2>Constraints</h2>${paragraph(project.constraints)}` : ''}
  ${
    project.brief
      ? `<h2>Character brief — ${escapeHtml(briefModeLabel(project.brief.mode))}</h2>
         ${project.brief.series ? paragraph(`Series: ${project.brief.series}`) : ''}
         ${project.brief.version ? paragraph(`Version: ${project.brief.version}`) : ''}
         ${project.brief.abilities ? paragraph(`Abilities to keep: ${project.brief.abilities}`) : ''}
         ${project.brief.avoid ? paragraph(`Abilities to avoid: ${project.brief.avoid}`) : ''}
         ${factRows ? `<ul>${factRows}</ul>` : ''}`
      : ''
  }
  <h2>Moves (${project.moves.length})</h2>
  ${moveRows || '<p class="note">No saved moves yet.</p>'}
  <h2>Sandbox estimates — ${escapeHtml(report.presetName)}</h2>
  <p class="note">Windows are estimated from the written moves and a game preset. They are not measured frame data.</p>
  ${
    report.frames.length
      ? `<table><thead><tr><th>Move</th><th>Startup</th><th>Active</th><th>Recovery</th><th>Total</th><th>Basis</th></tr></thead><tbody>${frameRows}</tbody></table>`
      : ''
  }
  ${counterRows ? `<h2>Counterplay</h2><ul>${counterRows}</ul>` : ''}
  ${
    scores.length
      ? `<h2>Scorecard</h2><ul>${scores.map((axis) => `<li><strong>${escapeHtml(axis.label)}</strong> ${axis.score}/100 — ${escapeHtml(axis.detail)}</li>`).join('')}</ul>`
      : ''
  }
  ${project.matchupNotes?.trim() ? `<h2>Matchup notes</h2>${paragraph(project.matchupNotes)}` : ''}
  <p class="note">Made with Movaryn. Movaryn is not affiliated with any game or studio mentioned. Verify mechanics in the current game build.</p>
</body>
</html>`;
}
