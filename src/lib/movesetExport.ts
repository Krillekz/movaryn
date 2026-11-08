import type { Project } from '../../shared/types';
import { slugify } from './utils';

export interface MoveSheetRow {
  name: string;
  purpose: string;
  description: string;
}

export interface MoveSummary {
  total: number;
  withoutPurpose: number;
  longestName: number;
}

/** Moves in a stable, export-friendly shape. */
export function moveSheetRows(project: Project): MoveSheetRow[] {
  return project.moves.map((move) => ({
    name: move.name.trim(),
    purpose: (move.purpose ?? '').trim(),
    description: (move.description ?? '').trim().replace(/\s*\n\s*/g, ' '),
  }));
}

export function moveSummary(project: Project): MoveSummary {
  const rows = moveSheetRows(project);
  return {
    total: rows.length,
    withoutPurpose: rows.filter((row) => !row.purpose).length,
    longestName: rows.reduce((longest, row) => Math.max(longest, row.name.length), 0),
  };
}

export function projectFileName(project: Project, extension: string): string {
  return `movaryn-${slugify(project.name || 'character', 40)}.${extension}`;
}

/**
 * A readable design sheet: what the character is, the constraints they were
 * built under, then each move with its purpose.
 */
export function projectToMarkdown(project: Project): string {
  const rows = moveSheetRows(project);
  const lines: string[] = [`# ${project.name || 'Untitled character'}`, ''];

  const meta = [
    project.game ? `**Game:** ${project.game}` : '',
    project.theme ? `**Theme:** ${project.theme}` : '',
  ].filter(Boolean);
  if (meta.length > 0) lines.push(meta.join('  \n'), '');

  if (project.description?.trim()) lines.push(project.description.trim(), '');
  if (project.constraints?.trim()) lines.push('## Constraints', '', project.constraints.trim(), '');

  lines.push(`## Moves (${rows.length})`, '');
  rows.forEach((row, index) => {
    lines.push(`### ${index + 1}. ${row.name}${row.purpose ? ` — ${row.purpose}` : ''}`, '');
    if (row.description) lines.push(row.description, '');
  });

  return `${lines.join('\n').trimEnd()}\n`;
}

function csvCell(value: string): string {
  const text = value.replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * One row per move for spreadsheets or engine import tables. A UTF-8 BOM keeps
 * Excel from mangling accented move names.
 */
export function projectToCsv(project: Project): string {
  const rows = moveSheetRows(project);
  const header = ['Name', 'Purpose', 'Description'].join(',');
  const body = rows.map((row) =>
    [csvCell(row.name), csvCell(row.purpose), csvCell(row.description)].join(','),
  );
  return `\uFEFF${[header, ...body].join('\r\n')}\r\n`;
}

/** Full backup, including the brief fields that are not part of the move table. */
export function projectToJson(project: Project): Record<string, unknown> {
  return {
    exportedAt: new Date().toISOString(),
    name: project.name,
    game: project.game,
    theme: project.theme ?? '',
    description: project.description ?? '',
    constraints: project.constraints ?? '',
    moves: moveSheetRows(project),
  };
}
