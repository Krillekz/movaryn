import type { Project } from '../../shared/types';

export interface ImportedMove {
  name: string;
  description: string;
  purpose?: string;
}

export interface ImportedMoveset {
  format: 'json' | 'csv';
  moves: ImportedMove[];
  brief: {
    name?: string;
    game?: string;
    theme?: string;
    description?: string;
    constraints?: string;
  };
  /** Rows that were present but unusable, so the UI can be honest about skips. */
  skipped: number;
}

export class MovesetImportError extends Error {}

const MAX_MOVES = 500;

function text(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : '';
}

function optional(value: unknown): string | undefined {
  const cleaned = text(value);
  return cleaned || undefined;
}

/** Reads one move from a loosely shaped object, accepting the field names we export and the common variants. */
function moveFromObject(raw: unknown): ImportedMove | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const name = text(record.name ?? record.Name ?? record.move ?? record.title);
  if (!name) return null;
  const description = text(
    record.description ?? record.Description ?? record.desc ?? record.effect ?? record.text,
  );
  const purpose = optional(record.purpose ?? record.Purpose ?? record.role ?? record.type);
  return { name, description, ...(purpose ? { purpose } : {}) };
}

function briefFromObject(raw: Record<string, unknown>): ImportedMoveset['brief'] {
  return {
    name: optional(raw.name ?? raw.character),
    game: optional(raw.game),
    theme: optional(raw.theme),
    description: optional(raw.description),
    constraints: optional(raw.constraints),
  };
}

function fromJson(source: string): ImportedMoveset {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new MovesetImportError('That file is not valid JSON.');
  }

  // Accept our own export, the older { project: … } shape, or a bare array of moves.
  let container: Record<string, unknown> | null = null;
  let list: unknown[] | null = null;

  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && typeof parsed === 'object') {
    container = parsed as Record<string, unknown>;
    if (Array.isArray(container.moves)) list = container.moves;
    else if (container.project && typeof container.project === 'object') {
      const project = container.project as Record<string, unknown>;
      container = project;
      if (Array.isArray(project.moves)) list = project.moves;
    }
  }

  if (!list) throw new MovesetImportError('No move list was found in that JSON file.');

  const moves: ImportedMove[] = [];
  let skipped = 0;
  for (const entry of list) {
    if (moves.length >= MAX_MOVES) break;
    const move = moveFromObject(entry);
    if (move) moves.push(move);
    else skipped += 1;
  }

  return {
    format: 'json',
    moves,
    brief: container ? briefFromObject(container) : {},
    skipped,
  };
}

/** RFC 4180 style split: quoted cells may contain commas, escaped quotes and newlines. */
function parseCsvRows(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''));
}

function normaliseHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase();
}

function fromCsv(source: string): ImportedMoveset {
  const rows = parseCsvRows(source.replace(/^\uFEFF/, ''));
  if (rows.length === 0) throw new MovesetImportError('That CSV file is empty.');

  const header = rows[0].map(normaliseHeader);
  const nameIndex = header.findIndex((cell) => /^(name|move|title)$/.test(cell));
  const purposeIndex = header.findIndex((cell) => /^(purpose|role|type)$/.test(cell));
  const descriptionIndex = header.findIndex((cell) => /^(description|desc|effect|text)$/.test(cell));
  const hasHeader = nameIndex >= 0;
  const columns = hasHeader
    ? { name: nameIndex, purpose: purposeIndex, description: descriptionIndex }
    : { name: 0, purpose: 1, description: 2 };

  if (hasHeader && columns.name !== 0 && columns.description < 0) {
    throw new MovesetImportError(
      'That CSV has a name column but no description column. Expected Name, Purpose, Description.',
    );
  }

  const moves: ImportedMove[] = [];
  let skipped = 0;
  for (const cells of rows.slice(hasHeader ? 1 : 0)) {
    if (moves.length >= MAX_MOVES) break;
    const name = text(cells[columns.name]);
    if (!name) {
      skipped += 1;
      continue;
    }
    const description = text(columns.description >= 0 ? cells[columns.description] : '');
    const purpose = optional(columns.purpose >= 0 ? cells[columns.purpose] : '');
    moves.push({ name, description, ...(purpose ? { purpose } : {}) });
  }

  return { format: 'csv', moves, brief: {}, skipped };
}

/**
 * Turns an exported moveset file back into moves. JSON accepts our export, the
 * older project wrapper shape, or a bare move array; CSV expects a header row
 * but also copes with plain Name,Purpose,Description columns.
 */
export function parseMovesetFile(source: string, filename = ''): ImportedMoveset {
  const trimmed = source.trim();
  if (!trimmed) throw new MovesetImportError('That file is empty.');

  const isJson =
    filename.toLowerCase().endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[');
  let result: ImportedMoveset;
  try {
    result = isJson ? fromJson(trimmed) : fromCsv(trimmed);
  } catch (error) {
    if (error instanceof MovesetImportError) throw error;
    throw new MovesetImportError('That file could not be read as a moveset.');
  }

  if (result.moves.length === 0) {
    throw new MovesetImportError('No usable moves were found in that file.');
  }
  return result;
}

/** Brief fields worth filling in when the project still has them blank. */
export function briefPatch(
  project: Project,
  brief: ImportedMoveset['brief'],
): Partial<Pick<Project, 'name' | 'game' | 'theme' | 'description' | 'constraints'>> {
  const patch: Partial<Pick<Project, 'name' | 'game' | 'theme' | 'description' | 'constraints'>> = {};
  if (!project.game.trim() && brief.game) patch.game = brief.game;
  if (!project.theme?.trim() && brief.theme) patch.theme = brief.theme;
  if (!project.description?.trim() && brief.description) patch.description = brief.description;
  if (!project.constraints?.trim() && brief.constraints) patch.constraints = brief.constraints;
  const genericName = !project.name.trim() || /^untitled character$/i.test(project.name.trim());
  if (genericName && brief.name) patch.name = brief.name;
  return patch;
}
