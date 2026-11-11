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
