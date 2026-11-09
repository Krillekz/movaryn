import { useEffect, useMemo, useState } from 'react';
import { Download, FolderPlus, Loader2, Sparkles, Wand2 } from 'lucide-react';
import type { ImagePromptSpec } from '../../shared/types';
import type { ParsedResponse } from '../../shared/moveset';
import { useApp } from '../store/useApp';
import { generateConceptImage } from '../lib/chatEngine';
import { renderCharacterCard, type CharacterCardMove } from '../lib/characterCard';
import { downloadUrl, slugify, uid } from '../lib/utils';
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
  const movesKey = moves.map((move) => `${move.name}|${move.purpose ?? ''}|${move.description ?? ''}`).join('~');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRendering(true);
    setError(null);
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
    const spec: ImagePromptSpec = {
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
    };
    const ok = await generateConceptImage(spec, { conversationId });
    setGenerating(false);
    if (ok) {
      setSelectedId(null);
      pushToast('Character art generated in this chat and placed on the card.', 'success');
    }
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
      description="Character on the right, name and moves on the left. Text is drawn on this device, so every move is spelled exactly as you saved it."
      width="max-w-4xl"
      bodyClassName="px-4 pb-4 pt-3"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-ink-faint">1600 × 1000 PNG</span>
          <div className="flex flex-wrap gap-2">
            {canGenerateArt ? (
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
            {project ? (
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
            <button type="button" className="btn btn-primary" onClick={download} disabled={!card}>
              <Download size={14} />
              Download PNG
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
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
