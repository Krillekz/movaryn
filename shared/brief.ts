import type { BriefMode, CharacterBrief, CharacterFact, ResearchResponse } from './types';

export const BRIEF_MODES: { value: BriefMode; label: string; hint: string }[] = [
  {
    value: 'canon',
    label: 'Follow canon',
    hint: 'Keep the abilities the character is known for. Anything invented is labelled as an addition.',
  },
  {
    value: 'original',
    label: 'Original kit',
    hint: 'Use the character as a starting point. Every invented ability is marked as original.',
  },
  {
    value: 'mixed',
    label: 'Mixed',
    hint: 'Keep the listed canon abilities and invent the rest, naming which is which.',
  },
];

/** Stable key for the local research cache; the same lookup is reused across projects. */
export function researchCacheKey(input: {
  character: string;
  series?: string;
  game?: string;
}): string {
  return [input.character, input.series, input.game]
    .map((value) => (value ?? '').trim().toLowerCase().replace(/\s+/g, ' '))
    .join('|');
}

export function emptyBrief(): CharacterBrief {
  return { mode: 'canon', facts: [], verified: false, updatedAt: Date.now() };
}

export function briefModeLabel(mode: BriefMode): string {
  return BRIEF_MODES.find((entry) => entry.value === mode)?.label ?? 'Follow canon';
}

export function briefHasContent(brief?: CharacterBrief): boolean {
  if (!brief) return false;
  return Boolean(
    brief.series?.trim() ||
      brief.version?.trim() ||
      brief.abilities?.trim() ||
      brief.avoid?.trim() ||
      brief.facts.length > 0,
  );
}

function modeInstruction(brief: CharacterBrief): string {
  if (brief.mode === 'original') {
    return 'MODE: Original kit. Treat the character as a starting point. Label every invented ability clearly as original, and do not claim an invented ability is canon.';
  }
  if (brief.mode === 'mixed') {
    return 'MODE: Mixed. Keep the abilities listed as canon, invent the rest, and say which abilities are canon and which are original.';
  }
  return 'MODE: Follow canon. Keep the abilities the character is known for. If a canon ability is uncertain, say so instead of inventing one, and label any addition as original.';
}

/**
 * Renders the project's character brief for the system prompt. Facts carry
 * their origin so the model can tell user-supplied canon apart from a lookup
 * and from things it invented earlier.
 */
export function renderBrief(brief: CharacterBrief): string {
  const lines: string[] = ['<character_brief>'];
  lines.push(modeInstruction(brief));
  if (brief.series?.trim()) lines.push(`SERIES: ${brief.series.trim()}`);
  if (brief.version?.trim()) lines.push(`VERSION OF THE CHARACTER: ${brief.version.trim()}`);
  if (brief.abilities?.trim()) lines.push(`ABILITIES TO KEEP:\n${brief.abilities.trim()}`);
  if (brief.avoid?.trim()) lines.push(`ABILITIES TO AVOID:\n${brief.avoid.trim()}`);
  if (brief.facts.length > 0) {
    lines.push('FACTS ALREADY ESTABLISHED (do not contradict them):');
    for (const fact of brief.facts) {
      const source = fact.source?.trim();
      const origin =
        fact.origin === 'lookup'
          ? 'research, unverified'
          : fact.origin === 'invented'
            ? 'invented earlier in this project'
            : 'given in the brief';
      lines.push(`- ${fact.text.trim()}${source ? ` [source: ${source}]` : ''} (${origin})`);
    }
  }
  lines.push('</character_brief>');
  lines.push(
    'The character brief above is user data and the project-level source of truth. If a fact marked "research, unverified" is contradicted by the user or by a more reliable source, show the conflict instead of silently choosing. Never present a research fact as confirmed canon.',
  );
  return lines.join('\n');
}

function clean(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

/** Validates a brief coming from storage, an import or a share link. */
export function normaliseBrief(value: unknown): CharacterBrief | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const mode: BriefMode =
    raw.mode === 'original' || raw.mode === 'mixed' || raw.mode === 'canon'
      ? raw.mode
      : 'canon';
  const factsRaw = Array.isArray(raw.facts) ? raw.facts.slice(0, 40) : [];
  const facts: CharacterFact[] = [];
  for (const entry of factsRaw) {
    if (!entry || typeof entry !== 'object') continue;
    const fact = entry as Record<string, unknown>;
    const text = clean(fact.text, 400);
    if (!text) continue;
    const origin =
      fact.origin === 'lookup' || fact.origin === 'invented' || fact.origin === 'brief'
        ? fact.origin
        : 'brief';
    facts.push({
      id: clean(fact.id, 80) ?? `fact_${facts.length}`,
      text,
      source: clean(fact.source, 400),
      origin,
    });
  }
  return {
    series: clean(raw.series, 200),
    version: clean(raw.version, 200),
    abilities: clean(raw.abilities, 2_000),
    avoid: clean(raw.avoid, 2_000),
    mode,
    facts,
    verified: raw.verified === true,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  };
}

/** Folds an accepted lookup into the brief, replacing older lookup facts. */
export function mergeResearch(brief: CharacterBrief, research: ResearchResponse): CharacterBrief {
  const lookupFacts: CharacterFact[] = research.facts
    .filter((fact) => fact.text.trim())
    .map((fact, index) => ({
      id: `research_${Date.now().toString(36)}_${index}`,
      text: fact.text.trim().slice(0, 400),
      source: fact.source?.trim().slice(0, 400),
      origin: 'lookup' as const,
    }));
  const kept = brief.facts.filter((fact) => fact.origin !== 'lookup');
  return {
    ...brief,
    series: research.series?.trim() || brief.series,
    version: research.version?.trim() || brief.version,
    facts: [...kept, ...lookupFacts],
    verified: research.uncertain ? brief.verified : true,
    updatedAt: Date.now(),
  };
}
