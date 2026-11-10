/**
 * A local, provider-free sandbox for a saved kit.
 *
 * Everything here is estimated from the written moves and a per-game preset.
 * Nothing is measured game data, and the report says so rather than presenting
 * a guess as frame data.
 */

export type SandboxPresetId = 'jjs' | 'tsb' | 'arena';

export interface SandboxPreset {
  id: SandboxPresetId;
  name: string;
  aliases: string[];
  startup: number;
  active: number;
  recovery: number;
  note: string;
}

export const SANDBOX_PRESETS: SandboxPreset[] = [
  {
    id: 'jjs',
    name: 'Jujutsu Shenanigans',
    aliases: ['jjs', 'jujutsu', 'shenanigans'],
    startup: 10,
    active: 5,
    recovery: 16,
    note: 'Fast neutral, short active windows, short recoveries.',
  },
  {
    id: 'tsb',
    name: 'The Strongest Battlegrounds',
    aliases: ['tsb', 'strongest', 'battlegrounds'],
    startup: 12,
    active: 6,
    recovery: 20,
    note: 'Heavier commitment and longer recoveries.',
  },
  {
    id: 'arena',
    name: 'General arena fighter',
    aliases: ['arena', 'general', 'other', ''],
    startup: 11,
    active: 5,
    recovery: 17,
    note: 'Neutral defaults when the game is unknown.',
  },
];

export function getPreset(id: SandboxPresetId): SandboxPreset {
  return SANDBOX_PRESETS.find((preset) => preset.id === id) ?? SANDBOX_PRESETS[2];
}

export function presetForGame(game?: string): SandboxPresetId {
  const text = (game ?? '').toLowerCase();
  for (const preset of SANDBOX_PRESETS) {
    if (preset.aliases.some((alias) => alias && text.includes(alias))) return preset.id;
  }
  return 'arena';
}

export interface KitMoveInput {
  id: string;
  name: string;
  description: string;
  purpose?: string;
}

export interface FrameEstimate {
  moveId: string;
  name: string;
  startup: number;
  active: number;
  recovery: number;
  total: number;
  /** `text` means the move stated numbers; `preset` means it was estimated. */
  basis: 'text' | 'preset';
  note: string;
}

export type CounterVerdict = 'holds' | 'even' | 'fails';

export interface CounterplayLine {
  answer: string;
  verdict: CounterVerdict;
  detail: string;
}

export interface SandboxReport {
  presetId: SandboxPresetId;
  presetName: string;
  frames: FrameEstimate[];
  totalFrames: number;
  counterplay: CounterplayLine[];
  notes: string[];
  warnings: string[];
  assumptions: string[];
}

function frames(value: number): number {
  return Math.max(1, Math.round(value));
}

function stated(text: string, labels: string): number | null {
  // Written moves use both orders: "startup 12 frames" and "12 frame startup".
  const framePatterns = [
    new RegExp(`(?:${labels})[^,.;\\n]{0,12}?(\\d{1,3})\\s*(?:f|fr|frames?)\\b`, 'i'),
    new RegExp(`(\\d{1,3})\\s*(?:f|fr|frames?)?\\s*(?:of\\s+)?(?:${labels})\\b`, 'i'),
  ];
  for (const pattern of framePatterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const secondPatterns = [
    new RegExp(`(?:${labels})[^,.;\\n]{0,12}?(\\d+(?:\\.\\d+)?)\\s*(?:s|sec|secs|seconds?)\\b`, 'i'),
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:s|sec|secs|seconds?)\\s*(?:of\\s+)?(?:${labels})\\b`, 'i'),
  ];
  for (const pattern of secondPatterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed * 60);
  }
  return null;
}

function roleBase(move: KitMoveInput, preset: SandboxPreset): { startup: number; active: number; recovery: number } {
  const role = `${move.purpose ?? ''} ${move.name}`.toLowerCase();
  if (/counter|parry|block|defensive/.test(role)) {
    return { startup: preset.startup - 4, active: 3, recovery: preset.recovery + 4 };
  }
  if (/finisher|heavy|ultimate|super/.test(role)) {
    return { startup: preset.startup + 7, active: preset.active + 3, recovery: preset.recovery + 9 };
  }
  if (/starter|approach|gap/.test(role)) {
    return { startup: preset.startup - 2, active: preset.active, recovery: preset.recovery - 3 };
  }
  if (/extender|combo|mixup/.test(role)) {
    return { startup: preset.startup - 3, active: preset.active, recovery: preset.recovery - 6 };
  }
  if (/zoning|projectile|ranged|poke/.test(role)) {
    return { startup: preset.startup + 2, active: preset.active + 1, recovery: preset.recovery };
  }
  return { startup: preset.startup, active: preset.active, recovery: preset.recovery };
}

function estimateFrame(move: KitMoveInput, preset: SandboxPreset): FrameEstimate {
  const text = `${move.description} ${move.purpose ?? ''}`;
  const base = roleBase(move, preset);
  const startup = stated(text, 'start-?up|wind-?up|startup|telegraph') ?? frames(base.startup);
  const active = stated(text, 'active|hitbox|contact') ?? frames(base.active);
  const recovery = stated(text, 'recovery|end ?lag|after ?lag|recover') ?? frames(base.recovery);
  const hasStated =
    stated(text, 'start-?up|wind-?up|startup|telegraph') !== null ||
    stated(text, 'active|hitbox|contact') !== null ||
    stated(text, 'recovery|end ?lag|after ?lag|recover') !== null;
  return {
    moveId: move.id,
    name: move.name,
    startup: frames(startup),
    active: frames(active),
    recovery: frames(recovery),
    total: frames(startup + active + recovery),
    basis: hasStated ? 'text' : 'preset',
    note: hasStated
      ? 'Numbers taken from the move text where it stated them.'
      : 'Estimated from the move role and the game preset.',
  };
}

function counterplay(moves: KitMoveInput[], report: { totalFrames: number; frames: FrameEstimate[] }): CounterplayLine[] {
  const all = moves.map((move) => `${move.name} ${move.description} ${move.purpose ?? ''}`).join(' ').toLowerCase();
  const averageStartup =
    report.frames.reduce((sum, frame) => sum + frame.startup, 0) / Math.max(1, report.frames.length);
  const wide = /wide|sweep|360|all around|tracking|track|magnetic|pull/.test(all);
  const mixup = /unblockable|guard break|guard-break|overhead|low|throw|grab/.test(all);
  const feint = /feint|cancel|armou?r|armored|super armou?r/.test(all);
  const approach = /dash|teleport|blink|rush|approach|close the distance|gap clos/.test(all);
  const zoning = /projectile|ranged|beam|wave|shoot|poke|zoning/.test(all);
  const defensive = /counter|parry|block|barrier|shield|dodge/.test(all);

  const sidestep: CounterplayLine = wide
    ? {
        answer: 'Sidestep',
        verdict: 'holds',
        detail: 'At least one move covers a wide arc or tracks, so a single sidestep is not a full escape.',
      }
    : {
        answer: 'Sidestep',
        verdict: averageStartup > 12 ? 'holds' : 'fails',
        detail:
          averageStartup > 12
            ? `Average start-up is about ${Math.round(averageStartup)} frames, so a read is possible but a reactive sidestep is tight.`
            : `Average start-up is about ${Math.round(averageStartup)} frames and nothing tracks, so sidestepping the opener is a real answer.`,
      };

  const block: CounterplayLine = mixup
    ? {
        answer: 'Block',
        verdict: 'holds',
        detail: 'The kit includes an overhead, low, throw or guard break, so holding block is not enough.',
      }
    : {
        answer: 'Block',
        verdict: defensive ? 'even' : 'fails',
        detail: defensive
          ? 'Blocking stops the damage, but the kit can answer a block with a defensive or punishing option.'
          : 'Nothing in the kit beats a patient block. Add a guard break, throw or chip option if that matters.',
      };

  const counter: CounterplayLine = feint && averageStartup <= 12
    ? {
        answer: 'Counter / parry',
        verdict: 'holds',
        detail: 'Fast start-up and a feint or armour option make a blind counter risky.',
      }
    : {
        answer: 'Counter / parry',
        verdict: averageStartup <= 10 ? 'even' : 'fails',
        detail:
          averageStartup <= 10
            ? 'Fast start-up helps, but a move with a clear telegraph can still be parried on read.'
            : 'Slow, readable start-up gives a counter or parry a clear window.',
      };

  const ranged: CounterplayLine = approach || zoning
    ? {
        answer: 'Ranged poke',
        verdict: 'holds',
        detail: approach
          ? 'An approach or gap-closer answers zoning, so running away is not a free win.'
          : 'The kit has its own ranged option and can trade at distance.',
      }
    : {
        answer: 'Ranged poke',
        verdict: 'fails',
        detail: 'No approach, dash or ranged answer: a patient zoner can keep the kit out.',
      };

  return [sidestep, block, counter, ranged];
}

function buildNotes(moves: KitMoveInput[], report: { frames: FrameEstimate[]; totalFrames: number }): string[] {
  const notes: string[] = [];
  if (moves.length === 0) return ['No saved moves yet. Save a kit, then run the sandbox again.'];
  const longest = report.frames.reduce((worst, frame) => (frame.total > worst.total ? frame : worst), report.frames[0]);
  notes.push(
    `Full kit commitment is about ${report.totalFrames} frames if every move is used once; the longest single move is ${longest.name} at ${longest.total}.`,
  );
  const roles = new Set(
    moves
      .map((move) => (move.purpose ?? '').trim().toLowerCase())
      .filter(Boolean)
      .map((purpose) => purpose.split(/\s+/)[0]),
  );
  notes.push(
    roles.size >= 3
      ? `Roles covered: ${Array.from(roles).join(', ')}.`
      : 'Fewer than three distinct roles are stated, so the kit may be several versions of one idea.',
  );
  const unstated = moves.filter((move) => !/\d/.test(move.description)).length;
  if (unstated > 0) {
    notes.push(`${unstated} move${unstated === 1 ? '' : 's'} give no timing numbers, so their windows are estimated.`);
  }
  return notes;
}

export function runSandbox(moves: KitMoveInput[], presetId: SandboxPresetId): SandboxReport {
  const preset = getPreset(presetId);
  const frames = moves.map((move) => estimateFrame(move, preset));
  const totalFrames = frames.reduce((sum, frame) => sum + frame.total, 0);
  const warnings: string[] = [];
  if (frames.length === 0) warnings.push('Save at least one move before running the sandbox.');
  if (frames.length > 6) warnings.push('More than six moves: most games expect a tighter kit, so check the move count.');
  if (frames.some((frame) => frame.basis === 'preset')) {
    warnings.push('Some windows are estimated from roles, not stated in the text. Treat them as a design aid.');
  }
  if (frames.some((frame) => frame.startup <= 4)) {
    warnings.push('A start-up of four frames or less is very hard to react to; confirm the game allows it.');
  }

  return {
    presetId: preset.id,
    presetName: preset.name,
    frames,
    totalFrames,
    counterplay: counterplay(moves, { totalFrames, frames }),
    notes: buildNotes(moves, { frames, totalFrames }),
    warnings,
    assumptions: [
      `Estimates use the ${preset.name} preset: ${preset.note}`,
      'Windows are derived from the move text and roles, not measured in the game.',
    ],
  };
}

export interface ScoreAxis {
  id: string;
  label: string;
  score: number;
  detail: string;
}

/** A transparent, local read of the kit's shape. Not a balance verdict. */
export function scoreKit(moves: KitMoveInput[], report: SandboxReport): ScoreAxis[] {
  if (moves.length === 0) return [];
  const text = moves.map((move) => `${move.name} ${move.description} ${move.purpose ?? ''}`).join(' ').toLowerCase();
  const avgStartup = report.frames.reduce((sum, frame) => sum + frame.startup, 0) / report.frames.length;
  const avgRecovery = report.frames.reduce((sum, frame) => sum + frame.recovery, 0) / report.frames.length;
  const roles = new Set(
    moves.map((move) => (move.purpose ?? '').trim().toLowerCase()).filter(Boolean),
  );

  const powerHits = (text.match(/launch|knockdown|slam|heavy|ultimate|finisher|crumple/g) ?? []).length;
  const controlHits = (text.match(/pull|stun|slow|zone|projectile|ranged|trap|barrier/g) ?? []).length;
  const options = (text.match(/feint|mixup|overhead|low|throw|grab|cancel/g) ?? []).length;

  return [
    {
      id: 'power',
      label: 'Power',
      score: Math.min(95, 35 + powerHits * 8),
      detail: `${powerHits} heavy or finishing idea${powerHits === 1 ? '' : 's'} in the wording.`,
    },
    {
      id: 'speed',
      label: 'Speed',
      score: Math.max(20, Math.min(95, Math.round(110 - avgStartup * 4))),
      detail: `Average estimated start-up is ${Math.round(avgStartup)} frames.`,
    },
    {
      id: 'control',
      label: 'Control',
      score: Math.min(95, 30 + controlHits * 8),
      detail: `${controlHits} stun, pull, zoning or trap idea${controlHits === 1 ? '' : 's'}.`,
    },
    {
      id: 'commitment',
      label: 'Commitment',
      score: Math.max(15, Math.min(95, Math.round(avgRecovery * 3))),
      detail: `Average estimated recovery is ${Math.round(avgRecovery)} frames; higher means riskier.`,
    },
    {
      id: 'coverage',
      label: 'Coverage',
      score: Math.min(95, 25 + roles.size * 14 + options * 3),
      detail: `${roles.size} stated role${roles.size === 1 ? '' : 's'} and ${options} mix-up option${options === 1 ? '' : 's'}.`,
    },
  ];
}

function csvCell(value: string): string {
  const text = value.replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function frameTableCsv(report: SandboxReport): string {
  const header = ['Move', 'Startup (est)', 'Active (est)', 'Recovery (est)', 'Total (est)', 'Basis'];
  const rows = report.frames.map((frame) =>
    [frame.name, frame.startup, frame.active, frame.recovery, frame.total, frame.basis]
      .map((value) => csvCell(String(value)))
      .join(','),
  );
  return `\uFEFF${[header.join(','), ...rows].join('\r\n')}\r\n`;
}

export function frameTableMarkdown(report: SandboxReport): string {
  const lines = [
    `# Sandbox estimates — ${report.presetName}`,
    '',
    '_Estimated from the written moves and a game preset. Not measured frame data._',
    '',
    '| Move | Startup | Active | Recovery | Total | Basis |',
    '| --- | --- | --- | --- | --- | --- |',
    ...report.frames.map(
      (frame) =>
        `| ${frame.name} | ${frame.startup} | ${frame.active} | ${frame.recovery} | ${frame.total} | ${frame.basis} |`,
    ),
    '',
    '## Counterplay',
    '',
    ...report.counterplay.map((line) => `- **${line.answer}** — ${line.verdict}: ${line.detail}`),
    '',
    '## Notes',
    '',
    ...report.notes.map((note) => `- ${note}`),
    '',
  ];
  return lines.join('\n');
}
