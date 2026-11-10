import { useEffect, useMemo, useState } from 'react';
import { Dices, Image as ImageIcon, Lightbulb, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { ART_PRESETS, CONSTRAINT_PACKS, MOVE_IDEAS, randomMoveIdea } from '../../shared/promptIdeas';
import { useApp } from '../store/useApp';
import { Modal } from './ui/Modal';
import { cx } from '../lib/utils';

type LibraryTab = 'moves' | 'constraints' | 'art';

const TABS: { id: LibraryTab; label: string; icon: typeof Sparkles }[] = [
  { id: 'moves', label: 'Moveset sparks', icon: Sparkles },
  { id: 'constraints', label: 'Constraints', icon: ShieldCheck },
  { id: 'art', label: 'Art presets', icon: ImageIcon },
];

export function IdeaLibraryDialog() {
  const open = useApp((state) => state.ui.ideasOpen);
  const close = useApp((state) => state.closeIdeas);
  const setDraft = useApp((state) => state.setDraft);
  const draft = useApp((state) => state.ui.draft);
  const openImageBrief = useApp((state) => state.openImageBrief);
  const settings = useApp((state) => state.settings);
  const project = useApp((state) => {
    const conversation = state.activeId ? state.conversations[state.activeId] : null;
    return conversation?.projectId ? state.projects[conversation.projectId] : null;
  });

  const [tab, setTab] = useState<LibraryTab>('moves');
  const [query, setQuery] = useState('');
  const [lastMoveId, setLastMoveId] = useState<string | undefined>(undefined);

  // Reopening the library should start from a clean search and the first tab.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setTab('moves');
  }, [open]);

  const search = query.trim().toLowerCase();

  const moves = useMemo(
    () =>
      MOVE_IDEAS.filter((idea) =>
        `${idea.title} ${idea.archetype} ${idea.body} ${idea.tags.join(' ')}`
          .toLowerCase()
          .includes(search),
      ),
    [search],
  );
  const constraints = useMemo(
    () =>
      CONSTRAINT_PACKS.filter((pack) =>
        `${pack.title} ${pack.body}`.toLowerCase().includes(search),
      ),
    [search],
  );
  const presets = useMemo(
    () => ART_PRESETS.filter((preset) => `${preset.title} ${preset.body}`.toLowerCase().includes(search)),
    [search],
  );

  const focusComposer = () => {
    window.requestAnimationFrame(() => document.getElementById('movaryn-composer')?.focus());
  };

  const useMove = (prompt: string, id: string) => {
    setDraft(prompt);
    setLastMoveId(id);
    close();
    focusComposer();
  };

  const addConstraint = (text: string) => {
    const base = draft.trimEnd();
    setDraft(base ? `${base}\n\n${text}` : text);
    close();
    focusComposer();
  };

  const usePreset = (preset: (typeof ART_PRESETS)[number]) => {
    openImageBrief({
      spec: {
        subject: project?.name ? `${project.name}${project.theme ? ` — ${project.theme}` : ''}` : '',
        details: project?.description ?? '',
        framing: 'full-body',
        aspect: settings.aspect,
        style: preset.style,
        palette: preset.palette,
        lighting: preset.lighting,
        ...(preset.angle ? { angle: preset.angle } : {}),
        ...(preset.setting ? { setting: preset.setting } : {}),
      },
    });
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Idea library"
      description="Sparks for a moveset, hard constraints to paste, or a finished art direction. Everything here is a starting point — the brief still wins."
      width="max-w-3xl"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-[11px] text-ink-faint">
            {tab === 'moves'
              ? `${moves.length} ${moves.length === 1 ? 'spark' : 'sparks'}`
              : tab === 'constraints'
                ? `${constraints.length} constraint pack${constraints.length === 1 ? '' : 's'}`
                : `${presets.length} art preset${presets.length === 1 ? '' : 's'}`}
          </span>
          <div className="flex gap-2">
            {tab === 'moves' ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const idea = randomMoveIdea(lastMoveId);
                  useMove(idea.prompt, idea.id);
                }}
              >
                <Dices size={15} />
                Surprise me
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={close}>
              Close
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div
          className="flex gap-1 rounded-xl border border-line bg-panel p-1"
          role="tablist"
          aria-label="Idea library categories"
        >
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={cx(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] transition-colors',
                  tab === item.id ? 'bg-surface text-ink' : 'text-ink-muted hover:text-ink',
                )}
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search archetypes, constraints or styles"
            aria-label="Search the idea library"
            className="field h-9 pl-8"
          />
        </div>

        {tab === 'moves' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {moves.map((idea) => (
              <article
                key={idea.id}
                className="flex flex-col gap-2 rounded-xl border border-line bg-panel-2 p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[13.5px] font-medium text-ink">{idea.title}</h3>
                    <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                      {idea.archetype}
                    </p>
                  </div>
                </div>
                <p className="text-[12px] leading-relaxed text-ink-muted">{idea.body}</p>
                <div className="mt-auto flex flex-wrap items-center gap-1">
                  {idea.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="chip">
                      {tag}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary mt-1 h-8 text-[12px]"
                  onClick={() => useMove(idea.prompt, idea.id)}
                >
                  <Lightbulb size={13} />
                  Use this spark
                </button>
              </article>
            ))}
            {moves.length === 0 ? <p className="text-[12px] text-ink-muted">No sparks match that search.</p> : null}
          </div>
        ) : null}

        {tab === 'constraints' ? (
          <div className="flex flex-col gap-2">
            {constraints.map((pack) => (
              <article
                key={pack.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel-2 px-3.5 py-3"
              >
                <div className="min-w-0">
                  <h3 className="text-[13px] font-medium text-ink">{pack.title}</h3>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">{pack.body}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary h-8 shrink-0 text-[12px]"
                  onClick={() => addConstraint(pack.text)}
                >
                  Add to prompt
                </button>
              </article>
            ))}
            {constraints.length === 0 ? (
              <p className="text-[12px] text-ink-muted">No constraint packs match that search.</p>
            ) : null}
          </div>
        ) : null}

        {tab === 'art' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {presets.map((preset) => (
              <article
                key={preset.id}
                className="flex flex-col gap-2 rounded-xl border border-line bg-panel-2 p-3.5"
              >
                <h3 className="text-[13.5px] font-medium text-ink">{preset.title}</h3>
                <p className="text-[12px] leading-relaxed text-ink-muted">{preset.body}</p>
                <p className="text-[11px] leading-relaxed text-ink-faint">
                  {preset.palette} · {preset.lighting}
                </p>
                <button
                  type="button"
                  className="btn btn-secondary mt-auto h-8 text-[12px]"
                  onClick={() => usePreset(preset)}
                >
                  <ImageIcon size={13} />
                  Use in art brief
                </button>
              </article>
            ))}
            {presets.length === 0 ? (
              <p className="text-[12px] text-ink-muted">No presets match that search.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
