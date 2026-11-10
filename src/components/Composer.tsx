import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Image as ImageIcon, Lightbulb, Paperclip, Square, X } from 'lucide-react';
import type { ImageAttachment } from '../../shared/types';
import { sendMessage, stopGeneration } from '../lib/chatEngine';
import { readImageFile } from '../lib/image';
import { useApp } from '../store/useApp';
import { cx } from '../lib/utils';

export function Composer() {
  const draft = useApp((state) => state.ui.draft);
  const setDraft = useApp((state) => state.setDraft);
  const streaming = useApp((state) => state.streaming);
  const provider = useApp((state) => state.provider);
  const openImageBrief = useApp((state) => state.openImageBrief);
  const openIdeas = useApp((state) => state.openIdeas);
  const pushToast = useApp((state) => state.pushToast);

  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  }, [draft]);

  const isStreaming = streaming !== null;
  const canSend = draft.trim().length > 0 || attachments.length > 0;

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (list.length === 0) return;
    const results: ImageAttachment[] = [];
    for (const file of list.slice(0, 3)) {
      try {
        results.push(await readImageFile(file));
      } catch (error) {
        pushToast(error instanceof Error ? error.message : 'That image could not be read.', 'danger');
      }
    }
    if (results.length > 0) setAttachments((current) => [...current, ...results].slice(0, 3));
  };

  const submit = async () => {
    if (!canSend || busy || isStreaming) return;
    const text =
      draft.trim() ||
      'Use this reference image. Identify the character design and propose a moveset direction that fits it.';
    setBusy(true);
    const ok = await sendMessage(text, attachments);
    setBusy(false);
    if (ok) {
      setDraft('');
      setAttachments([]);
    } else {
      textareaRef.current?.focus();
    }
  };

  return (
    <div
      className="relative mx-auto w-full max-w-[820px] px-4 pb-4 pt-2 md:px-8"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (event.dataTransfer.files.length > 0) void addFiles(event.dataTransfer.files);
      }}
    >
      {dragging ? (
        <div className="pointer-events-none absolute inset-x-4 inset-y-2 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-panel-2/95 text-[13px] text-accent md:inset-x-8">
          Drop an image to attach it as a reference
        </div>
      ) : null}

      <div
        className={cx(
          'rounded-2xl border bg-panel-2 shadow-lg transition-colors',
          dragging ? 'border-accent' : 'border-line focus-within:border-line-strong',
        )}
      >
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="relative">
                <img
                  src={attachment.dataUrl}
                  alt={attachment.name}
                  className="h-16 w-16 rounded-lg border border-line object-cover"
                />
                <button
                  type="button"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-panel-2 text-ink-muted shadow-sm hover:text-danger"
                  aria-label={`Remove ${attachment.name}`}
                  onClick={() =>
                    setAttachments((current) => current.filter((item) => item.id !== attachment.id))
                  }
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <textarea
          id="movaryn-composer"
          ref={textareaRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files).filter((file) =>
              file.type.startsWith('image/'),
            );
            if (files.length > 0) {
              event.preventDefault();
              void addFiles(files);
            }
          }}
          rows={1}
          placeholder="Describe a character, fighting style, or moveset idea..."
          aria-label="Message Movaryn"
          className="scroll-thin max-h-[220px] min-h-[56px] w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[15px] leading-relaxed outline-none placeholder:text-ink-faint"
        />

        <div className="flex items-center gap-1 px-2.5 pb-2.5 pt-1">
          <button
            type="button"
            className="icon-btn h-8 w-8"
            title="Attach a reference image"
            aria-label="Attach a reference image"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip size={16} />
          </button>
          <button
            type="button"
            className="icon-btn h-8 w-8"
            title="Generate concept art"
            aria-label="Generate concept art"
            onClick={() => openImageBrief()}
          >
            <ImageIcon size={16} />
          </button>
          <button
            type="button"
            className="icon-btn h-8 w-8"
            title="Prompt ideas"
            aria-label="Open the prompt idea library"
            onClick={openIdeas}
          >
            <Lightbulb size={16} />
          </button>

          <span className="ml-1 hidden select-none items-center gap-1 text-[11px] text-ink-faint sm:flex">
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px]">Enter</kbd>
            to send
            <span className="text-ink-faint/70">·</span>
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px]">
              Shift + Enter
            </kbd>
            for a new line
          </span>

          <div className="ml-auto flex items-center gap-2">
            {!provider?.chat.configured ? (
              <span className="hidden text-[11px] text-warn sm:block">No provider</span>
            ) : null}
            {isStreaming ? (
              <button
                type="button"
                onClick={stopGeneration}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-ink transition-colors hover:border-line-strong"
                title="Stop generating"
                aria-label="Stop generating"
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!canSend || busy}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-contrast transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
                title="Send message (Enter)"
                aria-label="Send message"
              >
                <ArrowUp size={17} />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-[10.5px] leading-relaxed text-ink-faint">
        Movaryn can be wrong about game mechanics. Verify features in the current game version before
        building.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) void addFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
