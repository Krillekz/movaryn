import { useRef, useState } from 'react';
import {
  ClipboardCopy,
  Download,
  FileText,
  FolderPlus,
  Loader2,
  Plus,
  Search,
  Table,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { GeneratedImage, ImageAttachment, Project } from '../../shared/types';
import { useApp } from '../store/useApp';
import { readImageFile } from '../lib/image';
import {
  copyText,
  cx,
  downloadText,
  extensionFromDataUrl,
  slugify,
} from '../lib/utils';
import {
  projectFileName,
  projectToCsv,
  projectToJson,
  projectToMarkdown,
} from '../lib/movesetExport';
import { briefPatch, parseMovesetFile } from '../lib/movesetImport';
import { Modal } from './ui/Modal';
import { CopyButton } from './ui/CopyButton';
import { Dropdown, DropdownItem } from './ui/Dropdown';

export function ProjectDrawer() {
  const projectId = useApp((state) => state.ui.projectId);
  const project = useApp((state) => (projectId ? (state.projects[projectId] ?? null) : null));
  const conversations = useApp((state) => state.conversations);
  const order = useApp((state) => state.order);
  const close = useApp((state) => state.closeProject);
  const updateProject = useApp((state) => state.updateProject);
  const deleteProject = useApp((state) => state.deleteProject);
  const removeProjectMove = useApp((state) => state.removeProjectMove);
  const addProjectMove = useApp((state) => state.addProjectMove);
  const addProjectReference = useApp((state) => state.addProjectReference);
  const removeProjectReference = useApp((state) => state.removeProjectReference);
  const newConversation = useApp((state) => state.newConversation);
  const setActive = useApp((state) => state.setActive);
  const requestConfirm = useApp((state) => state.requestConfirm);
  const pushToast = useApp((state) => state.pushToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [moveQuery, setMoveQuery] = useState('');
  const [purposeFilter, setPurposeFilter] = useState<string | null>(null);

  const chats = projectId
    ? order
        .map((id) => conversations[id])
        .filter((conversation) => conversation && conversation.projectId === projectId)
    : [];

  if (!project) {
    return <Modal open={false} onClose={close} title="Project" children={null} />;
  }

  const setField = (key: keyof Project, value: string) => {
    updateProject(project.id, { [key]: value } as Partial<Project>);
  };

  const purposes = Array.from(
    new Set(
      project.moves
        .map((move) => move.purpose?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const movesWithoutPurpose = project.moves.filter((move) => !move.purpose?.trim()).length;
  const query = moveQuery.trim().toLowerCase();
  const filteredMoves = project.moves.filter((move) => {
    if (purposeFilter && move.purpose?.trim() !== purposeFilter) return false;
    if (!query) return true;
    return `${move.name} ${move.purpose ?? ''} ${move.description}`.toLowerCase().includes(query);
  });

  const exportProject = (format: 'markdown' | 'csv' | 'json') => {
    if (format === 'markdown') {
      downloadText(projectFileName(project, 'md'), projectToMarkdown(project), 'text/markdown');
    } else if (format === 'csv') {
      downloadText(projectFileName(project, 'csv'), projectToCsv(project), 'text/csv');
    } else {
      downloadText(
        projectFileName(project, 'json'),
        JSON.stringify(projectToJson(project), null, 2),
        'application/json',
      );
    }
    pushToast(
      `Exported ${project.moves.length} move${project.moves.length === 1 ? '' : 's'} as ${
        format === 'markdown' ? 'Markdown' : format.toUpperCase()
      }.`,
      'success',
    );
  };

  const importMoveset = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const imported = parseMovesetFile(await file.text(), file.name);
      const patch = briefPatch(project, imported.brief);
      if (Object.keys(patch).length > 0) updateProject(project.id, patch);

      const existing = new Set(project.moves.map((move) => move.name.toLowerCase()));
      const updated = imported.moves.filter((move) => existing.has(move.name.toLowerCase())).length;
      for (const move of imported.moves) {
        addProjectMove(project.id, {
          name: move.name,
          description: move.description,
          purpose: move.purpose,
          source: 'import',
        });
      }

      const added = imported.moves.length - updated;
      const parts = [
        added > 0 ? `${added} new move${added === 1 ? '' : 's'}` : '',
        updated > 0 ? `${updated} updated` : '',
        imported.skipped > 0
          ? `${imported.skipped} row${imported.skipped === 1 ? '' : 's'} skipped`
          : '',
      ].filter(Boolean);
      pushToast(`Imported ${parts.join(', ')}.`, 'success');
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'That file could not be imported.',
        'danger',
      );
    }
  };

  const brief = [
    `CHARACTER: ${project.name || 'Untitled'}`,
    project.game ? `GAME: ${project.game}` : '',
    project.theme ? `THEME: ${project.theme}` : '',
    project.description ? `DESCRIPTION: ${project.description}` : '',
    project.constraints ? `CONSTRAINTS:\n${project.constraints}` : '',
    project.moves.length
      ? `MOVES:\n${project.moves
          .map(
            (move) =>
              `- ${move.name}${move.purpose ? ` (${move.purpose})` : ''}: ${move.description}`,
          )
          .join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const uploadReference = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files).slice(0, 3)) {
      try {
        const attachment = await readImageFile(file);
        addProjectReference(project.id, attachment);
      } catch (error) {
        pushToast(error instanceof Error ? error.message : 'That image could not be read.', 'danger');
      }
    }
  };

  return (
    <Modal
      open
      onClose={close}
      placement="right"
      title="Project workspace"
      description="The brief here is sent with every chat in this project."
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <button
              type="button"
              className="icon-btn"
              title="Copy project brief"
              aria-label="Copy project brief"
              onClick={async () => {
                const ok = await copyText(brief);
                pushToast(ok ? 'Project brief copied.' : 'Copy failed.', ok ? 'success' : 'danger');
              }}
            >
              <ClipboardCopy size={15} />
            </button>
            <Dropdown label="Export moveset" align="left" trigger={<Upload size={15} className="rotate-180" />}>
              {(closeExport) => (
                <>
                  <DropdownItem
                    onClick={() => {
                      closeExport();
                      exportProject('markdown');
                    }}
                  >
                    <FileText size={13} />
                    Markdown sheet
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => {
                      closeExport();
                      exportProject('csv');
                    }}
                  >
                    <Table size={13} />
                    CSV for spreadsheets
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => {
                      closeExport();
                      exportProject('json');
                    }}
                  >
                    <FileText size={13} />
                    JSON backup
                  </DropdownItem>
                </>
              )}
            </Dropdown>
            <button
              type="button"
              className="icon-btn hover:text-danger"
              title="Delete project"
              aria-label="Delete project"
              onClick={() =>
                requestConfirm({
                  title: 'Delete this project?',
                  body: `“${project.name}” and its saved moves, references and concept art will be removed from this device. Chats stay in your history.`,
                  confirmLabel: 'Delete project',
                  danger: true,
                  onConfirm: () => deleteProject(project.id),
                })
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              newConversation(project.id);
              close();
            }}
          >
            <Plus size={14} />
            New chat here
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="project-name">
              Character / project name
            </label>
            <input
              id="project-name"
              value={project.name}
              onChange={(event) => setField('name', event.target.value)}
              onBlur={() => {
                if (!project.name.trim()) setField('name', 'Untitled character');
              }}
              className="field text-[14px]"
              placeholder="Ash of the Hollow Bell"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="project-game">
              Target game
            </label>
            <input
              id="project-game"
              value={project.game}
              onChange={(event) => setField('game', event.target.value)}
              className="field"
              placeholder="Jujutsu Shenanigans"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="project-theme">
              Theme
            </label>
            <input
              id="project-theme"
              value={project.theme ?? ''}
              onChange={(event) => setField('theme', event.target.value)}
              className="field"
              placeholder="Funeral rites, bronze bells, ash"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="project-description">
              Character description
            </label>
            <textarea
              id="project-description"
              value={project.description ?? ''}
              onChange={(event) => setField('description', event.target.value)}
              rows={3}
              className="field resize-y"
              placeholder="Who they are, how they fight, weapons, silhouette, personality."
            />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="project-constraints">
              Constraints and notes
            </label>
            <textarea
              id="project-constraints"
              value={project.constraints ?? ''}
              onChange={(event) => setField('constraints', event.target.value)}
              rows={3}
              className="field resize-y"
              placeholder="No counters, no domain, easy to build, one-word names, exact move counts…"
            />
            <p className="mt-1 text-[10.5px] text-ink-faint">
              These are treated as hard requirements in every reply for this project.
            </p>
          </div>
        </div>

        <section>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Saved moves ({project.moves.length})
            </h3>
            <div className="flex items-center gap-2">
              {project.moves.length > 0 ? (
                <span className="text-[10.5px] text-ink-faint">
                  {movesWithoutPurpose === 0
                    ? 'Every move has a purpose'
                    : `${movesWithoutPurpose} without a purpose`}
                </span>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost h-6 gap-1 px-1.5 text-[11px]"
                onClick={() => importRef.current?.click()}
                title="Import moves from a JSON or CSV export"
              >
                <Upload size={12} />
                Import
              </button>
            </div>
          </div>
          <input
            ref={importRef}
            type="file"
            accept=".json,.csv,application/json,text/csv,text/plain"
            className="hidden"
            aria-label="Import moveset file"
            onChange={(event) => {
              void importMoveset(event.target.files);
              event.target.value = '';
            }}
          />
          {project.moves.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-line px-3 py-3 text-[11.5px] text-ink-faint">
              Use “Save moves” under a Movaryn reply to collect moves here, or import a JSON/CSV export.
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              <div className="relative">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
                />
                <input
                  value={moveQuery}
                  onChange={(event) => setMoveQuery(event.target.value)}
                  placeholder="Filter saved moves"
                  aria-label="Filter saved moves"
                  className="field h-8 pl-7 text-[12px]"
                />
              </div>
              {purposes.length > 1 ? (
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className={cx('chip h-6', !purposeFilter && 'border-accent/50 text-accent')}
                    onClick={() => setPurposeFilter(null)}
                  >
                    All
                  </button>
                  {purposes.map((purpose) => (
                    <button
                      key={purpose}
                      type="button"
                      className={cx(
                        'chip h-6',
                        purposeFilter === purpose && 'border-accent/50 text-accent',
                      )}
                      onClick={() =>
                        setPurposeFilter(purposeFilter === purpose ? null : purpose)
                      }
                    >
                      {purpose}
                    </button>
                  ))}
                </div>
              ) : null}
              {filteredMoves.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line px-3 py-3 text-[11.5px] text-ink-faint">
                  No saved moves match that filter.
                </p>
              ) : null}
              {filteredMoves.map((move) => (
                <div key={move.id} className="rounded-lg border border-line bg-panel px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">{move.name}</p>
                      {move.purpose ? (
                        <span className="chip mt-1 inline-flex">{move.purpose}</span>
                      ) : null}
                    </div>
                    <div className="flex shrink-0">
                      <CopyButton
                        text={`${move.name}\nDescription: ${move.description}${
                          move.purpose ? `\nPurpose: ${move.purpose}` : ''
                        }`}
                        label={`Copy ${move.name}`}
                      />
                      <button
                        type="button"
                        className="icon-btn hover:text-danger"
                        title="Remove move"
                        aria-label={`Remove ${move.name}`}
                        onClick={() => removeProjectMove(project.id, move.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-ink-muted">
                    {move.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Concept art ({project.images.length})
          </h3>
          {project.images.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-line px-3 py-3 text-[11.5px] text-ink-faint">
              Generated images saved from the chat appear here.
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {project.images.map((image: GeneratedImage, index) => (
                <div key={image.id} className="group relative overflow-hidden rounded-lg border border-line">
                  <img
                    src={image.dataUrl ?? image.url}
                    alt={image.prompt.slice(0, 80)}
                    className="h-36 w-full object-cover"
                    loading="lazy"
                  />
                  <a
                    href={image.dataUrl ?? image.url}
                    download={`movaryn-${slugify(project.name, 32)}-art-${index + 1}.${extensionFromDataUrl(
                      image.dataUrl ?? image.url ?? '',
                    )}`}
                    className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-panel/90 text-ink-muted opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 hover:text-ink"
                    aria-label="Download concept art"
                    title="Download concept art"
                  >
                    <Download size={12} />
                  </a>
                  {image.prompt?.trim() ? (
                    <button
                      type="button"
                      className="absolute left-9 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-panel/90 text-ink-muted opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 hover:text-ink"
                      aria-label="Copy concept art prompt"
                      title="Copy the prompt for this image"
                      onClick={async () => {
                        const ok = await copyText(image.prompt);
                        pushToast(
                          ok ? 'Concept art prompt copied.' : 'Copy failed.',
                          ok ? 'success' : 'danger',
                        );
                      }}
                    >
                      <ClipboardCopy size={12} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-panel/90 text-ink-muted opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 hover:text-danger"
                    aria-label="Remove image"
                    onClick={() =>
                      updateProject(project.id, {
                        images: project.images.filter((item) => item.id !== image.id),
                      })
                    }
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Reference images ({project.references.length})
            </h3>
            <button
              type="button"
              className="btn btn-ghost h-6 px-1.5 text-[11px]"
              onClick={() => fileRef.current?.click()}
            >
              <FolderPlus size={12} />
              Upload
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(event) => {
              void uploadReference(event.target.files);
              event.target.value = '';
            }}
          />
          {project.references.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-line px-3 py-3 text-[11.5px] text-ink-faint">
              Keep outfit and silhouette references with the character.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {project.references.map((reference: ImageAttachment) => (
                <div key={reference.id} className="group relative">
                  <img
                    src={reference.dataUrl}
                    alt={reference.name}
                    className="h-20 w-20 rounded-lg border border-line object-cover"
                  />
                  <button
                    type="button"
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-panel-2 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger"
                    aria-label={`Remove ${reference.name}`}
                    onClick={() => removeProjectReference(project.id, reference.id)}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Chats in this project ({chats.length})
          </h3>
          {chats.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-line px-3 py-3 text-[11.5px] text-ink-faint">
              Start a chat here to keep the brief in context.
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              {chats.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => {
                    setActive(conversation.id);
                    close();
                  }}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-left transition-colors hover:border-line-strong"
                >
                  <span className="min-w-0 truncate text-[12px] text-ink">
                    {conversation.title || 'New chat'}
                  </span>
                  <span className="shrink-0 text-[10.5px] text-ink-faint">
                    {conversation.messages.length} msg
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <p className="text-[10.5px] leading-relaxed text-ink-faint">
          Changes save automatically. The character brief and the names of saved moves are included in every
          reply in this project, so suggestions stay consistent and names are not reused.
        </p>
      </div>
    </Modal>
  );
}
