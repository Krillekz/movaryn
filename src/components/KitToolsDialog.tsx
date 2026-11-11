import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  Check,
  Download,
  Gauge,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Share2,
  Shuffle,
  Trash2,
  X,
} from 'lucide-react';
import type { CharacterBrief, CharacterFact, Project } from '../../shared/types';
import { BRIEF_MODES, emptyBrief, mergeResearch, researchCacheKey } from '../../shared/brief';
import { compareKits } from '../../shared/compare';
import {
  SANDBOX_PRESETS,
  frameTableCsv,
  frameTableMarkdown,
  presetForGame,
  runSandbox,
  scoreKit,
  type SandboxPresetId,
} from '../../shared/sandbox';
import { packForGame, remapKit, remapToMarkdown, type RemapResult } from '../../shared/remap';
import { encodeSharedKit, sharedKitUrl } from '../../shared/shareKit';
import { requestResearch } from '../lib/api';
import {
  deleteProjectVersion,
  getResearchCache,
  listProjectVersions,
  putResearchCache,
  saveProjectVersion,
  type ProjectVersion,
  type ResearchCacheEntry,
} from '../lib/db';
import { useApp, type ToolsTabId } from '../store/useApp';
import { copyText, cx, downloadText, relativeTime, slugify, uid } from '../lib/utils';
import { Modal } from './ui/Modal';

const TABS: { id: ToolsTabId; label: string; icon: typeof BookOpen }[] = [
  { id: 'brief', label: 'Brief', icon: BookOpen },
  { id: 'sandbox', label: 'Sandbox', icon: Gauge },
  { id: 'remap', label: 'Remap', icon: Shuffle },
  { id: 'history', label: 'History', icon: History },
  { id: 'compare', label: 'Compare', icon: ArrowLeftRight },
];

export function KitToolsDialog() {
  const projectId = useApp((state) => state.ui.projectId);
  const project = useApp((state) => (projectId ? (state.projects[projectId] ?? null) : null));
  const open = useApp((state) => state.ui.toolsOpen);
  const close = useApp((state) => state.closeTools);
  const tab = useApp((state) => state.ui.toolsTab);
  const setTab = useApp((state) => state.setToolsTab);

  if (!open || !project) return null;

  return (
    <Modal
      open
      onClose={close}
      title="Kit tools"
      description="Research the character, run and compare the kit, remap it, and keep local versions."
      width="max-w-3xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10.5px] text-ink-faint">
            Estimates only. Nothing here is uploaded or measured in the game.
          </p>
          <button type="button" className="btn btn-ghost h-8" onClick={close}>
            Close
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Kit tools">
          {TABS.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                onClick={() => setTab(entry.id)}
                className={cx(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors',
                  tab === entry.id
                    ? 'bg-accent-soft text-accent'
                    : 'text-ink-muted hover:bg-surface hover:text-ink',
                )}
              >
                <Icon size={13} />
                {entry.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-line bg-panel px-4 py-4">
          {tab === 'brief' ? <BriefTab project={project} /> : null}
          {tab === 'sandbox' ? <SandboxTab project={project} /> : null}
          {tab === 'remap' ? <RemapTab project={project} /> : null}
          {tab === 'history' ? <HistoryTab project={project} /> : null}
          {tab === 'compare' ? <CompareTab project={project} /> : null}
        </div>
      </div>
    </Modal>
  );
}

function BriefTab({ project }: { project: Project }) {
  const updateProject = useApp((state) => state.updateProject);
  const pushToast = useApp((state) => state.pushToast);
  const provider = useApp((state) => state.provider);
  const brief = project.brief ?? emptyBrief();

  const [character, setCharacter] = useState(project.name);
  const [researching, setResearching] = useState(false);
  const [researchNote, setResearchNote] = useState<string | null>(null);
  const [cached, setCached] = useState<ResearchCacheEntry | null>(null);
  const [forceFresh, setForceFresh] = useState(false);
  const [factText, setFactText] = useState('');
  const [factSource, setFactSource] = useState('');

  const cacheKey = researchCacheKey({
    character: character.trim(),
    series: brief.series,
    game: project.game,
  });

  useEffect(() => {
    let alive = true;
    setForceFresh(false);
    const timer = window.setTimeout(() => {
      void getResearchCache(cacheKey).then((entry) => {
        if (alive) setCached(entry);
      });
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [cacheKey]);

  const updateBrief = (patch: Partial<CharacterBrief>) => {
    updateProject(project.id, { brief: { ...brief, ...patch, updatedAt: Date.now() } });
  };

  const runResearch = async () => {
    if (!character.trim()) return;
    if (!forceFresh && cached) {
      updateProject(project.id, {
        brief: mergeResearch(brief, {
          character: cached.character,
          series: cached.series,
          version: cached.version,
          facts: cached.facts,
          uncertain: false,
        }),
      });
      setResearchNote(
        `Used the cached lookup from ${relativeTime(cached.createdAt)}. Press Research again to refresh it from the provider.`,
      );
      setForceFresh(true);
      return;
    }
    setResearching(true);
    setResearchNote(null);
    try {
      const result = await requestResearch({
        character: character.trim(),
        series: brief.series,
        game: project.game,
      });
      if (result.uncertain || result.facts.length === 0) {
        setResearchNote(
          result.message ??
            'No sourced facts came back. Add the series or a short description instead.',
        );
        setForceFresh(true);
        return;
      }
      updateProject(project.id, { brief: mergeResearch(brief, result) });
      const entry: ResearchCacheEntry = {
        key: cacheKey,
        character: result.character || character.trim(),
        series: result.series ?? brief.series,
        version: result.version ?? brief.version,
        game: project.game,
        facts: result.facts,
        createdAt: Date.now(),
      };
      await putResearchCache(entry);
      setCached(entry);
      setForceFresh(false);
      setResearchNote(result.message ?? null);
      pushToast(`Added ${result.facts.length} sourced fact${result.facts.length === 1 ? '' : 's'}.`, 'success');
    } catch (error) {
      setResearchNote(error instanceof Error ? error.message : 'Research failed.');
    } finally {
      setResearching(false);
    }
  };

  const addFact = () => {
    const text = factText.trim();
    if (!text) return;
    const fact: CharacterFact = {
      id: uid('fact'),
      text,
      source: factSource.trim() || undefined,
      origin: 'brief',
    };
    updateBrief({ facts: [...brief.facts, fact] });
    setFactText('');
    setFactSource('');
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Who the character is
          </h3>
          <span
            className={cx(
              'chip h-6',
              brief.verified ? 'border-accent/40 text-accent' : 'text-ink-faint',
            )}
          >
            {brief.verified ? 'Sourced facts kept' : cached ? 'Cached lookup' : 'No lookup yet'}
          </span>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
          The brief is sent with every chat in this project, so later replies keep the same
          understanding of the character.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="brief-series">
            Series
          </label>
          <input
            id="brief-series"
            className="field"
            value={brief.series ?? ''}
            onChange={(event) => updateBrief({ series: event.target.value })}
            placeholder="Jujutsu Kaisen"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="brief-version">
            Which version
          </label>
          <input
            id="brief-version"
            className="field"
            value={brief.version ?? ''}
            onChange={(event) => updateBrief({ version: event.target.value })}
            placeholder="Shibuya arc, before the awakening"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="brief-abilities">
            Abilities to keep
          </label>
          <textarea
            id="brief-abilities"
            className="field resize-y"
            rows={2}
            value={brief.abilities ?? ''}
            onChange={(event) => updateBrief({ abilities: event.target.value })}
            placeholder="Cursed speech, a baton, no domain"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="brief-avoid">
            Abilities to avoid
          </label>
          <textarea
            id="brief-avoid"
            className="field resize-y"
            rows={2}
            value={brief.avoid ?? ''}
            onChange={(event) => updateBrief({ avoid: event.target.value })}
            placeholder="No copying other characters' techniques"
          />
        </div>
      </div>

      <div>
        <p className="field-label">Mode</p>
        <div className="mt-1 grid gap-2 sm:grid-cols-3">
          {BRIEF_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              aria-pressed={brief.mode === mode.value}
              onClick={() => updateBrief({ mode: mode.value })}
              className={cx(
                'rounded-lg border px-2.5 py-2 text-left text-[11.5px] transition-colors',
                brief.mode === mode.value
                  ? 'border-accent/60 bg-accent-soft text-ink'
                  : 'border-line bg-panel-2 text-ink-muted hover:border-line-strong',
              )}
            >
              <span className="block text-[12px] font-medium">{mode.label}</span>
              <span className="mt-0.5 block leading-relaxed text-ink-faint">{mode.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-line px-3 py-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <label className="field-label" htmlFor="research-character">
              Look up a character
            </label>
            <input
              id="research-character"
              className="field"
              value={character}
              onChange={(event) => setCharacter(event.target.value)}
              placeholder="Character name"
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost h-9 gap-1.5"
            disabled={
              researching || !character.trim() || (!cached && !provider?.chat.configured)
            }
            onClick={() => void runResearch()}
            title={
              cached && !forceFresh
                ? 'Use the lookup already saved on this device'
                : provider?.chat.configured
                  ? 'Ask the configured provider for sourced facts'
                  : 'Configure a chat provider first'
            }
          >
            {researching ? <Loader2 size={14} className="animate-spin" /> : <Sparkle />}
            {researching
              ? 'Checking series and abilities…'
              : cached && !forceFresh
                ? 'Use cached lookup'
                : forceFresh && cached
                  ? 'Refresh research'
                  : 'Research character'}
          </button>
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-ink-faint">
          Opt-in and one request at a time. Facts need a named source to be kept; without one Movaryn
          says so and leaves the brief alone. Sources come from the model, so open them before
          treating a detail as canon.
        </p>
        {cached ? (
          <p className="mt-2 text-[10.5px] leading-relaxed text-ink-faint">
            Cached on this device: {cached.facts.length} sourced fact
            {cached.facts.length === 1 ? '' : 's'} from {relativeTime(cached.createdAt)}.
          </p>
        ) : null}
        {researchNote ? (
          <p
            className={cx(
              'mt-2 rounded-md px-2 py-1.5 text-[11.5px] leading-relaxed',
              brief.verified ? 'bg-accent-soft text-ink' : 'bg-warn/10 text-warn',
            )}
          >
            {researchNote}
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Facts ({brief.facts.length})
        </h3>
        {brief.facts.length === 0 ? (
          <p className="mt-1 text-[11.5px] text-ink-faint">
            No facts yet. Research, or add one you know with its source.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {brief.facts.map((fact) => (
              <li
                key={fact.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-line bg-panel-2 px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="text-[12px] leading-relaxed text-ink">{fact.text}</p>
                  <p className="mt-0.5 text-[10px] text-ink-faint">
                    {fact.source ? `${fact.source} · ` : ''}
                    {fact.origin === 'lookup'
                      ? 'research, unverified'
                      : fact.origin === 'invented'
                        ? 'invented'
                        : 'from the brief'}
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-btn h-6 w-6 shrink-0 hover:text-danger"
                  aria-label="Remove fact"
                  onClick={() => updateBrief({ facts: brief.facts.filter((item) => item.id !== fact.id) })}
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="min-w-[160px] flex-1">
            <input
              className="field h-8"
              value={factText}
              onChange={(event) => setFactText(event.target.value)}
              placeholder="Add a fact you know"
              aria-label="New fact"
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <input
              className="field h-8"
              value={factSource}
              onChange={(event) => setFactSource(event.target.value)}
              placeholder="Source (optional)"
              aria-label="Fact source"
            />
          </div>
          <button type="button" className="btn btn-ghost h-8 gap-1" onClick={addFact}>
            <Plus size={12} />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function Sparkle() {
  return <Check size={14} />;
}

function SandboxTab({ project }: { project: Project }) {
  const updateProject = useApp((state) => state.updateProject);
  const pushToast = useApp((state) => state.pushToast);
  const presetId = ((project.sandboxPreset as SandboxPresetId | undefined) ??
    presetForGame(project.game)) as SandboxPresetId;

  const moves = project.moves.map((move) => ({
    id: move.id,
    name: move.name,
    description: move.description,
    purpose: move.purpose,
  }));
  const report = useMemo(() => runSandbox(moves, presetId), [moves, presetId]);
  const scores = useMemo(() => scoreKit(moves, report), [moves, report]);
  const maxTotal = Math.max(...report.frames.map((frame) => frame.total), 1);

  const width = (value: number) => `${Math.max(2, Math.round((value / maxTotal) * 100))}%`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Sandbox
          </h3>
          <p className="mt-1 text-[11.5px] text-ink-muted">
            Estimated commitment for {project.moves.length} saved move
            {project.moves.length === 1 ? '' : 's'}.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="field-label !mb-0" htmlFor="sandbox-preset">
            Preset
          </label>
          <select
            id="sandbox-preset"
            className="field h-8 w-auto text-[12px]"
            value={presetId}
            onChange={(event) =>
              updateProject(project.id, { sandboxPreset: event.target.value })
            }
          >
            {SANDBOX_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {report.frames.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-3 text-[11.5px] text-ink-faint">
          Save moves to this project first; the sandbox plays what is saved.
        </p>
      ) : (
        <>
          <p className="text-[12px] text-ink-muted">
            Full kit commitment ≈{' '}
            <span className="font-medium text-ink">{report.totalFrames} frames</span> if every move is
            used once.
          </p>

          <div className="space-y-2">
            {report.frames.map((frame) => (
              <div key={frame.moveId}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[12px] text-ink">{frame.name}</p>
                  <p className="shrink-0 text-[10.5px] text-ink-faint">
                    {frame.startup} / {frame.active} / {frame.recovery} · {frame.total}f
                    {frame.basis === 'preset' ? ' est.' : ''}
                  </p>
                </div>
                <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-surface">
                  <div style={{ width: width(frame.startup) }} className="bg-warn/60" title="Start-up" />
                  <div style={{ width: width(frame.active) }} className="bg-accent/80" title="Active" />
                  <div
                    style={{ width: width(frame.recovery) }}
                    className="bg-ink-faint/40"
                    title="Recovery"
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-ink-faint">
            <span className="text-warn">Start-up</span> ·{' '}
            <span className="text-accent">active</span> ·{' '}
            <span className="text-ink-faint">recovery</span>. Estimated from the text and preset, not
            measured in the game.
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {report.counterplay.map((line) => (
              <div key={line.answer} className="rounded-lg border border-line bg-panel-2 px-3 py-2">
                <p className="flex items-center justify-between gap-2 text-[12px] font-medium">
                  {line.answer}
                  <span
                    className={cx(
                      'text-[10px] uppercase tracking-wide',
                      line.verdict === 'holds'
                        ? 'text-accent'
                        : line.verdict === 'even'
                          ? 'text-warn'
                          : 'text-danger',
                    )}
                  >
                    {line.verdict === 'holds' ? 'Covered' : line.verdict === 'even' ? 'Even' : 'Open'}
                  </span>
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{line.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-5">
            {scores.map((axis) => (
              <div key={axis.id}>
                <p className="flex items-baseline justify-between text-[10.5px] text-ink-muted">
                  {axis.label}
                  <span className="text-ink-faint">{axis.score}</span>
                </p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                  <div className="h-full bg-accent/70" style={{ width: `${axis.score}%` }} />
                </div>
              </div>
            ))}
          </div>

          {report.warnings.length > 0 ? (
            <ul className="space-y-1">
              {report.warnings.map((warning) => (
                <li key={warning} className="flex gap-1.5 text-[11px] leading-relaxed text-warn">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost h-7 gap-1 text-[11px]"
              onClick={() => {
                downloadText(
                  `movaryn-${slugify(project.name, 32)}-frames.csv`,
                  frameTableCsv(report),
                  'text/csv',
                );
                pushToast('Frame-data estimates exported.', 'success');
              }}
            >
              <Download size={12} />
              Frame CSV
            </button>
            <button
              type="button"
              className="btn btn-ghost h-7 gap-1 text-[11px]"
              onClick={() =>
                downloadText(
                  `movaryn-${slugify(project.name, 32)}-sandbox.md`,
                  frameTableMarkdown(report),
                  'text/markdown',
                )
              }
            >
              <Download size={12} />
              Report Markdown
            </button>
          </div>
        </>
      )}

      <div>
        <label className="field-label" htmlFor="matchup-notes">
          Matchup notes
        </label>
        <textarea
          id="matchup-notes"
          className="field resize-y"
          rows={3}
          value={project.matchupNotes ?? ''}
          onChange={(event) => updateProject(project.id, { matchupNotes: event.target.value })}
          placeholder="How the kit handles rushdown, zoners, and a patient block."
        />
        <p className="mt-1 text-[10.5px] text-ink-faint">
          Kept with the project and sent with chats, so later drafts do not forget the matchup.
        </p>
      </div>
    </div>
  );
}

function RemapTab({ project }: { project: Project }) {
  const pushToast = useApp((state) => state.pushToast);
  const createProject = useApp((state) => state.createProject);
  const updateProject = useApp((state) => state.updateProject);
  const [target, setTarget] = useState(
    /jujutsu|jjs/i.test(project.game) ? 'The Strongest Battlegrounds' : 'Jujutsu Shenanigans',
  );
  const [result, setResult] = useState<RemapResult | null>(null);

  const run = () => {
    setResult(
      remapKit(
        project.moves.map((move) => ({
          name: move.name,
          description: move.description,
          purpose: move.purpose,
        })),
        target,
        project.game,
      ),
    );
  };

  const create = () => {
    if (!result) return;
    const id = createProject(
      {
        name: `${project.name} (${result.target.name})`,
        game: target,
        theme: project.theme,
        description: project.description,
      },
      { open: false },
    );
    updateProject(id, {
      constraints: project.constraints,
      brief: project.brief,
      matchupNotes: project.matchupNotes,
      moves: result.moves.map((move, index) => ({
        id: uid('move'),
        name: move.name,
        description: move.description,
        purpose: move.purpose,
        source: 'remap',
        createdAt: Date.now() + index,
      })),
    });
    pushToast(`Created a new project with ${result.moves.length} remapped moves.`, 'success');
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Remap to another game
        </h3>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
          Rewrites range and cooldown language for the target game and lists every change. It does
          not invent mechanics, and it never overwrites this project.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <label className="field-label" htmlFor="remap-target">
            Target game
          </label>
          <input
            id="remap-target"
            className="field"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="The Strongest Battlegrounds"
          />
        </div>
        <button type="button" className="btn btn-ghost h-9 gap-1.5" onClick={run}>
          <Shuffle size={14} />
          Run remap
        </button>
      </div>

      {!result ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-3 text-[11.5px] text-ink-faint">
          Nothing is converted until you run it. Read as {packForGame(project.game).name}; the target
          is read from the game name.
        </p>
      ) : (
        <>
          <div>
            <p className="text-[12px] text-ink">
              {result.source.name} → {result.target.name}
            </p>
            <ul className="mt-1 space-y-1 text-[11px] text-ink-muted">
              {result.notes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
          </div>

          {result.warnings.length > 0 ? (
            <ul className="space-y-1">
              {result.warnings.map((warning) => (
                <li key={warning.message} className="flex gap-1.5 text-[11px] leading-relaxed text-warn">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  <span>
                    {warning.message} {warning.alternative}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="space-y-2">
            {result.moves.map((move, index) => (
              <div key={`${move.name}_${index}`} className="rounded-lg border border-line bg-panel-2 px-3 py-2">
                <p className="text-[12px] font-medium text-ink">
                  {index + 1}. {move.name}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">{move.description}</p>
                {move.changes.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-[10.5px] text-ink-faint">
                    {move.changes.map((change) => (
                      <li key={`${change.field}_${change.from}`}>
                        {change.field}: {change.from} → {change.to}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {move.warnings.map((warning) => (
                  <p key={warning.message} className="mt-1 text-[10.5px] text-warn">
                    {warning.message} {warning.alternative}
                  </p>
                ))}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary h-8 gap-1 text-[11.5px]" onClick={create}>
              <Plus size={12} />
              Create remapped project
            </button>
            <button
              type="button"
              className="btn btn-ghost h-8 gap-1 text-[11.5px]"
              onClick={() =>
                downloadText(
                  `movaryn-${slugify(project.name, 32)}-${slugify(result.target.name, 24)}.md`,
                  remapToMarkdown(project.name, result, result.moves),
                  'text/markdown',
                )
              }
            >
              <Download size={12} />
              Export remap
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CompareTab({ project }: { project: Project }) {
  const projects = useApp((state) => state.projects);
  const order = useApp((state) => state.projectOrder);
  const others = order
    .map((id) => projects[id])
    .filter((entry): entry is Project => Boolean(entry) && entry.id !== project.id);
  const [selectedId, setSelectedId] = useState('');
  const other = others.find((entry) => entry.id === selectedId) ?? others[0];
  const presetId = ((project.sandboxPreset as SandboxPresetId | undefined) ??
    presetForGame(project.game)) as SandboxPresetId;

  const comparison = useMemo(
    () =>
      other
        ? compareKits(
            { name: project.name, moves: project.moves },
            { name: other.name, moves: other.moves },
            presetId,
          )
        : null,
    [project.name, project.moves, other, presetId],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Compare kits
          </h3>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
            Two saved kits read with the same preset. Frame windows and scores are estimates, not a
            balance verdict.
          </p>
        </div>
        {others.length > 0 ? (
          <div className="min-w-[200px]">
            <label className="field-label" htmlFor="compare-project">
              Compare with
            </label>
            <select
              id="compare-project"
              className="field h-8 text-[12px]"
              value={other?.id ?? ''}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {others.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {!comparison ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-3 text-[11.5px] text-ink-faint">
          Save a second project to compare this kit against it. Nothing is uploaded; both kits stay on
          this device.
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {[comparison.a, comparison.b].map((side, index) => (
              <div
                key={`${side.name}-${index}`}
                className="rounded-lg border border-line bg-panel-2 px-3 py-2"
              >
                <p className="truncate text-[12px] font-medium text-ink">
                  {side.name}
                  {index === 0 ? <span className="text-ink-faint"> · this project</span> : null}
                </p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-faint">
                  {side.moveCount} moves · ≈{side.totalFrames} frames · avg start-up{' '}
                  {side.averageStartup}f · recovery {side.averageRecovery}f
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-[11.5px]">
              <thead className="bg-surface text-ink-faint">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Axis</th>
                  <th className="px-2 py-1.5 text-right font-medium">This kit</th>
                  <th className="px-2 py-1.5 text-right font-medium">Other kit</th>
                </tr>
              </thead>
              <tbody>
                {comparison.a.scores.map((axis) => {
                  const otherAxis = comparison.b.scores.find((entry) => entry.id === axis.id);
                  return (
                    <tr key={axis.id} className="border-t border-line">
                      <td className="px-2 py-1.5 text-ink-muted">{axis.label}</td>
                      <td className="px-2 py-1.5 text-right text-ink">{axis.score}</td>
                      <td className="px-2 py-1.5 text-right text-ink">{otherAxis?.score ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { label: 'In both', items: comparison.sharedNames },
              { label: `Only ${comparison.a.name}`, items: comparison.onlyA },
              { label: `Only ${comparison.b.name}`, items: comparison.onlyB },
            ].map((group) => (
              <div
                key={group.label}
                className="rounded-lg border border-line bg-panel-2 px-3 py-2"
              >
                <p className="text-[10px] uppercase tracking-wide text-ink-faint">{group.label}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
                  {group.items.length > 0 ? group.items.join(', ') : 'None'}
                </p>
              </div>
            ))}
          </div>

          {comparison.notes.length > 0 ? (
            <ul className="space-y-1 text-[11.5px] leading-relaxed text-ink-muted">
              {comparison.notes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
          ) : null}

          <p className="text-[10px] leading-relaxed text-ink-faint">
            Both sides use the {comparison.presetName} preset. Estimated from the written moves, never
            measured in the game.
          </p>
        </>
      )}
    </div>
  );
}

function HistoryTab({ project }: { project: Project }) {
  const pushToast = useApp((state) => state.pushToast);
  const updateProject = useApp((state) => state.updateProject);
  const requestConfirm = useApp((state) => state.requestConfirm);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    void listProjectVersions(project.id).then((list) => {
      setVersions(list);
      setLoading(false);
    });
  };

  useEffect(() => {
    let alive = true;
    void listProjectVersions(project.id).then((list) => {
      if (!alive) return;
      setVersions(list);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [project.id]);

  const save = async () => {
    const record = await saveProjectVersion(project, `${project.moves.length} moves`);
    if (!record) {
      pushToast('This device could not store a version.', 'danger');
      return;
    }
    pushToast('Version saved on this device.', 'success');
    refresh();
  };

  const restore = (version: ProjectVersion) => {
    requestConfirm({
      title: 'Restore this version?',
      body: `The current brief and ${project.moves.length} saved moves are replaced by the snapshot from ${relativeTime(
        version.createdAt,
      )}. A snapshot of the current state is saved first.`,
      confirmLabel: 'Restore',
      onConfirm: async () => {
        await saveProjectVersion(project, 'Before restore');
        updateProject(project.id, {
          name: version.project.name,
          game: version.project.game,
          theme: version.project.theme,
          description: version.project.description,
          constraints: version.project.constraints,
          brief: version.project.brief,
          matchupNotes: version.project.matchupNotes,
          sandboxPreset: version.project.sandboxPreset,
          moves: version.project.moves,
        });
        pushToast('Version restored.', 'success');
        refresh();
      },
    });
  };

  const share = async () => {
    const code = encodeSharedKit(project);
    if (code.length > 90_000) {
      pushToast('This kit is too large for a share link. Export JSON instead.', 'danger');
      return;
    }
    const ok = await copyText(sharedKitUrl(code));
    pushToast(
      ok
        ? 'Read-only kit link copied. The kit travels in the link, not a server.'
        : 'Copy failed. Your browser blocked clipboard access.',
      ok ? 'success' : 'danger',
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Local versions
          </h3>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
            Snapshots live in this browser profile or desktop app only. Nothing is synced.
          </p>
        </div>
        <div className="flex gap-1.5">
          <button type="button" className="btn btn-ghost h-8 gap-1 text-[11.5px]" onClick={() => void share()}>
            <Share2 size={12} />
            Share kit
          </button>
          <button type="button" className="btn btn-primary h-8 gap-1 text-[11.5px]" onClick={() => void save()}>
            <Save size={12} />
            Save version
          </button>
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-1.5 text-[11.5px] text-ink-faint">
          <Loader2 size={12} className="animate-spin" /> Reading versions…
        </p>
      ) : versions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-3 text-[11.5px] text-ink-faint">
          No saved versions yet. “Save version” keeps the brief and moves as they are now.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {versions.map((version) => (
            <li
              key={version.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-panel-2 px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-[12px] text-ink">{version.label}</p>
                <p className="text-[10px] text-ink-faint">
                  {relativeTime(version.createdAt)} · {version.project.moves.length} moves ·{' '}
                  {version.project.brief?.mode ?? 'no brief'}
                </p>
              </div>
              <div className="flex shrink-0">
                <button
                  type="button"
                  className="icon-btn h-7 w-7"
                  title="Restore this version"
                  aria-label="Restore this version"
                  onClick={() => restore(version)}
                >
                  <RotateCcw size={13} />
                </button>
                <button
                  type="button"
                  className="icon-btn h-7 w-7 hover:text-danger"
                  title="Delete this version"
                  aria-label="Delete this version"
                  onClick={() => {
                    void deleteProjectVersion(version.id).then(refresh);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
