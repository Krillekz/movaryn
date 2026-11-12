import { useMemo, useState } from 'react';
import {
  BookOpen,
  Folder,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import type { Conversation } from '../../shared/types';
import { useApp } from '../store/useApp';
import { cx, groupByDay, relativeTime } from '../lib/utils';
import { Dropdown, DropdownItem } from './ui/Dropdown';
import { Logo, LogoMark } from './Logo';

export function Sidebar() {
  const collapsed = useApp((state) => state.ui.sidebarCollapsed);
  const compact = useApp((state) => state.settings.sidebarCompact);
  const mobileOpen = useApp((state) => state.ui.mobileSidebar);
  const search = useApp((state) => state.ui.search);
  const conversations = useApp((state) => state.conversations);
  const order = useApp((state) => state.order);
  const activeId = useApp((state) => state.activeId);
  const projects = useApp((state) => state.projects);
  const projectOrder = useApp((state) => state.projectOrder);
  const provider = useApp((state) => state.provider);
  const account = useApp((state) => state.account);
  const accountState = useApp((state) => state.accountState);

  const setSearch = useApp((state) => state.setSearch);
  const setSidebarCollapsed = useApp((state) => state.setSidebarCollapsed);
  const setMobileSidebar = useApp((state) => state.setMobileSidebar);
  const newConversation = useApp((state) => state.newConversation);
  const setActive = useApp((state) => state.setActive);
  const openSettings = useApp((state) => state.openSettings);
  const openProject = useApp((state) => state.openProject);
  const createProject = useApp((state) => state.createProject);
  const openNotebook = useApp((state) => state.openNotebook);
  const openAccount = useApp((state) => state.openAccount);

  const projectList = useMemo(
    () =>
      projectOrder
        .map((id) => projects[id])
        .filter((project): project is NonNullable<typeof project> => Boolean(project)),
    [projects, projectOrder],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = order
      .map((id) => conversations[id])
      .filter((conversation): conversation is Conversation => Boolean(conversation));
    if (!term) return list;
    return list.filter(
      (conversation) =>
        conversation.title.toLowerCase().includes(term) ||
        conversation.messages.some((message) => message.content.toLowerCase().includes(term)),
    );
  }, [conversations, order, search]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);
  const providerReady = Boolean(provider?.chat.configured);

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileSidebar(false)}
        />
      ) : null}

      <aside
        className={cx(
          'z-40 flex h-full shrink-0 flex-col border-r border-line bg-panel transition-[width,transform] duration-200',
          collapsed ? 'w-[68px]' : compact ? 'w-[236px]' : 'w-[276px]',
          'fixed inset-y-0 left-0 md:static',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
        aria-label="Conversations"
      >
        <div
          className={cx(
            'flex h-14 shrink-0 items-center border-b border-line px-3',
            collapsed && 'justify-center px-2',
          )}
        >
          {collapsed ? (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <LogoMark className="h-5 w-5" />
            </button>
          ) : (
            <>
              <Logo />
              <button
                type="button"
                className="icon-btn ml-auto"
                onClick={() => setSidebarCollapsed(true)}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose size={17} />
              </button>
              <button
                type="button"
                className="icon-btn md:hidden"
                onClick={() => setMobileSidebar(false)}
                title="Close sidebar"
                aria-label="Close sidebar"
              >
                <X size={17} />
              </button>
            </>
          )}
        </div>

        <div className={cx('px-3 pt-3', collapsed && 'px-2')}>
          <button
            type="button"
            className={cx(
              'btn btn-primary w-full',
              collapsed ? 'h-9 w-9 justify-center p-0' : 'justify-start',
            )}
            onClick={() => newConversation()}
            title="New chat"
          >
            <Plus size={16} />
            {collapsed ? null : <span>New chat</span>}
          </button>
        </div>

        {collapsed ? null : (
          <div className="px-3 pt-1.5">
            <button
              type="button"
              className="btn btn-secondary w-full justify-start gap-2 px-2 text-[12.5px]"
              onClick={openNotebook}
              title="Notebook"
            >
              <BookOpen size={15} />
              <span>Notebook</span>
              <span className="ml-auto text-[10px] text-ink-faint">⌘⇧N</span>
            </button>
          </div>
        )}

        {collapsed ? (
          <div className="flex flex-1 flex-col items-center gap-1 pt-3">
            <button
              type="button"
              className="icon-btn"
              title="Notebook"
              aria-label="Notebook"
              onClick={openNotebook}
            >
              <BookOpen size={17} />
            </button>
            <button
              type="button"
              className="icon-btn"
              title="Projects"
              aria-label="Projects"
              onClick={() => {
                const first = projectList[0];
                if (first) openProject(first.id);
                else createProject();
              }}
            >
              <Folder size={17} />
            </button>
          </div>
        ) : (
          <>
            <div className="px-3 pt-3">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
                />
                <input
                  id="movaryn-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search chats"
                  aria-label="Search chats"
                  className="field h-8 pl-8 pr-7 text-[12.5px]"
                />
                {search ? (
                  <button
                    type="button"
                    className="icon-btn absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="scroll-thin mt-2 flex-1 overflow-y-auto px-2 pb-2">
              {projectList.length > 0 ? (
                <section className="mb-3">
                  <div className="flex items-center justify-between px-1.5 pb-1">
                    <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                      Projects
                    </h2>
                    <button
                      type="button"
                      className="icon-btn h-6 w-6"
                      onClick={() => createProject()}
                      title="New project"
                      aria-label="New project"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  {projectList.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => openProject(project.id)}
                      className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface"
                    >
                      <Folder size={14} className="shrink-0 text-ink-faint" />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-muted group-hover:text-ink">
                        {project.name}
                      </span>
                      {project.moves.length > 0 ? (
                        <span className="text-[10px] tabular-nums text-ink-faint">
                          {project.moves.length}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </section>
              ) : null}

              {groups.length === 0 ? (
                <div className="px-2 py-6 text-center">
                  <p className="text-[12px] text-ink-faint">
                    {search ? 'No chats match that search.' : 'No chats yet.'}
                  </p>
                </div>
              ) : (
                groups.map((group) => (
                  <section key={group.label} className="mb-2">
                    <h2 className="px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                      {group.label}
                    </h2>
                    {group.items.map((conversation) => (
                      <ConversationRow
                        key={conversation.id}
                        conversation={conversation}
                        active={conversation.id === activeId}
                        projectName={
                          conversation.projectId ? projects[conversation.projectId]?.name : undefined
                        }
                        onSelect={() => setActive(conversation.id)}
                      />
                    ))}
                  </section>
                ))
              )}
            </div>
          </>
        )}

        <div
          className={cx(
            'shrink-0 border-t border-line p-2',
            collapsed && 'flex flex-col items-center',
          )}
        >
          <button
            type="button"
            className={cx(
              'btn btn-ghost w-full gap-2 px-2 text-[12.5px]',
              collapsed ? 'h-9 w-9 justify-center p-0' : 'justify-start',
            )}
            onClick={openAccount}
            title={account ? `@${account.username}` : 'Sign in or create a local account'}
          >
            {account ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent">
                {(account.displayName || account.username).charAt(0).toUpperCase()}
              </span>
            ) : (
              <UserRound size={15} />
            )}
            {collapsed ? null : account ? (
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-ink">{account.displayName}</span>
                <span className="block truncate text-[10px] text-ink-faint">@{account.username}</span>
              </span>
            ) : (
              <span className="text-left">
                {accountState === 'loading' ? 'Checking account…' : 'Sign in'}
              </span>
            )}
          </button>
          <button
            type="button"
            className={cx(
              'btn btn-ghost w-full gap-2 px-2 text-[12.5px]',
              collapsed ? 'h-9 w-9 justify-center p-0' : 'justify-start',
            )}
            onClick={() => openSettings()}
            title="Settings"
          >
            <Settings size={15} />
            {collapsed ? null : (
              <>
                <span>Settings</span>
                <span
                  className={cx(
                    'ml-auto h-1.5 w-1.5 rounded-full',
                    providerReady ? 'bg-ok' : 'bg-warn',
                  )}
                  title={providerReady ? 'AI provider connected' : 'Provider setup needed'}
                />
              </>
            )}
          </button>
          {collapsed ? null : (
            <p className="px-2 pb-1 pt-1.5 text-[10px] leading-relaxed text-ink-faint">
              Accounts are local. Keys stay on your server.
            </p>
          )}
        </div>
      </aside>
    </>
  );
}

function ConversationRow({
  conversation,
  active,
  projectName,
  onSelect,
}: {
  conversation: Conversation;
  active: boolean;
  projectName?: string;
  onSelect: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(conversation.title);
  const renameConversation = useApp((state) => state.renameConversation);
  const deleteConversation = useApp((state) => state.deleteConversation);
  const requestConfirm = useApp((state) => state.requestConfirm);
  const openProject = useApp((state) => state.openProject);

  const commitRename = () => {
    renameConversation(conversation.id, value.trim() || 'Untitled chat');
    setRenaming(false);
  };

  if (renaming) {
    return (
      <form
        className="px-1 py-0.5"
        onSubmit={(event) => {
          event.preventDefault();
          commitRename();
        }}
      >
        <input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setValue(conversation.title);
              setRenaming(false);
            }
          }}
          className="field h-7 text-[12.5px]"
          aria-label="Chat title"
        />
      </form>
    );
  }

  return (
    <div
      className={cx(
        'group relative flex items-center rounded-lg transition-colors',
        active ? 'bg-surface' : 'hover:bg-surface/70',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 flex-col px-2 py-1.5 text-left"
        aria-current={active ? 'page' : undefined}
      >
        <span
          className={cx(
            'truncate text-[12.5px] leading-5',
            active ? 'text-ink' : 'text-ink-muted group-hover:text-ink',
          )}
        >
          {conversation.title || 'New chat'}
        </span>
        <span className="flex items-center gap-1 text-[10px] leading-4 text-ink-faint">
          {projectName ? (
            <>
              <Folder size={9} />
              <span className="max-w-[92px] truncate">{projectName}</span>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          <span>{relativeTime(conversation.updatedAt)}</span>
        </span>
      </button>

      <Dropdown
        label="Chat options"
        align="right"
        className="mr-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100"
        trigger={<MoreHorizontal size={14} />}
        buttonClassName="icon-btn h-7 w-7"
      >
        {(close) => (
          <>
            <DropdownItem
              onClick={() => {
                close();
                setValue(conversation.title);
                setRenaming(true);
              }}
            >
              <Pencil size={13} />
              Rename
            </DropdownItem>
            {conversation.projectId ? (
              <DropdownItem
                onClick={() => {
                  close();
                  openProject(conversation.projectId as string);
                }}
              >
                <Folder size={13} />
                Open project
              </DropdownItem>
            ) : null}
            <DropdownItem
              danger
              onClick={() => {
                close();
                requestConfirm({
                  title: 'Delete this chat?',
                  body: `“${conversation.title || 'New chat'}” and its images will be removed from this device.`,
                  confirmLabel: 'Delete chat',
                  danger: true,
                  onConfirm: () => deleteConversation(conversation.id),
                });
              }}
            >
              <Trash2 size={13} />
              Delete
            </DropdownItem>
          </>
        )}
      </Dropdown>
    </div>
  );
}
