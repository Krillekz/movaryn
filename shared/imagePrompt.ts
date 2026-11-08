import type { Framing, ImagePromptSpec } from './types';

const FRAMING_TEXT: Record<Framing, string> = {
  'full-body': 'Full-body framing with the whole figure visible, feet included',
  'three-quarter': 'Three-quarter framing from the knees up',
  'waist-up': 'Waist-up framing',
  bust: 'Bust framing, head and shoulders',
  action: 'Mid-action framing with the whole figure visible in motion',
};

const DEFAULT_STYLE = 'clean game character concept art';

/**
 * Turns a casual brief into a provider-ready image prompt.
 * Deliberately avoids inventing scenery, effects or props the user did not ask for.
 */
export function buildImagePrompt(spec: ImagePromptSpec): string {
  const subject = spec.subject.trim();
  const sentences: string[] = [];

  const framing = FRAMING_TEXT[spec.framing] ?? FRAMING_TEXT['full-body'];
  sentences.push(subject ? `Character concept illustration of ${clean(subject)}.` : 'Character concept illustration.');

  if (spec.details?.trim()) {
    sentences.push(`Character details: ${clean(spec.details)}.`);
  }
  if (spec.outfit?.trim()) {
    sentences.push(`Outfit: ${clean(spec.outfit)}.`);
  }

  const pose = spec.pose?.trim();
  const angle = spec.angle?.trim();
  const poseLine = [pose ? `Pose: ${clean(pose)}` : '', framing, angle ? `camera ${clean(angle)}` : '']
    .filter(Boolean)
    .join('. ');
  sentences.push(`${poseLine}.`);

  if (spec.setting?.trim()) {
    sentences.push(`Setting: ${clean(spec.setting)}.`);
  } else {
    sentences.push('Background: simple uncluttered backdrop with no scenery or props.');
  }
  if (spec.lighting?.trim()) {
    sentences.push(`Lighting: ${clean(spec.lighting)}.`);
  }

  const style = spec.style?.trim() || DEFAULT_STYLE;
  const palette = spec.palette?.trim();
  sentences.push(
    `Style: ${clean(style)}${palette ? `, colour palette of ${clean(palette)}` : ''}.`,
  );

  sentences.push(
    'Composition: one subject, readable silhouette, deliberate negative space, consistent anatomy and clothing, the weapon held correctly.',
  );

  const avoid = [
    'text',
    'logos',
    'watermarks',
    'signatures',
    'UI overlays',
    'extra limbs',
    'extra fingers',
    'malformed hands',
    'duplicated weapons',
    'inconsistent costume details',
    'busy background clutter',
  ];
  if (spec.avoid?.trim()) avoid.push(clean(spec.avoid));
  sentences.push(`Avoid: ${avoid.join(', ')}.`);

  return sentences.join(' ').slice(0, 3800);
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
}

/** Short label used in the conversation for an image message. */
export function describeImageBrief(spec: ImagePromptSpec): string {
  const framing = spec.framing === 'bust' ? 'bust' : spec.framing.replace('-', ' ');
  const subject = spec.subject.trim().replace(/\s+/g, ' ');
  return `${capitalize(framing)} — ${truncate(subject, 90)}`;
}

/** The prompt that will actually be sent to the provider. */
export function resolveImagePrompt(spec: ImagePromptSpec): string {
  const override = spec.promptOverride?.trim();
  return override ? override : buildImagePrompt(spec);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}
