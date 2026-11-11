import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  FileText,
  GraduationCap,
  History,
  Link2,
  ListChecks,
  Plus,
  Send,
  Square,
  Trash2,
} from 'lucide-react';
import type { NotebookNoteKind } from '../../shared/types';
import { useApp } from '../store/useApp';
import {
  NOTEBOOK_STUDIO,
  askNotebook,
  generateNotebookNote,
  stopNotebook,
} from '../lib/notebookEngine';
import { cx, formatTime } from '../lib/utils';
import { Markdown } from './Markdown';
import { Modal } from './ui/Modal';

const STUDIO_ICONS: Record<NotebookNoteKind, typeof FileText> = {
  briefing: FileText,
  faq: ListChecks,
  timeline: History,
  guide: GraduationCap,
};

const STUDIO_ORDER: NotebookNoteKind[] = ['briefing', 'faq', 'timeline', 'guide'];

export function NotebookDialog() {
  const open = useApp((state) => state.ui.notebookOpen);
  const close = useApp((state) => state.closeNotebook);
  const notebooks = useApp((state) => state.notebooks);
  const order = useApp((state) => state.notebookOrder);
  const activeNotebookId = useApp((state) => state.activeNotebookId);
  const createNotebook = useApp((state) => state.createNotebook);
  const updateNotebook = useApp((state) => state.updateNotebook);
  const deleteNotebook = useApp((state) => state.deleteNotebook);
  const setActiveNotebook = useApp((state) => state.setActiveNotebook);
  const addNotebookSource = useApp((state) => state.addNotebookSource);
  const removeNotebookSource = useApp((state) => state.removeNotebookSource);
  const removeNotebookNote = useApp((state) => state.removeNotebookNote);
  const requestConfirm = useApp((state) => state.requestConfirm);

  const notebook = activeNotebookId ? notebooks[activeNotebookId] : undefined;
  const list = useMemo(
    () => order.map((id) => notebooks[id]).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [notebooks, order],
  );

  const [titleDraft, setTitleDraft] = useState('');
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [question, setQuestion] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const busy = Boolean(notebook?.messages.some((message) => message.status === 'streaming'));
  const lastMessage = notebook?.messages[notebook.messages.length - 1];
  const totalChars = notebook?.sources.reduce((sum, source) => sum + source.text.length, 0) ?? 0;

  useEffect(() => {
    setTitleDraft(notebook?.title ?? '');
  }, [notebook?.id, notebook?.title]);

  useEffect(() => {
    if (!notebook) return;
    setSourceOpen(notebook.sources.length === 0);
  }, [notebook?.id, notebook?.sources.length]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [lastMessage?.content, lastMessage?.status, notebook?.id]);

  const commitTitle = () => {
    if (!notebook) return;
    const next = titleDraft.trim().slice(0, 90);
    if (next && next !== notebook.title) updateNotebook(notebook.id, { title: next });
    else setTitleDraft(notebook.title);
  };

  const addSource = () => {
    if (!notebook || !sourceText.trim()) return;
    addNotebookSource(notebook.id, {
      title: sourceTitle,
      text: sourceText,
      url: sourceUrl,
    });
    setSourceTitle('');
    setSourceUrl('');
    setSourceText('');
    setSourceOpen(false);
  };

  const submit = () => {
    if (!notebook || !question.trim() || busy) return;
    const text = question;
    setQuestion('');
    void askNotebook(notebook.id, text);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Notebook"
      description="Your sources, grounded answers and studio notes. Everything stays on this device."
      width="max-w-6xl"
      bodyClassName="p-0 overflow-hidden"
    >
      <div className="flex h-[72dvh] min-h-[420px] flex-col lg:flex-row">
        <aside className="scroll-thin flex shrink-0 flex-col border-b border-line bg-panel lg:w-[320px] lg:border-b-0 lg:border-r">
          <div className="border-b border-line p-3">
            <div className="flex items-center gap-1.5">
              <select
                value={notebook?.id ?? ''}
                onChange={(event) => setActiveNotebook(event.target.value)}
                className="field h-8 min-w-0 flex-1 text-[12px]"
                aria-label="Notebook"
              >
                {list.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="icon-btn h-8 w-8 shrink-0"
                onClick={() => createNotebook()}
                title="New notebook"
                aria-label="New notebook"
              >
                <Plus size={15} />
              </button>
              {notebook ? (
                <button
                  type="button"
                  className="icon-btn h-8 w-8 shrink-0"
                  onClick={() =>
                    requestConfirm({
                      title: 'Delete this notebook?',
                      body: `“${notebook.title}”, its sources and its notes will be removed from this device.`,
                      confirmLabel: 'Delete notebook',
                      danger: true,
                      onConfirm: () => deleteNotebook(notebook.id),
                    })
                  }
                  title="Delete notebook"
                  aria-label="Delete notebook"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </div>
            {notebook ? (
              <input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={commitTitle}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    (event.target as HTMLInputElement).blur();
                  }
                }}
                className="mt-2 w-full bg-transparent text-[14px] font-semibold tracking-tight text-ink outline-none"
                aria-label="Notebook title"
                maxLength={90}
              />
            ) : null}
            <p className="mt-1 text-[10.5px] text-ink-faint">
              {notebook
                ? `${notebook.sources.length} source${notebook.sources.length === 1 ? '' : 's'} · ${(
                    totalChars / 1000
                  ).toFixed(1)}k characters`
                : 'No notebook yet'}
            </p>
          </div>

          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                Sources
              </h3>
              <button
                type="button"
                className="icon-btn h-6 w-6"
                onClick={() => setSourceOpen((value) => !value)}
                title="Add a source"
                aria-label="Add a source"
              >
                <Plus size={14} />
              </button>
            </div>

            {notebook && notebook.sources.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {notebook.sources.map((source) => (
                  <li
                    key={source.id}
                    className="group flex items-start gap-2 rounded-lg border border-line bg-panel-2 px-2 py-1.5"
                  >
                    <BookOpen size={12} className="mt-0.5 shrink-0 text-accent" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] text-ink">{source.title}</p>
                      <p className="text-[10px] text-ink-faint">
                        {(source.text.length / 1000).toFixed(1)}k chars
                      </p>
                    </div>
                    <button
                      type="button"
                      className="icon-btn h-6 w-6 opacity-60 transition-opacity hover:opacity-100"
                      onClick={() => removeNotebookSource(notebook.id, source.id)}
                      title="Remove source"
                      aria-label={`Remove ${source.title}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
                Paste notes, a character sheet or a scene transcript. Grounded answers need at least one
                source.
              </p>
            )}

            {sourceOpen && notebook ? (
              <div className="mt-3 rounded-xl border border-line bg-panel-2 p-2.5">
                <input
                  value={sourceTitle}
                  onChange={(event) => setSourceTitle(event.target.value)}
                  placeholder="Source title"
                  maxLength={140}
                  className="field h-8 text-[12px]"
                  aria-label="Source title"
                />
                <textarea
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  placeholder="Paste the source text. Movaryn never fetches it from the web."
                  rows={5}
                  maxLength={20_000}
                  className="field mt-2 resize-y text-[12px]"
                  aria-label="Source text"
                />
                <div className="mt-2 flex items-center gap-1.5">
                  <Link2 size={12} className="shrink-0 text-ink-faint" />
                  <input
                    value={sourceUrl}
                    onChange={(event) => setSourceUrl(event.target.value)}
                    placeholder="Reference URL (optional)"
                    maxLength={500}
                    className="field h-7 text-[11px]"
                    aria-label="Reference URL"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-ink-faint">{sourceText.length}/20000</span>
                  <button
                    type="button"
                    className="btn btn-primary h-7 text-[11.5px]"
                    onClick={addSource}
                    disabled={!sourceText.trim()}
                  >
                    Add source
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                Studio notes
              </h3>
              {notebook && notebook.notes.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {notebook.notes.map((note) => (
                    <li key={note.id} className="rounded-lg border border-line bg-panel-2 px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[11.5px] text-ink">{note.title}</span>
                        <span className="ml-auto shrink-0 text-[9.5px] text-ink-faint">
                          {formatTime(note.createdAt)}
                        </span>
                        <button
                          type="button"
                          className="icon-btn h-5 w-5 shrink-0"
                          onClick={() => removeNotebookNote(notebook.id, note.id)}
                          title="Delete note"
                          aria-label={`Delete ${note.title}`}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-ink-faint">
                        {note.content.replace(/[#*`]/g, '').slice(0, 180)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
                  Generate a briefing, FAQ, timeline or study guide from your sources. Each one is saved
                  here.
                </p>
              )}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {notebook ? (
            <>
              <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-line px-3 py-2">
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                  Studio
                </span>
                {STUDIO_ORDER.map((kind) => {
                  const Icon = STUDIO_ICONS[kind];
                  return (
                    <button
                      key={kind}
                      type="button"
                      className="btn btn-secondary h-7 gap-1.5 px-2 text-[11px]"
                      onClick={() => void generateNotebookNote(notebook.id, kind)}
                      disabled={busy || notebook.sources.length === 0}
                      title={`Generate ${NOTEBOOK_STUDIO[kind].label.toLowerCase()} from these sources`}
                    >
                      <Icon size={12} />
                      {NOTEBOOK_STUDIO[kind].label}
                    </button>
                  );
                })}
                {busy ? (
                  <button
                    type="button"
                    className="btn btn-ghost ml-auto h-7 gap-1.5 px-2 text-[11px]"
                    onClick={stopNotebook}
                  >
                    <Square size={11} />
                    Stop
                  </button>
                ) : null}
              </div>

              <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {notebook.messages.length === 0 ? (
                  <div className="mx-auto mt-6 max-w-md text-center">
                    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <BookOpen size={20} />
                    </span>
                    <h3 className="mt-3 text-[14px] font-semibold text-ink">Ask your sources</h3>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                      Add a source, then ask a question. Answers cite the source titles they use, and the
                      notebook says so when the sources do not cover something.
                    </p>
                    {notebook.sources.length === 0 ? (
                      <button
                        type="button"
                        className="btn btn-primary mt-3 h-8 text-[12px]"
                        onClick={() => setSourceOpen(true)}
                      >
                        <Plus size={13} />
                        Add your first source
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="mx-auto flex max-w-3xl flex-col gap-3">
                    {notebook.messages.map((message) => (
                      <div
                        key={message.id}
                        className={cx(
                          'flex flex-col',
                          message.role === 'user' ? 'items-end' : 'items-start',
                        )}
                      >
                        {message.role === 'user' ? (
                          <div className="max-w-[88%] rounded-2xl rounded-br-md border border-accent/35 bg-accent-soft px-3 py-2 text-[12.5px] leading-relaxed text-ink">
                            {message.content}
                          </div>
                        ) : (
                          <div className="w-full rounded-xl border border-line bg-panel px-3.5 py-3">
                            {message.status === 'streaming' && !message.content ? (
                              <p className="text-[11.5px] text-ink-faint">Reading the sources…</p>
                            ) : (
                              <Markdown className="text-[13px]">{message.content}</Markdown>
                            )}
                            {message.status === 'error' ? (
                              <p className="mt-2 text-[11px] text-danger">{message.error}</p>
                            ) : null}
                            {message.status === 'complete' && message.stopped ? (
                              <p className="mt-2 text-[10.5px] text-ink-faint">Stopped early.</p>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-line bg-panel px-3 py-2.5">
                <div className="mx-auto flex max-w-3xl items-end gap-2">
                  <textarea
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        submit();
                      }
                    }}
                    placeholder={
                      notebook.sources.length === 0
                        ? 'Add a source to start asking…'
                        : 'Ask a question about these sources…'
                    }
                    rows={2}
                    disabled={notebook.sources.length === 0}
                    className="field max-h-32 min-h-[38px] flex-1 resize-none py-2 text-[12.5px] disabled:opacity-60"
                    aria-label="Notebook question"
                  />
                  <button
                    type="button"
                    className="btn btn-primary h-9 w-9 shrink-0 p-0"
                    onClick={submit}
                    disabled={!question.trim() || busy || notebook.sources.length === 0}
                    title="Ask the notebook"
                    aria-label="Ask the notebook"
                  >
                    <Send size={14} />
                  </button>
                </div>
                <p className="mx-auto mt-1.5 max-w-3xl text-[10px] leading-relaxed text-ink-faint">
                  Sources are sent to your configured AI provider only when you ask a question or generate
                  a note. Nothing is fetched from a source URL.
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <BookOpen size={22} className="text-ink-faint" />
              <p className="text-[12.5px] text-ink-muted">Create a notebook to start collecting sources.</p>
              <button
                type="button"
                className="btn btn-primary mt-1 h-8 text-[12px]"
                onClick={() => createNotebook()}
              >
                New notebook
              </button>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
