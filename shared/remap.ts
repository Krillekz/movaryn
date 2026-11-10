/**
 * Cross-game kit remapping.
 *
 * This is a transparent format conversion: ranges, cooldown numbers and move
 * counts are rewritten for the target game's conventions and every change is
 * listed. It does not invent mechanics and it does not pretend a remap is a
 * drop-in replacement.
 */

export type RulePackId = 'jjs' | 'tsb' | 'arena';

export interface RulePack {
  id: RulePackId;
  name: string;
  aliases: string[];
  minMoves: number;
  maxMoves: number;
  /** How much longer (or shorter) recoveries are, relative to 1. */
  recoveryScale: number;
  /** Preferred distance language for this game. */
  range: 'close' | 'mid' | 'long';
  note: string;
}

export const RULE_PACKS: RulePack[] = [
  {
    id: 'jjs',
    name: 'Jujutsu Shenanigans',
    aliases: ['jjs', 'jujutsu', 'shenanigans'],
    minMoves: 2,
    maxMoves: 6,
    recoveryScale: 1,
    range: 'close',
    note: 'Fast, close-range exchanges with short commitment.',
  },
  {
    id: 'tsb',
    name: 'The Strongest Battlegrounds',
    aliases: ['tsb', 'strongest', 'battlegrounds'],
    minMoves: 3,
    maxMoves: 6,
    recoveryScale: 1.25,
    range: 'mid',
    note: 'Longer recoveries and more mid-range pressure.',
  },
  {
    id: 'arena',
    name: 'General arena fighter',
    aliases: ['arena', 'general', 'other', ''],
    minMoves: 2,
    maxMoves: 8,
    recoveryScale: 1,
    range: 'mid',
    note: 'Neutral defaults for an unfamiliar game.',
  },
];

export function packForGame(game?: string): RulePack {
  const text = (game ?? '').toLowerCase();
  for (const pack of RULE_PACKS) {
    if (pack.aliases.some((alias) => alias && text.includes(alias))) return pack;
  }
  return RULE_PACKS[2];
}

const RANGE_LABEL: Record<RulePack['range'], string> = {
  close: 'close range',
  mid: 'mid range',
  long: 'long range',
};

const RANGE_RE = /\b(close|melee|short|mid|medium|long)(?:[-\s]range| range)?\b/i;

export interface RemapChange {
  field: 'range' | 'cooldown' | 'count' | 'format';
  from: string;
  to: string;
  reason: string;
}

export interface RemapWarning {
  message: string;
  alternative: string;
}

export interface RemappedMove {
  name: string;
  description: string;
  purpose?: string;
  changes: RemapChange[];
  warnings: RemapWarning[];
}

export interface KitMoveLike {
  name: string;
  description: string;
  purpose?: string;
}

export interface RemapResult {
  source: RulePack;
  target: RulePack;
  moves: RemappedMove[];
  notes: string[];
  warnings: RemapWarning[];
}

function rescaleCooldown(description: string, target: RulePack, source: RulePack): {
  description: string;
  changes: RemapChange[];
} {
  const changes: RemapChange[] = [];
  if (target.recoveryScale === source.recoveryScale) return { description, changes };
  const ratio = target.recoveryScale / source.recoveryScale;
  const next = description.replace(
    /(cooldown\s*:?\s*)(\d{1,2}(?:\.\d)?)\s*(s|sec|secs|seconds?)\b/gi,
    (match, prefix: string, value: string, unit: string) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) return match;
      const scaled = Math.max(0.5, Math.round(parsed * ratio * 2) / 2);
      changes.push({
        field: 'cooldown',
        from: `${parsed}s`,
        to: `${scaled}s`,
        reason: `${target.name} uses longer recoveries, so the cooldown is scaled by ${ratio.toFixed(2)}×.`,
      });
      return `${prefix}${scaled}${unit.startsWith('sec') ? 's' : unit}`;
    },
  );
  return { description: next, changes };
}

function rewriteRange(description: string, target: RulePack): { description: string; changes: RemapChange[] } {
  const match = RANGE_RE.exec(description);
  if (!match) return { description, changes: [] };
  const label = RANGE_LABEL[target.range];
  if (match[0].toLowerCase() === label) return { description, changes: [] };
  const updated = `${description.slice(0, match.index)}${label}${description.slice(match.index + match[0].length)}`;
  return {
    description: updated,
    changes: [
      {
        field: 'range',
        from: match[0],
        to: label,
        reason: `${target.name} is built around ${label} pressure.`,
      },
    ],
  };
}

function mechanicWarnings(description: string, target: RulePack): RemapWarning[] {
  const warnings: RemapWarning[] = [];
  if (target.id !== 'jjs' && /domain expansion|domain clash|sure-?hit domain/i.test(description)) {
    warnings.push({
      message: 'A domain expansion has no direct equivalent outside Jujutsu Shenanigans.',
      alternative: 'Rewrite it as a large area burst or a temporary zone with a visible duration.',
    });
  }
  if (/custom mesh|particle|script|animation id|custom rig/i.test(description)) {
    warnings.push({
      message: 'This move depends on assets or scripting that may not exist in the target game.',
      alternative: 'Build it from existing animations, hitboxes, sounds and basic effects instead.',
    });
  }
  if (/skill builder/i.test(description)) {
    warnings.push({
      message: 'A named Skill Builder feature cannot be assumed in another game.',
      alternative: 'Describe the same behaviour with a hitbox, a cooldown and a basic effect.',
    });
  }
  return warnings;
}

export function remapKit(moves: KitMoveLike[], targetGame: string, sourceGame?: string): RemapResult {
  const source = packForGame(sourceGame);
  const target = packForGame(targetGame);
  const remapped: RemappedMove[] = moves.map((move, index) => {
    const scaled = rescaleCooldown(move.description, target, source);
    const ranged = rewriteRange(scaled.description, target);
    const changes = [...scaled.changes, ...ranged.changes];
    const warnings = mechanicWarnings(move.description, target);
    if (index + 1 > target.maxMoves) {
      warnings.push({
        message: `Move ${index + 1} is beyond the ${target.maxMoves}-move shape ${target.name} usually expects.`,
        alternative: 'Merge it into an earlier move or keep it as a variant rather than a seventh slot.',
      });
    }
    return {
      name: move.name,
      description: ranged.description,
      purpose: move.purpose,
      changes,
      warnings,
    };
  });

  const warnings: RemapWarning[] = [];
  if (moves.length > target.maxMoves) {
    warnings.push({
      message: `This kit has ${moves.length} moves; ${target.name} is usually built around ${target.maxMoves}.`,
      alternative: 'Cut or merge the weakest move instead of shipping an oversized kit.',
    });
  }
  if (moves.length < target.minMoves) {
    warnings.push({
      message: `${target.name} expects at least ${target.minMoves} moves and this kit has ${moves.length}.`,
      alternative: 'Add one opener or one finisher so the kit has a complete gameplan.',
    });
  }

  const changed = remapped.reduce((sum, move) => sum + move.changes.length, 0);
  return {
    source,
    target,
    moves: remapped,
    warnings,
    notes: [
      `Read as ${source.name}; written for ${target.name}.`,
      changed > 0
        ? `${changed} wording change${changed === 1 ? '' : 's'} made (range and cooldown language only).`
        : 'No ranges or cooldowns needed changing; the moves are copied as written.',
      'Only the writing is converted. Mechanics, damage and animations are not invented for the target game.',
    ],
  };
}

export function remapToMarkdown(
  projectName: string,
  result: RemapResult,
  moves: RemappedMove[],
): string {
  const lines = [
    `# ${projectName || 'Untitled character'} — ${result.target.name} remap`,
    '',
    `Converted from ${result.source.name}. ${result.notes[2]}`,
    '',
  ];
  result.notes.slice(0, 2).forEach((note) => lines.push(`- ${note}`));
  lines.push('');
  moves.forEach((move, index) => {
    lines.push(`## ${index + 1}. ${move.name}${move.purpose ? ` — ${move.purpose}` : ''}`, '');
    lines.push(move.description, '');
    if (move.changes.length > 0) {
      lines.push('Changes:');
      for (const change of move.changes) {
        lines.push(`- ${change.field}: ${change.from} → ${change.to} (${change.reason})`);
      }
      lines.push('');
    }
    if (move.warnings.length > 0) {
      lines.push('Check:');
      for (const warning of move.warnings) {
        lines.push(`- ${warning.message} Alternative: ${warning.alternative}`);
      }
      lines.push('');
    }
  });
  return `${lines.join('\n').trimEnd()}\n`;
}
