import type { AspectRatio, Framing, ImagePromptSpec } from '../../shared/types';

const EPITHETS = [
  'a one-armed',
  'a masked',
  'a softly spoken',
  'a rain-soaked',
  'a tattooed',
  'a gaunt',
  'a broad-shouldered',
  'a hollow-eyed',
  'a scarred',
  'a wiry',
] as const;

const ROLES = [
  'bell-keeper',
  'grave-warden',
  'lantern-smith',
  'ash-cartographer',
  'storm-diver',
  'tea-house duelist',
  'ropewalker',
  'salt-priest',
  'glassblower',
  'drum-marshal',
  'ink-scribe',
  'thorn-gardener',
  'tide-caller',
  'coin-juggler',
  'moth-tamer',
  'brick-mason',
] as const;

const OUTFITS = [
  'in an oxidized bronze haori',
  'in layered mourning white',
  'wrapped in oiled canvas',
  'in a stained apothecary coat',
  'in lacquered red armour plates',
  'in a patched festival cloak',
  'in a sleeveless prison smock',
  'in a rain-heavy straw mantle',
  'in a high-collared scholar robe',
] as const;

const WEAPONS = [
  'a chipped war fan',
  'a coiled chain scythe',
  'twin sewing needles',
  'a bronze censer on a chain',
  'a reed blowpipe',
  'a folding spear',
  'a heavy iron umbrella',
  'a barbed fishing hook',
  'a pair of tuning forks',
  'a cracked hand mirror',
  'a rusted bell hammer',
  'a stiff calligraphy brush',
] as const;

const DETAILS = [
  'silver-threaded scars across one cheek',
  'a missing ear replaced with brass',
  'hair shaved to a single braid',
  'ink-stained hands and cracked knuckles',
  'a porcelain mask cracked down the middle',
  'a burn scar shaped like a river delta',
  'soot along the jaw and freckles across the nose',
  'a shaved head and a thorn tattoo at the temple',
  'a crooked nose and one milky eye',
] as const;

const POSES = [
  'weight on the back foot, weapon held low',
  'mid-step with the weapon raised',
  'shoulders loose, one hand open',
  'braced against a hard wind',
  'crouched with the weapon trailing',
  'standing tall, weapon across the shoulders',
] as const;

const SETTINGS = [
  'a fogged stone courtyard',
  'a rain-slick alley at night',
  'a wind-scoured cliff edge',
  'a lantern-lit market lane',
  'a burnt shrine interior',
  'a shallow tidal flat',
  'a paper-strewn archive',
  'a crumbling bell tower',
] as const;

const LIGHTING = [
  'cold moonlight from above',
  'warm lantern light from below',
  'flat overcast light',
  'harsh noon sun and long shadows',
  'red dusk light',
  'moonlight filtered through rain',
] as const;

const STYLES = [
  'clean game character concept art',
  'ink-heavy manga concept art',
  'painterly dark fantasy illustration',
  'flat anime production art',
  'gritty comic inks with limited colour',
  'soft cel-shaded concept art',
] as const;

const PALETTES = [
  'cold greys with one red accent',
  'oxidized copper and charcoal',
  'ash white, soot black, a single gold thread',
  'deep indigo and bone',
  'rust, moss and faded cream',
  'petrol blue and ember orange',
] as const;

function sample<T>(items: readonly T[], count: number): T[] {
  const pool = [...items];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, count);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Rolls a complete image brief. Every field is filled from a fixed bank, so the
 * result is a real prompt the user can read, edit and regenerate — nothing is
 * invented at request time by a model.
 */
export function randomImageSpec(
  options: { aspect?: AspectRatio; style?: string; framing?: Framing } = {},
): ImagePromptSpec {
  const [epithet, role, outfit, weapon, detail, pose, setting, lighting, palette, style] = [
    ...sample(EPITHETS, 1),
    ...sample(ROLES, 1),
    ...sample(OUTFITS, 1),
    ...sample(WEAPONS, 1),
    ...sample(DETAILS, 1),
    ...sample(POSES, 1),
    ...sample(SETTINGS, 1),
    ...sample(LIGHTING, 1),
    ...sample(PALETTES, 1),
    ...sample(STYLES, 1),
  ];

  return {
    subject: `${capitalize(epithet)} ${role} ${outfit}, carrying ${weapon}`,
    details: `${capitalize(detail)}; ${palette}.`,
    outfit: '',
    pose,
    framing: options.framing ?? 'full-body',
    angle: 'eye-level three-quarter view',
    setting,
    lighting,
    style: options.style?.trim() || style,
    palette,
    avoid: '',
    aspect: options.aspect ?? '3:4',
  };
}
