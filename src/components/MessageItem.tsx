import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  BookmarkPlus,
  Download,
  ExternalLink,
  Pencil,
  RefreshCw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { ChatMessage, GeneratedImage, Project } from '../../shared/types';
import { parseMoveset } from '../../shared/moveset';
import { describeImageBrief, resolveImagePrompt } from '../../shared/imagePrompt';
import { useApp } from '../store/useApp';
import { editAndResend, generateConceptImage, regenerate } from '../lib/chatEngine';
import {
  copyText,
  aspectRatioCss,
  cx,
  downloadUrl,
  extensionFromDataUrl,
  formatTime,
  slugify,
  truncate,
} from '../lib/utils';
import { LogoMark } from './Logo';
import { Markdown } from './Markdown';
import { MovesetView } from './MovesetView';
import { CopyButton } from './ui/CopyButton';

export interface PreviewImage {
  src: string;
  alt: string;
  prompt?: string;
}

interface MessageItemProps {
  message: ChatMessage;
  conversationId: string;
  disabled: boolean;
  onPreview: (image: PreviewImage) => void;
}

export function MessageItem({ message, conversationId, disabled, onPreview }: MessageItemProps) {
  return message.role === 'user' ? (
    <UserMessage
      message={message}
      conversationId={conversationId}
      disabled={disabled}
      onPreview={onPreview}
    />
  ) : (
    <AssistantMessage
      message={message}
      conversationId={conversationId}
      disabled={disabled}
      onPreview={onPreview}
    />
  );
}

// ── User message ─────────────────────────────────────────────
function UserMessage({
  message,
  conversationId,
  disabled,
  onPreview,
}: {
  message: ChatMessage;
  conversationId: string;
  disabled: boolean;
  onPreview: (image: PreviewImage) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [saving, setSaving] = useState(false);
  const toast = useApp.getState().pushToast;

  const submitEdit = async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    const ok = await editAndResend(conversationId, message.id, draft);
    setSaving(false);
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <div className="animate-in py-4">
        <div className="chat-bubble ml-auto max-w-[92%] border border-accent/40 bg-panel-2 p-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            className="scroll-thin w-full resize-y bg-transparent text-[14.5px] leading-relaxed outline-none"
            aria-label="Edit message"
            autoFocus
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost h-7 text-[12px]"
              onClick={() => {
                setDraft(message.content);
                setEditing(false);
              }}
            >
              <X size={13} />
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary h-7 text-[12px]"
              onClick={() => void submitEdit()}
              disabled={!draft.trim() || saving}
            >
              Save &amp; resend
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="message-row group flex flex-col items-end">
      <div className="chat-bubble max-w-[88%] border border-line bg-surface px-4 py-2.5">
        {message.attachments && message.attachments.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <button
                key={attachment.id}
                type="button"
                className="overflow-hidden rounded-lg border border-line"
                onClick={() => onPreview({ src: attachment.dataUrl, alt: attachment.name })}
              >
                <img
                  src={attachment.dataUrl}
                  alt={attachment.name}
                  className="h-20 w-20 object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
        <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink">{message.content}</p>
      </div>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-ink-faint opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
        <span className="mr-1">{formatTime(message.createdAt)}</span>
        <CopyButton
          text={message.content}
          label="Copy message"
          className="h-7 w-7"
          onCopied={(ok) => toast(ok ? 'Copied.' : 'Copy failed.', ok ? 'success' : 'danger')}
        />
        <button
          type="button"
          className="icon-btn h-7 w-7"
          title="Edit and resend"
          aria-label="Edit and resend"
          onClick={() => {
            if (disabled) return;
            setDraft(message.content);
            setEditing(true);
          }}
          disabled={disabled}
        >
          <Pencil size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Assistant message ────────────────────────────────────────
function AssistantMessage({
  message,
  conversationId,
  disabled,
  onPreview,
}: {
  message: ChatMessage;
  conversationId: string;
  disabled: boolean;
  onPreview: (image: PreviewImage) => void;
}) {
  const parsed = useMemo(
    () =>
      message.kind !== 'image' && message.status !== 'streaming' && message.content.trim()
        ? parseMoveset(message.content)
        : null,
    [message.content, message.kind, message.status],
  );
  const toast = useApp.getState().pushToast;
  const conversation = useApp((state) => state.conversations[conversationId]);
  const project = useApp((state) => {
    const id = state.conversations[conversationId]?.projectId;
    return id ? (state.projects[id] ?? null) : null;
  });
  const latestReplyId = useMemo(() => {
    const messages = conversation?.messages ?? [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === 'assistant') return messages[index].id;
    }
    return null;
  }, [conversation?.messages]);

  const imagePrompt = useMemo(() => imagePromptFor(message), [message]);

  const saveMoves = () => {
    if (!parsed || parsed.moves.length === 0) return;
    const state = useApp.getState();
    const conversation = state.conversations[conversationId];
    if (!conversation) return;
    let projectId = conversation.projectId;
    if (!projectId) {
      projectId = state.createProject(
        {
          name: parsed.meta.character?.trim() || conversation.title || 'New character',
          game: parsed.meta.game,
          theme: parsed.meta.theme,
        },
        { open: false },
      );
      useApp.getState().assignProject(conversationId, projectId);
    }
    for (const move of parsed.moves) {
      useApp.getState().addProjectMove(projectId, {
        name: move.name,
        description: move.description,
        purpose: move.purpose,
        source: conversationId,
      });
    }
    toast(
      `${parsed.moves.length} move${parsed.moves.length === 1 ? '' : 's'} saved to the project.`,
      'success',
    );
  };

  const saveImages = () => {
    if (!message.images?.length) return;
    const state = useApp.getState();
    const conversation = state.conversations[conversationId];
    let projectId = conversation?.projectId;
    if (!projectId) {
      projectId = state.createProject(
        { name: truncate(message.promptSpec?.subject || conversation?.title || 'Concept art', 60) },
        { open: false },
      );
      useApp.getState().assignProject(conversationId, projectId);
    }
    useApp.getState().addProjectImages(projectId, message.images);
    toast('Concept art saved to the project.', 'success');
  };

  const reviseImage = () => {
    if (!message.promptSpec) return;
    useApp.getState().openImageBrief({
      spec: message.promptSpec,
      conversationId,
      messageId: message.id,
    });
  };

  return (
    <div className="message-row group animate-in">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent-soft text-accent">
          <LogoMark className="h-3 w-3" />
        </span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
          Movaryn
        </span>
        {message.model ? (
          <span className="hidden truncate text-[10.5px] text-ink-faint sm:inline">
            · {message.model}
          </span>
        ) : null}
        <span className="ml-auto text-[11px] text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
          {formatTime(message.createdAt)}
        </span>
      </div>

      {message.kind === 'image' ? (
        <ImageMessageBody message={message} onPreview={onPreview} />
      ) : (
        <div>
          {message.content ? (
            parsed?.isMoveset ? (
              <MovesetView parsed={parsed} content={message.content} conversationId={conversationId} />
            ) : (
              <div className={cx(message.status === 'streaming' && 'stream-caret')}>
                <Markdown>{message.content}</Markdown>
              </div>
            )
          ) : message.status === 'streaming' ? (
            <div className="flex items-center gap-2 py-1 text-[13px] text-ink-faint">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
                  style={{ animationDelay: '300ms' }}
                />
              </span>
              Thinking
            </div>
          ) : null}

          {message.status === 'streaming' && message.content ? (
            <div className="mt-1 text-[11px] text-ink-faint">Writing…</div>
          ) : null}
        </div>
      )}

      {message.status === 'error' ? (
        <div className="mt-3 rounded-xl border border-danger/30 bg-panel-2 px-3.5 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-danger">That request did not complete</p>
              <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-ink-muted">
                {message.error}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {message.kind === 'image' && message.promptSpec ? (
                  <button
                    type="button"
                    className="btn btn-secondary h-7 text-[11.5px]"
                    onClick={() => void generateConceptImage(message.promptSpec!, {
                      conversationId,
                      messageId: message.id,
                    })}
                  >
                    <RefreshCw size={12} />
                    Try again
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary h-7 text-[11.5px]"
                    onClick={() => void regenerate(conversationId, message.id)}
                    disabled={disabled}
                  >
                    <RefreshCw size={12} />
                    Try again
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost h-7 text-[11.5px]"
                  onClick={() => useApp.getState().openSettings()}
                >
                  Check settings
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {message.kind === 'image' && message.notice ? (
        <p className="mt-2 rounded-lg border border-warn/30 bg-panel px-3 py-2 text-[11.5px] leading-relaxed text-ink-muted">
          {message.notice}
        </p>
      ) : null}

      {message.notice && message.kind !== 'image' ? (
        <p className="mt-2 rounded-lg border border-line bg-panel px-3 py-2 text-[11.5px] leading-relaxed text-ink-faint">
          {message.notice}
        </p>
      ) : null}

      {message.stopped && message.content ? (
        <p className="mt-2 text-[11px] text-ink-faint">Stopped before the reply finished.</p>
      ) : null}

      {message.status !== 'streaming' && message.content && message.kind !== 'image' ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
          <CopyButton
            text={message.content}
            label="Copy reply"
            onCopied={(ok) => toast(ok ? 'Copied.' : 'Copy failed.', ok ? 'success' : 'danger')}
          />
          <button
            type="button"
            className="icon-btn"
            title="Regenerate reply"
            aria-label="Regenerate reply"
            disabled={disabled}
            onClick={() => void regenerate(conversationId, message.id)}
          >
            <RefreshCw size={15} />
          </button>
          {parsed?.isMoveset ? (
            <button
              type="button"
              className="btn btn-ghost h-8 gap-1.5 px-2 text-[11.5px]"
              onClick={saveMoves}
              title="Save these moves to the project workspace"
            >
              <BookmarkPlus size={13} />
              Save moves
            </button>
          ) : null}
        </div>
      ) : null}

      {message.kind === 'image' && message.status !== 'streaming' && message.images?.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="btn btn-secondary h-7 px-2 text-[11.5px]"
            onClick={() => {
              if (!message.promptSpec) return;
              void generateConceptImage(message.promptSpec, {
                conversationId,
                messageId: message.id,
              });
            }}
            disabled={disabled}
          >
            <RefreshCw size={12} />
            Regenerate
          </button>
          <button
            type="button"
            className="btn btn-secondary h-7 px-2 text-[11.5px]"
            onClick={reviseImage}
            disabled={!message.promptSpec}
          >
            <SlidersHorizontal size={12} />
            Revise
          </button>
          <button
            type="button"
            className="btn btn-ghost h-7 px-2 text-[11.5px]"
            aria-label="Copy prompt"
            onClick={async () => {
              const ok = await copyText(imagePrompt);
              toast(ok ? 'Image prompt copied.' : 'Copy failed.', ok ? 'success' : 'danger');
            }}
            disabled={!imagePrompt}
          >
            Copy prompt
          </button>
          <button
            type="button"
            className="btn btn-ghost h-7 px-2 text-[11.5px]"
            onClick={saveImages}
          >
            <BookmarkPlus size={12} />
            Save to project
          </button>
        </div>
      ) : null}

      {project && message.id === latestReplyId && message.status !== 'streaming' ? (
        <BriefSources project={project} />
      ) : null}
    </div>
  );
}

/**
 * Project-level facts shown under the latest reply, so a source can be checked
 * where the kit is read. These are saved brief facts, not a claim about what
 * the model used.
 */
function BriefSources({ project }: { project: Project }) {
  const facts = project.brief?.facts ?? [];
  if (facts.length === 0) return null;

  return (
    <details className="mt-2 rounded-xl border border-line bg-panel px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-medium text-ink-faint hover:text-ink-muted">
        <BookOpen size={12} />
        Brief sources ({facts.length})
        <span className="ml-auto text-[10px] font-normal text-ink-faint">project-level</span>
      </summary>
      <ul className="mt-2 space-y-1.5">
        {facts.map((fact) => (
          <li key={fact.id} className="text-[11.5px] leading-relaxed text-ink-muted">
            {fact.text}
            <span className="text-ink-faint">
              {' — '}
              {fact.source ? fact.source : 'no source given'}
              {' · '}
              {fact.origin === 'lookup'
                ? 'research, unverified'
                : fact.origin === 'invented'
                  ? 'invented earlier'
                  : 'from the brief'}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] leading-relaxed text-ink-faint">
          Saved with this project. A reply may not use every fact, and research facts are unverified
          until you check the source.
        </p>
        <button
          type="button"
          className="btn btn-ghost h-6 px-2 text-[10.5px]"
          onClick={() => {
            const state = useApp.getState();
            state.openProject(project.id);
            state.openTools('brief');
          }}
        >
          Review brief
        </button>
      </div>
    </details>
  );
}

function ImageMessageBody({
  message,
  onPreview,
}: {
  message: ChatMessage;
  onPreview: (image: PreviewImage) => void;
}) {
  const aspectStyle = { aspectRatio: aspectRatioCss(message.promptSpec?.aspect ?? '1:1') };
  const toast = useApp.getState().pushToast;
  const imagePrompt = imagePromptFor(message);

  if (message.status === 'streaming') {
    return (
      <div
        className="skeleton w-full max-w-md rounded-xl border border-line"
        style={aspectStyle}
        role="status"
        aria-label="Generating image"
      />
    );
  }

  if (message.status === 'error') return null;

  if (!message.images?.length) return null;

  return (
    <div className="flex flex-col gap-2">
      {message.images.map((image, index) => (
        <div
          key={image.id}
          className="group/img relative w-full max-w-xl overflow-hidden rounded-xl border border-line bg-panel"
        >
          <img
            src={image.dataUrl ?? image.url}
            alt={message.promptSpec ? describeImageBrief(message.promptSpec) : 'Concept art'}
            className={cx('w-full object-contain', message.images!.length > 1 ? 'max-h-72' : 'max-h-[560px]')}
            loading="lazy"
            onClick={() =>
              onPreview({
                src: image.dataUrl ?? image.url ?? '',
                alt: describeImageBrief(message.promptSpec ?? {
                  subject: 'Concept art',
                  framing: 'full-body',
                  aspect: image.aspect,
                }),
                prompt: image.prompt,
              })
            }
          />
          <div className="absolute right-2 top-2 flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover/img:opacity-100">
            <ImageDownloadButton image={image} index={index} />
            {image.url ? (
              <a
                href={image.url}
                target="_blank"
                rel="noreferrer noopener"
                className="icon-btn bg-panel/90 backdrop-blur"
                title="Open full image"
                aria-label="Open full image"
              >
                <ExternalLink size={14} />
              </a>
            ) : null}
          </div>
        </div>
      ))}

      {message.promptSpec ? (
        <details className="rounded-lg border border-line bg-panel px-3 py-2">
          <summary className="cursor-pointer list-none text-[11px] font-medium text-ink-faint hover:text-ink-muted">
            Image prompt · {message.promptSpec.framing.replace('-', ' ')} · {message.promptSpec.aspect}
          </summary>
          <div className="mt-2 flex items-start gap-2">
            <p className="min-w-0 flex-1 whitespace-pre-line text-[11.5px] leading-relaxed text-ink-muted">
              {imagePrompt || resolveImagePrompt(message.promptSpec)}
            </p>
            <CopyButton
              text={imagePrompt}
              label="Copy prompt"
              className="h-7 w-7 shrink-0"
              onCopied={(ok) =>
                toast(ok ? 'Image prompt copied.' : 'Copy failed.', ok ? 'success' : 'danger')
              }
            />
          </div>
          {message.promptSpec.reference ? (
            <p className="mt-1.5 text-[10.5px] text-ink-faint">
              Reference image: {message.promptSpec.reference.name}
            </p>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}

/**
 * The reproducible prompt for an image message. The brief is the source; the provider's
 * echo can be missing or rewritten, so it is only a fallback.
 */
function imagePromptFor(message: ChatMessage): string {
  if (!message.promptSpec) return message.images?.[0]?.prompt ?? '';
  return `${resolveImagePrompt(message.promptSpec)} Aspect ratio: ${message.promptSpec.aspect}.`;
}

function ImageDownloadButton({ image, index }: { image: GeneratedImage; index: number }) {
  return (
    <button
      type="button"
      className="icon-btn bg-panel/90 backdrop-blur"
      title="Download image"
      aria-label="Download image"
      onClick={() => {
        const src = image.dataUrl ?? image.url;
        if (!src) return;
        if (src.startsWith('data:')) {
          const name = slugify(image.prompt || 'concept-art', 40);
          downloadUrl(`movaryn-${name}-${index + 1}.${extensionFromDataUrl(src)}`, src);
        } else {
          window.open(src, '_blank', 'noreferrer,noopener');
        }
      }}
    >
      <Download size={14} />
    </button>
  );
}
