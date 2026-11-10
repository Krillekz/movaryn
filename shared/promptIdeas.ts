/**
 * Curated prompt ideas for movesets, constraints and concept art.
 * Pure data plus small helpers so both the welcome screen and dialogs share it.
 */

export interface MoveIdea {
  id: string;
  title: string;
  archetype: string;
  body: string;
  prompt: string;
  tags: string[];
}

export interface ConstraintPack {
  id: string;
  title: string;
  body: string;
  text: string;
}

export interface ArtPreset {
  id: string;
  title: string;
  body: string;
  style: string;
  palette: string;
  lighting: string;
  angle?: string;
  setting?: string;
}

export const MOVE_IDEAS: MoveIdea[] = [
  {
    id: 'clockmaker',
    title: 'Cursed clockmaker',
    archetype: 'Setup / punish',
    body: 'Places delayed strikes that detonate when the opponent attacks.',
    prompt:
      'Design a cursed clockmaker who fights with delayed strikes and clock-hand blades. The kit should reward reading the opponent, not rushing. Five moves, one of them a setup tool. Theme: ',
    tags: ['JJS', 'setup', 'punish'],
  },
  {
    id: 'storm-courier',
    title: 'Storm courier',
    archetype: 'Mobility',
    body: 'Approaches through movement tech and short burst windows.',
    prompt:
      'Design a storm courier built around fast approach, one clean mix-up and a fast recovery. Four base moves, no ultimate, no projectile. Theme: ',
    tags: ['TSB', 'mobility', 'rushdown'],
  },
  {
    id: 'rust-saint',
    title: 'Rust saint',
    archetype: 'Attrition',
    body: 'Wins long fights with chip damage, corrosion and zoning.',
    prompt:
      'Design a rust saint who controls space with corrosion and slow hazard fields. Five moves, one defensive option, easy-to-medium build. Theme: ',
    tags: ['zoner', 'attrition', 'easy build'],
  },
  {
    id: 'glass-duelist',
    title: 'Glass duelist',
    archetype: 'High risk',
    body: 'Huge damage, tiny health, one recovery that must be earned.',
    prompt:
      'Design a glass-cannon duelist with three fast strikes and one high-commitment finisher. The kit must feel risky to play but fair to fight. No passive. Theme: ',
    tags: ['duelist', 'burst', 'risk'],
  },
  {
    id: 'bell-keeper',
    title: 'Bell keeper',
    archetype: 'Area control',
    body: 'Rings the arena with sound pulses and slow shockwaves.',
    prompt:
      'Design a bell keeper whose moves use sound waves, chained bells and floor tremors. Four base moves, one ultimate, readable telegraphs. Theme: ',
    tags: ['control', 'area', 'ultimate'],
  },
  {
    id: 'ash-cartographer',
    title: 'Ash cartographer',
    archetype: 'Traps',
    body: 'Marks the floor, then collapses the marked space.',
    prompt:
      'Design an ash cartographer who marks ground, sets traps and collapses space. The traps must be visible and dodgeable. Five moves, no counter. Theme: ',
    tags: ['traps', 'JJS', 'space'],
  },
  {
    id: 'tide-boxer',
    title: 'Tide boxer',
    archetype: 'Close range',
    body: 'Short hooks, wave steps and a grab that pulls back in.',
    prompt:
      'Design a tide boxer with close-range hooks, a wave step and a pull-in grab. Exactly four moves, one-word names, easy build. Theme: ',
    tags: ['boxer', 'grab', 'one-word'],
  },
  {
    id: 'lantern-warden',
    title: 'Lantern warden',
    archetype: 'Defensive',
    body: 'Blocks lanes with light, punishes overextension.',
    prompt:
      'Design a lantern warden who places light barriers and punishes overextension. Defensive but not passive. Four base moves, one utility move. Theme: ',
    tags: ['defensive', 'utility', 'TSB'],
  },
  {
    id: 'bone-conductor',
    title: 'Bone conductor',
    archetype: 'Summoner',
    body: 'Directs bone constructs instead of summoning an army.',
    prompt:
      'Design a bone conductor who directs one bone construct at a time. Buildable with hitboxes and animations only, no scripting. Five moves. Theme: ',
    tags: ['summoner', 'buildable', 'minion'],
  },
  {
    id: 'static-monk',
    title: 'Static monk',
    archetype: 'Stun',
    body: 'Charges contact points, then discharges on the next hit.',
    prompt:
      'Design a static monk who charges contact points and discharges on the next hit. Stuns must be short and fair. Four moves, no projectile. Theme: ',
    tags: ['stun', 'combo', 'charge'],
  },
  {
    id: 'paper-assassin',
    title: 'Paper assassin',
    archetype: 'Feints',
    body: 'Leaves paper decoys and punishes wrong reads.',
    prompt:
      'Design a paper assassin built on decoys and feints. Every move should have a readable tell. Four base moves and one ultimate, medium build. Theme: ',
    tags: ['feint', 'assassin', 'mixup'],
  },
  {
    id: 'forge-widow',
    title: 'Forge widow',
    archetype: 'Grappler',
    body: 'Heavy grabs, anvil drops and slow armour.',
    prompt:
      'Design a forge widow grappler with heavy grabs, an anvil drop and slow armour. Five moves, clear start-up frames, no custom meshes. Theme: ',
    tags: ['grappler', 'heavy', 'boss'],
  },
];

export const CONSTRAINT_PACKS: ConstraintPack[] = [
  {
    id: 'easy-build',
    title: 'Easy to build',
    body: 'Animations, hitboxes, sounds and basic effects only.',
    text: 'Treat every move as easy to build: existing animations, hitboxes, sounds and basic effects only. No custom meshes, no scripting, no new systems.',
  },
  {
    id: 'no-counter',
    title: 'No counters or domains',
    body: 'Hard ban on counter moves, domain expansions and passives.',
    text: 'Hard constraints: no counter moves, no domain expansions, no passives, no M1 chain changes. Do not add them even as suggestions.',
  },
  {
    id: 'one-word',
    title: 'One-word names',
    body: 'Every move name is exactly one word.',
    text: 'Name every move with exactly one word. Plain, specific words that fit the character. No two-word names, no titles.',
  },
  {
    id: 'four-moves',
    title: 'Exactly four moves',
    body: 'Four base moves and nothing else.',
    text: 'Exactly four base moves. No ultimate, no special, no passive, no bonus move, no honourable mention. Stop after move four.',
  },
  {
    id: 'mobile-balance',
    title: 'Mobile-game balance',
    body: 'Short cooldowns, clear counterplay, no one-shot combos.',
    text: 'Balance for a mobile battleground: short cooldowns, clear counterplay, no true one-shot combos, no unavoidable stuns. State each move\'s counterplay in one line.',
  },
  {
    id: 'boss-telegraphs',
    title: 'Boss telegraphs',
    body: 'Every attack wind-up is readable before it lands.',
    text: 'Design this as a boss: every attack needs a readable wind-up and an obvious punish window. No move may hit from off-screen.',
  },
  {
    id: 'no-fx',
    title: 'No particles',
    body: 'No particle systems, no custom VFX, no screen shake.',
    text: 'Build with no particle systems, no custom VFX and no screen shake. Communicate impact through animation, sound and hit timing.',
  },
  {
    id: 'jp-names',
    title: 'Japanese-inspired names',
    body: 'Two-word names with a Japanese-inspired feel.',
    text: 'Use two-word, Japanese-inspired move names. Keep them readable in English and avoid the overused words already banned in your instructions.',
  },
];

export const ART_PRESETS: ArtPreset[] = [
  {
    id: 'ink-manga',
    title: 'Ink manga',
    body: 'High-contrast ink, screentone shadows, clean linework.',
    style: 'ink-heavy manga concept art, clean linework, screentone shadows',
    palette: 'black, bone white and one saturated accent',
    lighting: 'hard directional light with deep shadows',
    angle: 'low three-quarter view',
  },
  {
    id: 'painterly',
    title: 'Painterly key art',
    body: 'Broad brushwork and dramatic rim light.',
    style: 'painterly game key art, visible brushwork, cinematic composition',
    palette: 'muted earth tones with a warm highlight',
    lighting: 'dramatic rim light against a dark backdrop',
    angle: 'slightly low hero angle',
  },
  {
    id: 'cel',
    title: 'Cel-shaded',
    body: 'Flat colour, crisp outlines, game-ready readability.',
    style: 'cel-shaded game art, flat colour blocks, crisp outlines',
    palette: 'bold primary colours with dark outlines',
    lighting: 'clean two-tone lighting',
  },
  {
    id: 'gritty',
    title: 'Gritty realism',
    body: 'Weathered materials, film grain, grounded proportions.',
    style: 'gritty realistic character concept art, weathered materials, fine film grain',
    palette: 'desaturated steel, rust and charcoal',
    lighting: 'overcast ambient light with soft falloff',
  },
  {
    id: 'retro-anime',
    title: 'Retro anime',
    body: '90s cel animation with a limited palette.',
    style: '1990s anime cel animation character sheet, hand-painted backgrounds',
    palette: 'limited pastel palette with strong shadows',
    lighting: 'flat studio lighting',
  },
  {
    id: 'dark-fantasy',
    title: 'Dark fantasy',
    body: 'Carved armour, candlelight, heavy atmosphere.',
    style: 'dark fantasy concept art, carved armour, ornate but practical',
    palette: 'oxblood, tarnished gold and near-black',
    lighting: 'candlelit pools of light with heavy falloff',
    setting: 'ruined stone hall with shallow depth of field',
  },
  {
    id: 'neon',
    title: 'Neon cyber',
    body: 'Wet reflections, neon accents, night city.',
    style: 'cyberpunk character concept art, wet reflective surfaces, neon accents',
    palette: 'cyan and magenta against deep navy',
    lighting: 'neon practicals with strong coloured bounce',
    setting: 'rainy rooftop at night, blurred signage',
  },
  {
    id: 'charcoal',
    title: 'Charcoal study',
    body: 'Loose gestural drawing, strong values.',
    style: 'charcoal figure study, loose gestural lines, strong value structure',
    palette: 'monochrome with a single chalk highlight',
    lighting: 'single overhead lamp',
  },
  {
    id: 'watercolour',
    title: 'Watercolour',
    body: 'Soft washes, paper texture, restrained detail.',
    style: 'watercolour character illustration, soft washes, visible paper grain',
    palette: 'pale teal, sand and faded vermilion',
    lighting: 'diffuse daylight',
  },
  {
    id: 'render',
    title: 'Stylised 3D render',
    body: 'Sculpted forms, soft studio light, game trailer look.',
    style: 'stylised 3D character render, sculpted forms, subsurface skin',
    palette: 'cool neutral greys with a saturated costume accent',
    lighting: 'soft studio key with a cool fill',
  },
];

export function randomMoveIdea(exclude?: string): MoveIdea {
  const pool = exclude ? MOVE_IDEAS.filter((idea) => idea.id !== exclude) : MOVE_IDEAS;
  return pool[Math.floor(Math.random() * pool.length)] ?? MOVE_IDEAS[0];
}

/** A review request that asks for concrete fixes without rewriting the whole kit. */
export function kitReviewPrompt(
  moves: { name: string; description: string; purpose?: string }[],
  character?: string,
): string {
  const list = moves
    .map(
      (move, index) =>
        `${index + 1}. ${move.name}${move.purpose ? ` (${move.purpose})` : ''}: ${move.description}`,
    )
    .join('\n');
  return [
    `Review this ${character ? `${character} ` : ''}kit as a builder, not a fan.`,
    '',
    list,
    '',
    'Check: does each move have a distinct job, is the sequence buildable with animations/hitboxes/sounds/basic effects, is any move unreadable or unfair, and do the names fit the character?',
    'Give the three weakest points with one concrete fix each, then a revised version of only the moves that need changing. Do not rewrite the whole kit and do not add new moves.',
  ].join('\n');
}
