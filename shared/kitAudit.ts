import type { ParsedMove } from './moveset';

export type KitCheckStatus = 'pass' | 'warn' | 'fail';

export interface KitCheckItem {
  label: string;
  status: KitCheckStatus;
  detail: string;
}

export interface KitCheckReport {
  items: KitCheckItem[];
  passed: number;
  score: number;
}

const OVERUSED = [
  'devastation',
  'oblivion',
  'wrath',
  'destruction',
  'phantom',
  'eclipse',
  'annihilation',
  'cataclysm',
  'requiem',
  'ascension',
  'void',
  'abyss',
  'infinity',
  'chaos',
  'nemesis',
  'zenith',
  'eternal',
];

const SEQUENCE = /\b(start|wind[- ]?up|telegraph|contact|on hit|on block|on miss|recover|recovery|end|aftermath|frames?)\b/i;

/**
 * Local, provider-free checks over a rendered moveset. Nothing here judges
 * creative quality — only the mechanical things a builder would check first.
 */
export function auditKit(moves: ParsedMove[]): KitCheckReport {
  const items: KitCheckItem[] = [];
  const total = moves.length;

  items.push(
    total > 0
      ? { label: 'Moves found', status: 'pass', detail: `${total} move${total === 1 ? '' : 's'} in this reply.` }
      : { label: 'Moves found', status: 'fail', detail: 'No move cards were parsed from this reply.' },
  );

  if (total > 0) {
    const names = moves.map((move) => move.name.trim().toLowerCase());
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    items.push({
      label: 'Unique names',
      status: duplicates.length === 0 ? 'pass' : 'fail',
      detail:
        duplicates.length === 0
          ? 'No duplicate move names.'
          : `Duplicate${duplicates.length === 1 ? '' : 's'}: ${Array.from(new Set(duplicates)).join(', ')}.`,
    });

    const overused = moves
      .map((move) => move.name)
      .filter((name) => OVERUSED.some((word) => name.toLowerCase().includes(word)));
    items.push({
      label: 'Fresh naming',
      status: overused.length === 0 ? 'pass' : 'warn',
      detail:
        overused.length === 0
          ? 'No banned-overused words in the names.'
          : `Overused lexicon in: ${overused.join(', ')}.`,
    });

    const described = moves.filter((move) => {
      const text = move.description || move.fields.find((field) => /^(description|action|sequence)$/i.test(field.label))?.value || '';
      return text.trim().split(/\s+/).length >= 18;
    });
    items.push({
      label: 'Described in detail',
      status: described.length === total ? 'pass' : described.length >= Math.ceil(total / 2) ? 'warn' : 'fail',
      detail: `${described.length} of ${total} moves describe the sequence in enough detail to build.`,
    });

    const sequenced = moves.filter((move) => {
      const text = move.raw || move.description;
      return SEQUENCE.test(text);
    });
    items.push({
      label: 'Start / contact / recovery',
      status: sequenced.length === total ? 'pass' : sequenced.length > 0 ? 'warn' : 'fail',
      detail:
        sequenced.length === total
          ? 'Every move names timing or contact points.'
          : `${sequenced.length} of ${total} moves mention start-up, contact, miss/block or recovery.`,
    });

    const withPurpose = moves.filter((move) => move.purpose?.trim());
    items.push({
      label: 'Roles stated',
      status: withPurpose.length === total ? 'pass' : withPurpose.length > 0 ? 'warn' : 'fail',
      detail:
        withPurpose.length === total
          ? 'Every move has a stated job in the kit.'
          : `${withPurpose.length} of ${total} moves state a purpose or role.`,
    });

    const openers = moves.map((move) => move.name.trim().split(/\s+/)[0]?.toLowerCase());
    const repeatedOpeners = openers.filter((word, index) => word && openers.indexOf(word) !== index);
    items.push({
      label: 'Distinct openings',
      status: repeatedOpeners.length === 0 ? 'pass' : 'warn',
      detail:
        repeatedOpeners.length === 0
          ? 'Names do not repeat the same first word.'
          : `Repeated first word${repeatedOpeners.length === 1 ? '' : 's'}: ${Array.from(new Set(repeatedOpeners)).join(', ')}.`,
    });
  }

  const passed = items.filter((item) => item.status === 'pass').length;
  return { items, passed, score: items.length ? Math.round((passed / items.length) * 100) : 0 };
}
