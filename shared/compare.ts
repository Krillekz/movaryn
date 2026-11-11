/**
 * Compares two saved kits on the same sandbox preset.
 *
 * This is a design aid built from the same estimates as the sandbox, not a
 * balance verdict and not measured game data.
 */
import {
  runSandbox,
  scoreKit,
  type KitMoveInput,
  type SandboxPresetId,
  type SandboxReport,
  type ScoreAxis,
} from './sandbox';

export interface CompareKitInput {
  name: string;
  moves: KitMoveInput[];
}

export interface CompareSideSummary {
  name: string;
  moveCount: number;
  totalFrames: number;
  averageStartup: number;
  averageRecovery: number;
  report: SandboxReport;
  scores: ScoreAxis[];
}

export interface KitComparison {
  presetName: string;
  a: CompareSideSummary;
  b: CompareSideSummary;
  /** Move names present in both kits, in the first kit's casing. */
  sharedNames: string[];
  onlyA: string[];
  onlyB: string[];
  notes: string[];
}

const normaliseName = (name: string) => name.trim().toLowerCase();

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function summarise(input: CompareKitInput, presetId: SandboxPresetId): CompareSideSummary {
  const report = runSandbox(input.moves, presetId);
  return {
    name: input.name,
    moveCount: input.moves.length,
    totalFrames: report.totalFrames,
    averageStartup: average(report.frames.map((frame) => frame.startup)),
    averageRecovery: average(report.frames.map((frame) => frame.recovery)),
    report,
    scores: scoreKit(input.moves, report),
  };
}

export function compareKits(
  a: CompareKitInput,
  b: CompareKitInput,
  presetId: SandboxPresetId,
): KitComparison {
  const first = summarise(a, presetId);
  const second = summarise(b, presetId);
  const firstNames = new Map(a.moves.map((move) => [normaliseName(move.name), move.name]));
  const secondNames = new Map(b.moves.map((move) => [normaliseName(move.name), move.name]));

  const sharedNames: string[] = [];
  const onlyA: string[] = [];
  const onlyB: string[] = [];

  for (const [key, original] of firstNames) {
    if (secondNames.has(key)) sharedNames.push(original);
    else onlyA.push(original);
  }
  for (const [key, original] of secondNames) {
    if (!firstNames.has(key)) onlyB.push(original);
  }

  const notes: string[] = [];
  if (a.moves.length === 0 || b.moves.length === 0) {
    notes.push('One side has no saved moves, so only the populated kit is being read.');
  }
  if (sharedNames.length > 0) {
    notes.push(
      `${sharedNames.length} move name${sharedNames.length === 1 ? ' is' : 's are'} used in both kits: ${sharedNames.join(', ')}.`,
    );
  }
  if (a.moves.length > 0 && b.moves.length > 0 && first.totalFrames !== second.totalFrames) {
    const diff = Math.abs(first.totalFrames - second.totalFrames);
    const longer = first.totalFrames > second.totalFrames ? first.name : second.name;
    notes.push(`${longer} commits about ${diff} more estimated frames if every move is used once.`);
  }
  if (presetId === 'arena') {
    notes.push('Neither kit has a game preset, so both use the general arena defaults.');
  }

  return {
    presetName: first.report.presetName,
    a: first,
    b: second,
    sharedNames,
    onlyA,
    onlyB,
    notes,
  };
}

export interface CompareUnique {
  name: string;
  moves: string[];
}

export interface ManyKitComparison {
  presetName: string;
  sides: CompareSideSummary[];
  /** Move names that appear in every compared kit. */
  sharedByAll: string[];
  /** Move names that appear in exactly one kit. */
  uniqueTo: CompareUnique[];
  notes: string[];
}

/** Compares three or more kits under one preset. */
export function compareManyKits(kits: CompareKitInput[], presetId: SandboxPresetId): ManyKitComparison {
  const sides = kits.map((kit) => summarise(kit, presetId));
  const counts = new Map<string, { name: string; count: number }>();

  for (const kit of kits) {
    const seen = new Set<string>();
    for (const move of kit.moves) {
      const key = normaliseName(move.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key) ?? { name: move.name, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }

  const sharedByAll = [...counts.values()]
    .filter((entry) => entry.count === kits.length && kits.length > 1)
    .map((entry) => entry.name);
  const uniqueTo = kits.map((kit) => ({
    name: kit.name,
    moves: kit.moves
      .filter((move) => counts.get(normaliseName(move.name))?.count === 1)
      .map((move) => move.name)
      .filter((name, index, names) => names.indexOf(name) === index),
  }));

  const notes: string[] = [];
  if (kits.length < 2) {
    notes.push('Select at least one other kit to compare.');
  }
  for (const side of sides) {
    if (side.moveCount === 0) {
      notes.push(`${side.name} has no saved moves, so it contributes nothing to the comparison.`);
    }
  }
  if (sharedByAll.length > 0) {
    notes.push(
      `${sharedByAll.length} move name${sharedByAll.length === 1 ? ' is' : 's are'} used by every kit: ${sharedByAll.join(', ')}.`,
    );
  }
  const populated = sides.filter((side) => side.moveCount > 0);
  if (populated.length > 1) {
    const longest = populated.reduce((worst, side) => (side.totalFrames > worst.totalFrames ? side : worst));
    const shortest = populated.reduce((best, side) => (side.totalFrames < best.totalFrames ? side : best));
    if (longest.totalFrames !== shortest.totalFrames) {
      notes.push(
        `${longest.name} commits about ${longest.totalFrames - shortest.totalFrames} more estimated frames than ${shortest.name}.`,
      );
    }
  }
  if (presetId === 'arena') {
    notes.push('No game preset is set, so every kit uses the general arena defaults.');
  }

  return { presetName: sides[0]?.report.presetName ?? 'General arena fighter', sides, sharedByAll, uniqueTo, notes };
}

function mdCell(value: string): string {
  return value.replace(/\|/g, '\|').replace(/\r?\n/g, ' ').trim();
}

/** A plain-text record saved with the project; no hidden scoring. */
export function comparisonMarkdown(comparison: ManyKitComparison): string {
  const lines: string[] = [
    `# Kit comparison — ${comparison.presetName}`,
    '',
    '_Estimated from the written moves and one game preset. Not measured frame data and not a balance verdict._',
    '',
    `| Kit | Moves | Total frames | Avg start-up | Avg recovery |`,
    `| --- | --- | --- | --- | --- |`,
    ...comparison.sides.map(
      (side) =>
        `| ${mdCell(side.name)} | ${side.moveCount} | ${side.totalFrames} | ${side.averageStartup} | ${side.averageRecovery} |`,
    ),
    '',
  ];

  const firstScores = comparison.sides[0]?.scores ?? [];
  if (firstScores.length > 0) {
    lines.push(
      `| Axis | ${comparison.sides.map((side) => mdCell(side.name)).join(' | ')} |`,
      `| --- | ${comparison.sides.map(() => '---').join(' | ')} |`,
      ...firstScores.map(
        (axis) =>
          `| ${axis.label} | ${comparison.sides
            .map((side) => String(side.scores.find((entry) => entry.id === axis.id)?.score ?? '—'))
            .join(' | ')} |`,
      ),
      '',
    );
  }

  if (comparison.sharedByAll.length > 0) {
    lines.push(`**In every kit:** ${comparison.sharedByAll.join(', ')}`, '');
  }
  for (const group of comparison.uniqueTo) {
    if (group.moves.length > 0) lines.push(`**Only in ${group.name}:** ${group.moves.join(', ')}`, '');
  }
  if (comparison.notes.length > 0) {
    lines.push('## Notes', '', ...comparison.notes.map((note) => `- ${note}`), '');
  }
  return lines.join('\n');
}
