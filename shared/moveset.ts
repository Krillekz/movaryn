/**
 * Parses an assistant response into moveset sections and individual moves.
 * Used for rich rendering, per-move copy buttons, project saving and for
 * collecting existing move names so they are not suggested twice.
 *
 * The parser is conservative: it only reports `isMoveset` when the text really
 * looks like a moveset, so ordinary prose still renders as normal markdown.
 */

export interface ParsedField {
  label: string;
  value: string;
}

export interface ParsedMove {
  number?: number;
  name: string;
  description: string;
  purpose?: string;
  fields: ParsedField[];
  raw: string;
}

export interface ParsedMeta {
  character?: string;
  theme?: string;
  game?: string;
}

export type MovesetBlock =
  | { type: 'section'; title: string }
  | { type: 'move'; move: ParsedMove }
  | { type: 'text'; text: string };

export interface ParsedResponse {
  isMoveset: boolean;
  meta: ParsedMeta;
  blocks: MovesetBlock[];
  moves: ParsedMove[];
}

const META_KEYS: Record<string, keyof ParsedMeta> = {
  character: 'character',
  name: 'character',
  theme: 'theme',
  game: 'game',
};

const SECTION_WORDS =
  /(MOVES|MOVESET|ULTIMATE|SPECIAL|PASSIVE|ABILITY|ABILITIES|DIFFICULTY|BUILD|CHAIN|COMBO|GAMEPLAN|NOTES|KIT|TRAITS|SIGNATURE|BALANCE|COUNTERPLAY)/;

const SECTION_TITLES = new Set([
  'BASE MOVES',
  'BASE MOVE',
  'MOVES',
  'SIGNATURE MOVES',
  'SPECIAL',
  'SPECIAL MOVES',
  'ULTIMATE',
  'ULTIMATES',
  'PASSIVE',
  'PASSIVES',
  'M1 CHAIN',
  'M1',
  'COMBOS',
  'COMBO ROUTES',
  'GAMEPLAN',
  'GAME PLAN',
  'BUILD DIFFICULTY',
  'DIFFICULTY',
  'BUILD NOTES',
  'BALANCE NOTES',
  'NOTES',
  'KIT',
  'ABILITIES',
  'TRAITS',
  'COUNTERPLAY',
]);

const FIELD_LABELS = [
  'description',
  'action',
  'sequence',
  'purpose',
  'type',
  'input',
  'cooldown',
  'damage',
  'startup',
  'endlag',
  'recovery',
  'range',
  'hitbox',
  'on hit',
  'on miss',
  'notes',
  'note',
  'role',
  'category',
  'build',
  'difficulty',
  'vfx',
  'voice line',
  'condition',
  'effect',
];

const FIELD_RE = new RegExp(`^\\s*(?:[-*]\\s*)?(${FIELD_LABELS.join('|')})\\s*:\\s*(.*)$`, 'i');
const META_RE = /^\s*(CHARACTER|NAME|THEME|GAME|TITLE|ROLE|FACTION|WEAPON)\s*:\s*(.+?)\s*$/i;
const NUMBERED_RE = /^\s{0,3}(?:#{1,4}\s*)?\*{0,2}(\d{1,2})[.)]\s*(.*)$/;
const BOLD_ONLY_RE = /^\s{0,3}(?:#{1,4}\s*)?\*{2}([^*]{2,80})\*{2}\s*:?\s*$/;
const HEADING_RE = /^\s{0,3}(#{1,4})\s+(.+?)\s*$/;
const UPPER_RE = /^[A-Z][A-Z0-9 '’&/().\-]{2,44}$/;

export function parseMoveset(input: string): ParsedResponse {
  const text = (input ?? '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const blocks: MovesetBlock[] = [];
  const moves: ParsedMove[] = [];
  const meta: ParsedMeta = {};

  let textBuffer: string[] = [];
  let current: ParsedMove | null = null;
  let currentLines: string[] = [];

  const flushText = () => {
    const joined = textBuffer.join('\n').trim();
    if (joined) blocks.push({ type: 'text', text: joined });
    textBuffer = [];
  };

  const flushMove = () => {
    if (!current) return;
    const move = finishMove(current, currentLines);
    if (move) {
      moves.push(move);
      blocks.push({ type: 'move', move });
    } else if (currentLines.join('\n').trim()) {
      blocks.push({ type: 'text', text: currentLines.join('\n').trim() });
    }
    current = null;
    currentLines = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (!line.trim()) {
      if (current) currentLines.push('');
      else if (textBuffer.length) textBuffer.push('');
      continue;
    }

    // Markdown heading / standalone uppercase title -> section
    const heading = line.match(HEADING_RE);
    const headingText = heading ? heading[2].replace(/\*{1,2}/g, '').trim() : '';
    const upperCandidate = line.trim().replace(/:$/, '');
    const looksLikeSection =
      (heading && !NUMBERED_RE.test(headingText)) ||
      (UPPER_RE.test(upperCandidate) &&
        (SECTION_TITLES.has(upperCandidate) ||
          (!line.includes(':') && SECTION_WORDS.test(upperCandidate))));

    if (looksLikeSection) {
      const title = (heading ? headingText : upperCandidate).replace(/[:#*]/g, '').trim();
      if (title && title.split(/\s+/).length <= 5) {
        flushText();
        flushMove();
        blocks.push({ type: 'section', title: title.toUpperCase() });
        continue;
      }
    }

    const metaMatch = line.match(META_RE);
    if (metaMatch) {
      const key = META_KEYS[metaMatch[1].toLowerCase()];
      if (key && !meta[key]) {
        flushText();
        flushMove();
        meta[key] = metaMatch[2].replace(/\*{1,2}/g, '').trim();
        continue;
      }
    }

    const numbered = line.match(NUMBERED_RE);
    const boldOnly = !numbered ? line.match(BOLD_ONLY_RE) : null;

    if (numbered || boldOnly) {
      const rawName = (numbered ? numbered[2] : boldOnly ? boldOnly[1] : '')
        .replace(/\*{1,2}/g, '')
        .trim();
      if (rawName && rawName.length <= 90 && !/[.!?]$/.test(rawName)) {
        // Split inline descriptions: "1. Name — action happens here"
        const split = rawName.split(/\s+[—–]\s+|\s+-\s+|\s+:\s+/);
        const name = (split[0] ?? '').trim().replace(/[.:]$/, '');
        const inline = split.length > 1 ? split.slice(1).join(' — ').trim() : '';
        if (name) {
          flushText();
          flushMove();
          current = {
            number: numbered ? Number(numbered[1]) : undefined,
            name,
            description: inline,
            fields: [],
            raw: '',
          };
          currentLines = [line];
          if (inline) {
            current.fields.push({ label: 'Description', value: inline });
            current.description = inline;
          }
          continue;
        }
      }
    }

    const fieldMatch = line.match(FIELD_RE);
    if (current && fieldMatch) {
      const label = normalizeLabel(fieldMatch[1]);
      const value = fieldMatch[2].replace(/\*{1,2}/g, '').trim();
      current.fields.push({ label, value });
      currentLines.push(line);
      if (/description|action|sequence|effect/i.test(label) && !current.description) {
        current.description = value;
      }
      if (/purpose|role/i.test(label) && !current.purpose) current.purpose = value;
      continue;
    }

    if (current) {
      const indented = /^\s{2,}/.test(line) || /^\s*[-*•]\s+/.test(line);
      const last = current.fields[current.fields.length - 1];
      if (last && indented) {
        last.value = `${last.value} ${line.replace(/^\s*[-*•]\s*/, '').trim()}`.trim();
        if (/description|action|sequence/i.test(last.label)) current.description = last.value;
        if (/purpose|role/i.test(last.label)) current.purpose = last.value;
        currentLines.push(line);
        continue;
      }
      flushMove();
    }

    textBuffer.push(line);
  }

  flushMove();
  flushText();

  const strongMoves = moves.filter(
    (move) => move.description.trim().length > 8 || move.fields.length > 1,
  );
  const hasMoveSection = blocks.some(
    (block) =>
      block.type === 'section' && /MOVE|ULTIMATE|SPECIAL|PASSIVE|ABILITY|CHAIN|KIT/.test(block.title),
  );
  const isMoveset =
    strongMoves.length > 0 &&
    (hasMoveSection ||
      strongMoves.length >= 2 ||
      strongMoves.some((move) => Boolean(move.purpose?.trim())));

  return { isMoveset, meta, blocks, moves };
}

function finishMove(move: ParsedMove, lines: string[]): ParsedMove | null {
  const fields = move.fields
    .map((field) => ({ label: field.label, value: field.value.trim() }))
    .filter((field) => field.value.length > 0);

  let description = move.description.trim();
  if (!description) {
    const fallback = fields.find((field) => /description|action|sequence/i.test(field.label));
    description = fallback?.value ?? '';
  }

  if (!description && fields.length === 0) return null;
  if (!move.name.trim()) return null;

  const purpose = move.purpose?.trim() || fields.find((f) => /purpose|role/i.test(f.label))?.value;

  return {
    number: move.number,
    name: move.name.trim(),
    description,
    purpose: purpose?.trim() || undefined,
    fields,
    raw: lines.join('\n').trim(),
  };
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Plain-text form of one move, for the copy button. */
export function moveToText(move: ParsedMove): string {
  const header = move.number ? `${move.number}. ${move.name}` : move.name;
  const fieldLines = move.fields.length
    ? move.fields.map((field) => `${field.label}: ${field.value}`)
    : move.description
      ? [`Description: ${move.description}`]
      : [];
  return [header, ...fieldLines].join('\n');
}

/** Every move name the project has already used. */
export function collectMoveNames(responses: string[]): string[] {
  const names = new Set<string>();
  for (const response of responses) {
    const parsed = parseMoveset(response);
    if (!parsed.isMoveset) continue;
    for (const move of parsed.moves) names.add(move.name);
  }
  return Array.from(names);
}
