import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ClipboardCopy,
  Download,
  FolderPlus,
  Loader2,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { ImagePromptSpec } from '../../shared/types';
import type { ParsedResponse } from '../../shared/moveset';
import { buildImagePrompt } from '../../shared/imagePrompt';
import { useApp } from '../store/useApp';
import { generateConceptImage } from '../lib/chatEngine';
import { renderCharacterCard, type CharacterCardMove } from '../lib/characterCard';
import { copyText, cx, downloadUrl, slugify, uid } from '../lib/utils';
import { Modal } from './ui/Modal';

interface CharacterCardDialogProps {
  open: boolean;
  onClose: () => void;
  parsed: ParsedResponse;
  conversationId: string;
}

export function CharacterCardDialog({
  open,
  onClose,
  parsed,
  conversationId,
}: CharacterCardDialogProps) {
  const project = useApp((state) => {
    const conversation = state.conversations[conversationId];
    return conversation?.projectId ? (state.projects[conversation.projectId] ?? null) : null;
  });
  const messages = useApp((state) => state.conversations[conversationId]?.messages);
  const provider = useApp((state) => state.provider);
  const pushToast = useApp((state) => state.pushToast);
  const addProjectImages = useApp((state) => state.addProjectImages);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'generate' | 'prompt'>('generate');
  const [promptDraft, setPromptDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const moves = useMemo<CharacterCardMove[]>(() => {
    if (project && project.moves.length > 0) {
      return project.moves.map((move) => ({
        name: move.name,
        purpose: move.purpose,
        description: move.description,
      }));
    }
    return parsed.moves.map((move) => ({
      name: move.name,
      purpose: move.purpose,
      description: move.description,
    }));
  }, [project, parsed]);

  const name =
    (project && project.name.trim() && project.name !== 'Untitled character'
      ? project.name
      : '') ||
    parsed.meta.character?.trim() ||
    'Untitled character';
  const game = project?.game?.trim() || parsed.meta.game?.trim() || '';
  const theme = project?.theme?.trim() || parsed.meta.theme?.trim() || '';

  const artOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { id: string; src: string }[] = [];
    const add = (id: string, src?: string) => {
      if (!src || seen.has(src)) return;
      seen.add(src);
      options.push({ id, src });
    };
    for (const image of project?.images ?? []) add(image.id, image.dataUrl ?? image.url);
    for (const message of messages ?? []) {
      for (const image of message.images ?? []) add(image.id, image.dataUrl ?? image.url);
    }
    return options;
  }, [project, messages]);

  const selected = artOptions.find((option) => option.id === selectedId) ?? artOptions.at(-1) ?? null;
  const canGenerateArt = Boolean(provider?.image.configured);
  const promptTab = tab === 'prompt';

  const cardSpec = useMemo<ImagePromptSpec>(
    () => ({
      subject: theme ? `${name} — ${theme}` : name,
      details: project?.description?.trim() || '',
      outfit: '',
      pose: 'standing three-quarter view, weapon visible',
      framing: 'three-quarter',
      angle: 'eye-level three-quarter view',
      setting: 'plain studio backdrop',
      lighting: 'soft rim light from the left',
      style: 'clean game character concept art',
      palette: '',
      aspect: '3:4',
      reference: project?.references?.[0],
    }),
    [name, theme, project],
  );
  const externalPrompt = useMemo(
    () => `${buildImagePrompt(cardSpec)} Aspect ratio: ${cardSpec.aspect}.`,
    [cardSpec],
  );
  const promptValue = promptDraft ?? externalPrompt;
  const movesKey = moves.map((move) => `${move.name}|${move.purpose ?? ''}|${move.description ?? ''}`).join('~');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRendering(true);
    setError(null);
    setTab('generate');
    setPromptDraft(null);
    setCopied(false);
    renderCharacterCard({ name, game, theme, moves, art: selected?.src })
      .then((dataUrl) => {
        if (!cancelled) setCard(dataUrl);
      })
      .catch((renderError) => {
        if (cancelled) return;
        setError(
          renderError instanceof Error ? renderError.message : 'The card could not be rendered.',
        );
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
    };
    // movesKey stands in for the move list; the array identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, name, game, theme, movesKey, selected?.src]);

  const generateArt = async () => {
    if (generating) return;
    setGenerating(true);
    const ok = await generateConceptImage(cardSpec, { conversationId });
    setGenerating(false);
    if (ok) {
      setSelectedId(null);
      pushToast('Character art generated in this chat and placed on the card.', 'success');
    }
  };

  const copyPrompt = async () => {
    const text = promptValue.trim();
    if (!text) return;
    const ok = await copyText(text);
    if (!ok) {
      setError('The clipboard is unavailable here. Select the prompt text and copy it manually.');
      return;
    }
    setError(null);
    setCopied(true);
    pushToast('Prompt copied — paste it into any image generator.', 'success');
    window.setTimeout(() => setCopied(false), 1_800);
  };

  const download = () => {
    if (!card) return;
    downloadUrl(`movaryn-${slugify(name, 32)}-card.png`, card);
    pushToast('Character card downloaded as a PNG.', 'success');
  };

  const saveToProject = () => {
    if (!card || !project) return;
    addProjectImages(project.id, [
      {
        id: uid('img'),
        dataUrl: card,
        aspect: '16:9',
        prompt: `Character card — ${name}`,
      },
    ]);
    pushToast('Character card saved to the project art.', 'success');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Character card"
      description={
        promptTab
          ? 'A finished art prompt for this character, ready to paste into any image generator. Nothing is generated or sent anywhere in this tab.'
          : 'Character on the right, name and moves on the left. Text is drawn on this device, so every move is spelled exactly as you saved it.'
      }
      width="max-w-4xl"
      bodyClassName="px-4 pb-4 pt-3"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-ink-faint">
            {promptTab ? 'Prompt only · nothing is generated' : '1600 × 1000 PNG'}
          </span>
          <div className="flex flex-wrap gap-2">
            {promptTab ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void copyPrompt()}
                disabled={!promptValue.trim()}
              >
                {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
                {copied ? 'Copied' : 'Copy prompt'}
              </button>
            ) : null}
            {canGenerateArt && !promptTab ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void generateArt()}
                disabled={generating}
                title={
                  artOptions.length > 0
                    ? 'Generate another character image with the image provider'
                    : 'Generate character art with the configured image provider'
                }
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                {generating ? 'Generating…' : 'Generate art'}
              </button>
            ) : null}
            {project && !promptTab ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={saveToProject}
                disabled={!card}
              >
                <FolderPlus size={14} />
                Save to project art
              </button>
            ) : null}
            {promptTab ? null : (
              <button type="button" className="btn btn-primary" onClick={download} disabled={!card}>
                <Download size={14} />
                Download PNG
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div
          className="flex gap-1 rounded-xl border border-line bg-panel p-1"
          role="tablist"
          aria-label="Character art mode"
        >
          {(
            [
              { id: 'generate' as const, label: 'Generate art', icon: Wand2 },
              { id: 'prompt' as const, label: 'Prompt only', icon: ClipboardCopy },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => {
                  setTab(item.id);
                  setPromptDraft(null);
                  setCopied(false);
                }}
                className={cx(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors',
                  tab === item.id
                    ? 'bg-surface text-ink'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="relative overflow-hidden rounded-xl border border-line bg-panel">
          {card ? (
            <img src={card} alt={`${name} character card`} className="w-full" />
          ) : (
            <div
              className="flex w-full items-center justify-center text-[12px] text-ink-faint"
              style={{ aspectRatio: '16 / 10' }}
            >
              {rendering ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Drawing the card…
                </span>
              ) : (
                'Card unavailable'
              )}
            </div>
          )}
          {rendering && card ? (
            <span className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-panel/90 px-2 py-1 text-[10.5px] text-ink-muted backdrop-blur">
              <Loader2 size={11} className="animate-spin" />
              Updating
            </span>
          ) : null}
        </div>

        {promptTab ? (
          <div className="rounded-xl border border-line bg-panel px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink">
                <ClipboardCopy size={13} className="text-accent" />
                Prompt for another generator
              </span>
              <button
                type="button"
                className="btn btn-ghost h-6 px-1.5 text-[11px]"
                onClick={() => void copyPrompt()}
                disabled={!promptValue.trim()}
              >
                {copied ? <Check size={11} /> : <ClipboardCopy size={11} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <textarea
              value={promptValue}
              onChange={(event) => setPromptDraft(event.target.value)}
              rows={8}
              className="field scroll-thin mt-2 resize-y font-mono text-[11.5px] leading-relaxed"
              aria-label="Prompt for another generator"
            />
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-faint">
              {promptValue.length} characters · editable · describes the character art only. The
              card&apos;s name and moves are drawn on this device, so nothing else is needed.
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-danger/30 bg-panel px-3 py-2 text-[11.5px] leading-relaxed text-danger">
            {error}
          </p>
        ) : null}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="field-label mb-0">Character art</span>
            <span className="text-[10.5px] text-ink-faint">
              {artOptions.length === 0
                ? 'No art yet'
                : `${artOptions.length} image${artOptions.length === 1 ? '' : 's'} available`}
            </span>
          </div>
          {artOptions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-3 text-[11.5px] leading-relaxed text-ink-faint">
              {canGenerateArt
                ? 'Use Generate art above, or save concept art to the project and it will appear here.'
                : 'Image generation is not configured, so this card uses a placeholder panel. Save concept art to the project to fill it.'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {artOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedId(option.id)}
                  className={
                    selected?.id === option.id
                      ? 'overflow-hidden rounded-lg border-2 border-accent'
                      : 'overflow-hidden rounded-lg border-2 border-transparent opacity-70 transition-opacity hover:opacity-100'
                  }
                  aria-label="Use this art on the card"
                  title="Use this art on the card"
                >
                  <img src={option.src} alt="" className="h-16 w-16 object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="inline-flex items-start gap-1.5 text-[10.5px] leading-relaxed text-ink-faint">
          <Sparkles size={12} className="mt-0.5 shrink-0 text-accent" />
          The card is composed locally from your saved moves and chosen art. Nothing is uploaded when
          you change it, and the image model never draws the text.
        </p>
      </div>
    </Modal>
  );
}
