import { Crown, Image as ImageIcon, Lightbulb, Scale, Swords, Wrench } from 'lucide-react';
import { apiBase, isBrowserBuild } from '../lib/apiBase';
import { useApp } from '../store/useApp';
import { WelcomeMark } from './Logo';

const STARTERS: {
  title: string;
  body: string;
  icon: typeof Swords;
  prompt: string;
  image?: boolean;
}[] = [
  {
    title: 'Design a 4-move JJS set',
    body: 'Exactly four base moves — nothing extra.',
    icon: Swords,
    prompt:
      'Make a Jujutsu Shenanigans character with exactly four base moves. No ultimate, no special, no passive. Theme: ',
  },
  {
    title: 'Design a boss character',
    body: 'Readable telegraphs, punishing patterns.',
    icon: Crown,
    prompt:
      'Design a boss character for The Strongest Battlegrounds. Five moves, clear telegraphs, and a phase-two ultimate. Theme: ',
  },
  {
    title: 'Improve an existing move',
    body: 'Turn a rough idea into a buildable move.',
    icon: Wrench,
    prompt:
      "Here is a move I made. Tell me what is weak about it, then give me a stronger version that is still easy to build:\n\n",
  },
  {
    title: 'Create concept art',
    body: 'One deliberate character illustration.',
    icon: ImageIcon,
    prompt: '',
    image: true,
  },
  {
    title: 'Balanced ultimate kit',
    body: 'Four base moves and one real ultimate.',
    icon: Scale,
    prompt:
      'Make a balanced moveset with four base moves and one ultimate for a mobile-style battleground game. Theme: ',
  },
  {
    title: 'Design a rival duo',
    body: 'Two kits that answer each other.',
    icon: Swords,
    prompt:
      'Design two rival characters for The Strongest Battlegrounds. Give each exactly three moves, then explain in one line how each kit answers the other. Theme: ',
  },
  {
    title: 'Make a kit buildable',
    body: 'Strip a concept down to animations and hitboxes.',
    icon: Wrench,
    prompt:
      'Here is a kit I like but cannot build yet. Rewrite it using only animations, hitboxes, sounds and basic effects, keeping the same fantasy and move count:\n\n',
  },
  {
    title: 'Boss and counter-kit',
    body: 'A readable boss plus the tools to beat it.',
    icon: Crown,
    prompt:
      'Design a boss with four telegraphed moves and the three-tool counter-kit a player would need to beat it. Keep both buildable in a Roblox combat game. Theme: ',
  },
];

export function Welcome() {
  const setDraft = useApp((state) => state.setDraft);
  const openImageBrief = useApp((state) => state.openImageBrief);
  const openIdeas = useApp((state) => state.openIdeas);
  const provider = useApp((state) => state.provider);
  const project = useApp((state) => {
    const conversation = state.activeId ? state.conversations[state.activeId] : null;
    return conversation?.projectId ? state.projects[conversation.projectId] : null;
  });

  const focusComposer = () => {
    document.getElementById('movaryn-composer')?.focus();
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-230px)] w-full max-w-[700px] flex-col justify-center py-8">
      <div className="flex items-start gap-4">
        <WelcomeMark />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
            Better ideas. Better movesets.
          </p>
          <h1 className="mt-2 text-[27px] font-semibold leading-tight tracking-tight text-ink sm:text-[31px]">
            What are we creating?
          </h1>
          <p className="mt-2 max-w-[52ch] text-[14px] leading-relaxed text-ink-muted">
            Describe a character, fighting style, weapon, or rough idea. Movaryn will work inside your
            constraints — exact move counts, naming rules, build difficulty — and keep the kit original
            to the character.
          </p>
        </div>
      </div>

      <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
        {STARTERS.map((starter) => {
          const Icon = starter.icon;
          return (
            <button
              key={starter.title}
              type="button"
              onClick={() => {
                if (starter.image) {
                  openImageBrief({
                    spec: {
                      subject: project?.name ?? '',
                      details: project?.description ?? '',
                      framing: 'full-body',
                      aspect: '3:4',
                    },
                  });
                  return;
                }
                setDraft(starter.prompt);
                requestAnimationFrame(focusComposer);
              }}
              className="group flex items-start gap-3 rounded-xl border border-line bg-panel-2 p-3.5 text-left transition-colors hover:border-line-strong hover:bg-surface"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon size={15} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-ink">{starter.title}</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-muted">
                  {starter.body}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={openIdeas}
        className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-dashed border-line bg-panel px-3.5 py-3 text-left transition-colors hover:border-line-strong hover:bg-panel-2"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Lightbulb size={14} />
          </span>
          <span className="min-w-0">
            <span className="block text-[12.5px] font-medium text-ink">Idea library</span>
            <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-muted">
              12 sparks, 8 constraint packs and 10 art presets, ready to drop into a prompt.
            </span>
          </span>
        </span>
        <span className="shrink-0 text-[12px] text-accent">Browse</span>
      </button>

      {!provider ? (
        <div className="mt-6 rounded-xl border border-warn/30 bg-panel-2 px-3.5 py-3 text-[12px] leading-relaxed text-ink-muted">
          {isBrowserBuild && !apiBase ? (
            <>
              <span className="font-medium text-ink">No API connected yet.</span> Paste the URL of a
              Movaryn API you run into the bar above, then press Connect.
            </>
          ) : (
            <>
              <span className="font-medium text-ink">The local API is offline.</span> Start it with{' '}
              <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px]">npm run dev</code>{' '}
              and this page will connect automatically.
            </>
          )}
        </div>
      ) : !provider.chat.configured ? (
        <div className="mt-6 rounded-xl border border-warn/30 bg-panel-2 px-3.5 py-3 text-[12px] leading-relaxed text-ink-muted">
          <span className="font-medium text-ink">Add a provider key to start.</span> Movaryn needs an
          OpenAI-compatible chat model. Add{' '}
          <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px]">AI_API_KEY</code> to{' '}
          <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px]">.env</code>, restart the
          API, then recheck in Settings.
        </div>
      ) : null}

      <p className="mt-6 text-[11px] leading-relaxed text-ink-faint">
        Chats, projects and images are stored on this device. Only your messages go to the provider you
        configure.
      </p>
    </div>
  );
}
