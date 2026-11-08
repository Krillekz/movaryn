import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  Folder,
  FolderPlus,
  Menu,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { Conversation } from '../../shared/types';
import { parseMoveset } from '../../shared/moveset';
import { fetchHealth } from '../lib/api';
import { useActiveConversation, useActiveProject, useApp } from '../store/useApp';
import { copyText, cx, downloadJson } from '../lib/utils';
import { Composer } from './Composer';
import { MessageItem, type PreviewImage } from './MessageItem';
import { Welcome } from './Welcome';
import { Modal } from './ui/Modal';
import { Dropdown, DropdownItem } from './ui/Dropdown';

const PAGE_SIZE = 120;

export function ChatView() {
  const conversation = useActiveConversation();
  const project = useActiveProject();
  const projects = useApp((state) => state.projects);
  const projectOrder = useApp((state) => state.projectOrder);
  const provider = useApp((state) => state.provider);
  const providerError = useApp((state) => state.providerError);
  const settings = useApp((state) => state.settings);
  const streaming = useApp((state) => state.streaming);
  const sidebarCollapsed = useApp((state) => state.ui.sidebarCollapsed);

  const setSidebarCollapsed = useApp((state) => state.setSidebarCollapsed);
  const setMobileSidebar = useApp((state) => state.setMobileSidebar);
  const renameConversation = useApp((state) => state.renameConversation);
  const deleteConversation = useApp((state) => state.deleteConversation);
  const requestConfirm = useApp((state) => state.requestConfirm);
  const assignProject = useApp((state) => state.assignProject);
  const createProject = useApp((state) => state.createProject);
  const openProject = useApp((state) => state.openProject);
  const openSettings = useApp((state) => state.openSettings);
  const openImageBrief = useApp((state) => state.openImageBrief);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [preview, setPreview] = useState<PreviewImage | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const messages = useMemo(() => conversation?.messages ?? [], [conversation]);
  const hiddenCount = Math.max(0, messages.length - visibleCount);
  const visibleMessages = hiddenCount > 0 ? messages.slice(hiddenCount) : messages;
  const lastMessage = messages[messages.length - 1];
  const isStreamingHere = Boolean(conversation && streaming?.conversationId === conversation.id);

  useEffect(() => {
    document.title = conversation?.title ? `${conversation.title} — Movaryn` : 'Movaryn — Better movesets.';
  }, [conversation?.title]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    stickRef.current = true;
    setEditingTitle(false);
    requestAnimationFrame(() => {
      const element = scrollRef.current;
      if (element) element.scrollTop = element.scrollHeight;
    });
  }, [conversation?.id]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !stickRef.current) return;
    element.scrollTop = element.scrollHeight;
  }, [messages.length, lastMessage?.content, lastMessage?.status]);

  const refreshProvider = async () => {
    setRefreshing(true);
    try {
      const status = await fetchHealth();
      useApp.getState().setProvider(status, null);
    } catch (error) {
      useApp.getState().setProvider(
        null,
        error instanceof Error ? error.message : 'The API is unreachable.',
      );
    } finally {
      setRefreshing(false);
    }
  };

  const exportMarkdown = async () => {
    if (!conversation) return;
    const ok = await copyText(conversationToMarkdown(conversation));
    useApp
      .getState()
      .pushToast(ok ? 'Chat copied as Markdown.' : 'Copy failed.', ok ? 'success' : 'danger');
  };

  const exportJson = () => {
    if (!conversation) return;
    downloadJson(`movaryn-${slug(conversation.title)}.json`, {
      exportedAt: new Date().toISOString(),
      conversation,
      project: project ?? undefined,
    });
    useApp.getState().pushToast('Chat exported.', 'success');
  };

  const saveAsProject = () => {
    if (!conversation) return;
    const parsed = latestMoveset(conversation);
    const projectId = createProject(
      {
        name: parsed?.meta.character?.trim() || conversation.title || 'New character',
        game: parsed?.meta.game,
        theme: parsed?.meta.theme,
      },
      { open: false },
    );
    assignProject(conversation.id, projectId);
    if (parsed) {
      for (const move of parsed.moves) {
        useApp.getState().addProjectMove(projectId, {
          name: move.name,
          description: move.description,
          purpose: move.purpose,
          source: conversation.id,
        });
      }
    }
    useApp.getState().pushToast('Chat saved as a project workspace.', 'success');
    openProject(projectId);
  };

  const projectList = projectOrder.map((id) => projects[id]).filter(Boolean);
  const modelLabel = settings.chatModel.trim() || provider?.chat.model || 'No model';
  const showBanner = !provider || !provider.chat.configured;
  const bannerMessage = providerError
    ? providerError
    : !provider
      ? 'The Movaryn API is not reachable. Start it with "npm run dev" and the app will reconnect.'
      : 'The AI provider is not configured. Add AI_API_KEY, AI_BASE_URL and AI_MODEL to .env, then restart the API.';

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-canvas/85 px-3 backdrop-blur md:px-5">
        <button
          type="button"
          className="icon-btn md:hidden"
          onClick={() => setMobileSidebar(true)}
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </button>
        {sidebarCollapsed ? (
          <button
            type="button"
            className="icon-btn hidden md:inline-flex"
            onClick={() => setSidebarCollapsed(false)}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeft size={18} />
          </button>
        ) : null}

        <div className="flex min-w-0 items-center gap-2">
          {editingTitle && conversation ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                renameConversation(conversation.id, titleDraft.trim() || 'Untitled chat');
                setEditingTitle(false);
              }}
            >
              <input
                autoFocus
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={() => {
                  renameConversation(conversation.id, titleDraft.trim() || 'Untitled chat');
                  setEditingTitle(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setEditingTitle(false);
                }}
                aria-label="Chat title"
                className="field h-7 w-[210px] text-[13px]"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (!conversation) return;
                setTitleDraft(conversation.title);
                setEditingTitle(true);
              }}
              className="group flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-surface"
              title={conversation ? 'Rename chat' : undefined}
            >
              <span className="max-w-[38vw] truncate text-[13px] font-medium text-ink sm:max-w-[320px]">
                {conversation?.title || 'New chat'}
              </span>
              {conversation ? (
                <Pencil size={11} className="shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
              ) : null}
            </button>
          )}

          {conversation ? (
            <Dropdown
              label="Project"
              align="right"
              buttonClassName="chip h-6 gap-1.5 hover:border-line-strong hover:text-ink"
              trigger={
                <>
                  {project ? <Folder size={11} /> : <FolderPlus size={12} />}
                  <span className="max-w-[110px] truncate">{project ? project.name : 'Project'}</span>
                </>
              }
            >
              {(close) => (
                <>
                  {projectList.length === 0 ? (
                    <p className="px-2.5 py-1.5 text-[11.5px] text-ink-faint">No projects yet.</p>
                  ) : (
                    projectList.map((item) => (
                      <DropdownItem
                        key={item.id}
                        onClick={() => {
                          assignProject(conversation.id, item.id);
                          close();
                        }}
                      >
                        <Folder size={13} />
                        <span className="truncate">{item.name}</span>
                      </DropdownItem>
                    ))
                  )}
                  <DropdownItem
                    onClick={() => {
                      const id = createProject({}, { open: false });
                      assignProject(conversation.id, id);
                      close();
                    }}
                  >
                    <Plus size={13} />
                    New project
                  </DropdownItem>
                  {project ? (
                    <>
                      <DropdownItem
                        onClick={() => {
                          close();
                          openProject(project.id);
                        }}
                      >
                        <Pencil size={13} />
                        Edit project
                      </DropdownItem>
                      <DropdownItem
                        danger
                        onClick={() => {
                          assignProject(conversation.id, undefined);
                          close();
                        }}
                      >
                        <Trash2 size={13} />
                        Remove from project
                      </DropdownItem>
                    </>
                  ) : null}
                </>
              )}
            </Dropdown>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-1 text-[10.5px] text-ink-muted sm:inline-flex">
            <span
              className={cx(
                'h-1.5 w-1.5 rounded-full',
                provider?.chat.configured ? 'bg-ok' : 'bg-warn',
              )}
            />
            <span className="max-w-[160px] truncate">{modelLabel}</span>
          </span>

          <button
            type="button"
            className="icon-btn"
            onClick={() => openImageBrief()}
            title="Generate concept art"
            aria-label="Generate concept art"
          >
            <Plus size={17} />
          </button>

          <Dropdown
            label="Chat actions"
            align="right"
            trigger={<MoreHorizontal size={18} />}
          >
            {(close) => (
              <>
                {conversation ? (
                  <>
                    <DropdownItem
                      onClick={() => {
                        close();
                        setTitleDraft(conversation.title);
                        setEditingTitle(true);
                      }}
                    >
                      <Pencil size={13} />
                      Rename chat
                    </DropdownItem>
                    <DropdownItem
                      onClick={() => {
                        close();
                        void exportMarkdown();
                      }}
                    >
                      <Copy size={13} />
                      Copy as Markdown
                    </DropdownItem>
                    <DropdownItem
                      onClick={() => {
                        close();
                        exportJson();
                      }}
                    >
                      <Folder size={13} />
                      Export JSON
                    </DropdownItem>
                    {!project ? (
                      <DropdownItem
                        onClick={() => {
                          close();
                          saveAsProject();
                        }}
                      >
                        <FolderPlus size={13} />
                        Save as project
                      </DropdownItem>
                    ) : null}
                    <DropdownItem
                      danger
                      onClick={() => {
                        close();
                        requestConfirm({
                          title: 'Delete this chat?',
                          body: `“${conversation.title || 'New chat'}” will be removed from this device.`,
                          confirmLabel: 'Delete chat',
                          danger: true,
                          onConfirm: () => deleteConversation(conversation.id),
                        });
                      }}
                    >
                      <Trash2 size={13} />
                      Delete chat
                    </DropdownItem>
                  </>
                ) : (
                  <DropdownItem
                    onClick={() => {
                      close();
                      exportJson();
                    }}
                    disabled
                  >
                    Nothing to export yet
                  </DropdownItem>
                )}
              </>
            )}
          </Dropdown>
        </div>
      </header>

      {showBanner ? (
        <div className="shrink-0 border-b border-warn/20 bg-warn/[0.04] px-4 py-2 md:px-6">
          <div className="mx-auto flex w-full max-w-[820px] flex-wrap items-center gap-x-3 gap-y-1.5">
            <AlertTriangle size={14} className="shrink-0 text-warn" />
            <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-ink-muted">
              {bannerMessage}
            </p>
            <button
              type="button"
              onClick={openSettings}
              className="btn btn-secondary h-6 px-2 text-[11px]"
            >
              Setup
            </button>
            <button
              type="button"
              onClick={() => void refreshProvider()}
              className="btn btn-ghost h-6 px-1.5 text-[11px]"
              disabled={refreshing}
            >
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : undefined} />
              Recheck
            </button>
          </div>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          stickRef.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < 140;
        }}
        className="scroll-thin flex-1 overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-[820px] px-4 pb-6 md:px-8">
          {messages.length === 0 ? (
            <Welcome />
          ) : (
            <>
              {hiddenCount > 0 ? (
                <div className="flex justify-center pt-4">
                  <button
                    type="button"
                    className="btn btn-ghost h-7 text-[11.5px]"
                    onClick={() => setVisibleCount((value) => value + PAGE_SIZE)}
                  >
                    Show {hiddenCount} earlier message{hiddenCount === 1 ? '' : 's'}
                  </button>
                </div>
              ) : null}
              {visibleMessages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  conversationId={conversation?.id ?? ''}
                  disabled={isStreamingHere}
                  onPreview={setPreview}
                />
              ))}
            </>
          )}
        </div>
      </div>

      <Composer />

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.alt ?? 'Image'}
        width="max-w-4xl"
        bodyClassName="px-4 pb-4 pt-3"
      >
        {preview ? (
          <img
            src={preview.src}
            alt={preview.alt}
            className="mx-auto max-h-[74vh] w-auto max-w-full rounded-lg"
          />
        ) : null}
        {preview?.prompt ? (
          <details className="mt-3 rounded-lg border border-line bg-panel px-3 py-2">
            <summary className="cursor-pointer text-[11px] text-ink-faint">Prompt</summary>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">{preview.prompt}</p>
          </details>
        ) : null}
      </Modal>
    </div>
  );
}

function conversationToMarkdown(conversation: Conversation): string {
  const lines: string[] = [`# ${conversation.title || 'Untitled chat'}`, ''];
  for (const message of conversation.messages) {
    lines.push(message.role === 'user' ? '## You' : '## Movaryn', '');
    if (message.content) lines.push(message.content, '');
    if (message.images?.length) {
      for (const [index, image] of message.images.entries()) {
        lines.push(`![Concept art ${index + 1}](${image.url ?? 'local image'})`, '');
      }
    }
    if (message.promptSpec) {
      lines.push('> Image prompt: ' + message.promptSpec.subject, '');
    }
  }
  return lines.join('\n');
}

function latestMoveset(conversation: Conversation) {
  for (let index = conversation.messages.length - 1; index >= 0; index -= 1) {
    const message = conversation.messages[index];
    if (message.role !== 'assistant' || !message.content.trim()) continue;
    const parsed = parseMoveset(message.content);
    if (parsed.isMoveset && parsed.moves.length > 0) return parsed;
  }
  return null;
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'chat'
  );
}
