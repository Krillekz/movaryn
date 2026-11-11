import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Download,
  Folder,
  Image as ImageIcon,
  Lightbulb,
  Map,
  MessageSquare,
  Moon,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
} from 'lucide-react';
import type { Conversation, Project } from '../../shared/types';
import { useApp } from '../store/useApp';
import { exportAllData } from '../lib/exportData';
import { CHANGELOG_URL, ROADMAP_URL, openExternal } from '../lib/links';
import { cx } from '../lib/utils';

type PaletteIcon = typeof Sparkles;

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: PaletteIcon;
  run: () => void;
}

interface PaletteGroup {
  label: string;
  items: PaletteItem[];
}

export function CommandPalette() {
  const open = useApp((state) => state.ui.paletteOpen);
  const close = useApp((state) => state.closePalette);
  const theme = useApp((state) => state.settings.theme);
  const conversations = useApp((state) => state.conversations);
  const order = useApp((state) => state.order);
  const projects = useApp((state) => state.projects);
  const projectOrder = useApp((state) => state.projectOrder);

  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelected(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  const actions = useMemo<PaletteItem[]>(() => {
    const state = useApp.getState();
    return [
      {
        id: 'new-chat',
        label: 'New chat',
        hint: 'Start a blank conversation',
        icon: Plus,
        run: () => state.newConversation(),
      },
      {
        id: 'new-project',
        label: 'New project',
        hint: 'Group chats, moves and art around a brief',
        icon: Folder,
        run: () => state.createProject(),
      },
      {
        id: 'notebook',
        label: 'Open the notebook',
        hint: 'Sources, grounded answers and studio notes',
        icon: BookOpen,
        run: () => state.openNotebook(),
      },
      {
        id: 'ideas',
        label: 'Open the idea library',
        hint: 'Sparks, constraint packs and art presets',
        icon: Lightbulb,
        run: () => state.openIdeas(),
      },
      {
        id: 'art',
        label: 'Generate concept art',
        hint: 'Open the image brief',
        icon: ImageIcon,
        run: () => state.openImageBrief(),
      },
      {
        id: 'whats-new',
        label: "What's new",
        hint: 'Release notes inside the app',
        icon: Sparkles,
        run: () => state.openWhatsNew(),
      },
      {
        id: 'roadmap',
        label: 'Roadmap',
        hint: 'What is planned next',
        icon: Map,
        run: () => openExternal(ROADMAP_URL),
      },
      {
        id: 'changelog',
        label: 'Full update log',
        hint: 'Every release on the website',
        icon: Download,
        run: () => openExternal(CHANGELOG_URL),
      },
      {
        id: 'settings-provider',
        label: 'Settings · Provider',
        hint: 'Connection and API setup',
        icon: Settings,
        run: () => state.openSettings('provider'),
      },
      {
        id: 'settings-layout',
        label: 'Settings · Layout & replies',
        hint: 'Reading width, spacing and how the AI answers',
        icon: Settings,
        run: () => state.openSettings('layout'),
      },
      {
        id: 'settings-prompts',
        label: 'Settings · Prompts',
        hint: 'House rules sent with every chat',
        icon: Settings,
        run: () => state.openSettings('prompts'),
      },
      {
        id: 'settings-data',
        label: 'Settings · Data & privacy',
        hint: 'Export or delete local data',
        icon: Settings,
        run: () => state.openSettings('data'),
      },
      {
        id: 'settings-about',
        label: 'Settings · About',
        hint: 'Version, keyboard shortcuts and credits',
        icon: Settings,
        run: () => state.openSettings('about'),
      },
      {
        id: 'theme',
        label: theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme',
        icon: theme === 'light' ? Moon : Sun,
        run: () => state.updateSettings({ theme: theme === 'light' ? 'dark' : 'light' }),
      },
      {
        id: 'sidebar',
        label: 'Toggle the sidebar',
        hint: 'Ctrl/⌘ B',
        icon: PanelLeft,
        run: () => state.setSidebarCollapsed(!state.ui.sidebarCollapsed),
      },
      {
        id: 'export',
        label: 'Export all data',
        hint: 'Download a JSON backup',
        icon: Download,
        run: () => exportAllData(),
      },
    ];
  }, [theme]);

  const term = query.trim().toLowerCase();
  const matches = (text: string) => !term || text.toLowerCase().includes(term);

  const groups = useMemo<PaletteGroup[]>(() => {
    const actionItems = actions.filter((item) => matches(`${item.label} ${item.hint ?? ''}`));

    const chatItems: PaletteItem[] = order
      .map((id) => conversations[id])
      .filter((conversation): conversation is Conversation => Boolean(conversation))
      .filter((conversation) => {
        if (!term) return true;
        const recent = conversation.messages
          .slice(-12)
          .map((message) => message.content)
          .join(' ');
        return matches(`${conversation.title} ${recent}`);
      })
      .slice(0, term ? 6 : 4)
      .map((conversation) => ({
        id: `chat-${conversation.id}`,
        label: conversation.title || 'New chat',
        hint: `${conversation.messages.length} message${
          conversation.messages.length === 1 ? '' : 's'
        }`,
        icon: MessageSquare,
        run: () => useApp.getState().setActive(conversation.id),
      }));

    const projectItems: PaletteItem[] = projectOrder
      .map((id) => projects[id])
      .filter((project): project is Project => Boolean(project))
      .filter((project) =>
        matches(
          `${project.name} ${project.game} ${project.theme ?? ''} ${project.description ?? ''}`,
        ),
      )
      .slice(0, term ? 5 : 3)
      .map((project) => ({
        id: `project-${project.id}`,
        label: project.name,
        hint: `${project.moves.length} saved move${project.moves.length === 1 ? '' : 's'}${
          project.game ? ` · ${project.game}` : ''
        }`,
        icon: Folder,
        run: () => useApp.getState().openProject(project.id),
      }));

    const moveItems: PaletteItem[] = term
      ? projectOrder
          .flatMap((projectId) => {
            const project = projects[projectId];
            if (!project) return [];
            return project.moves
              .filter((move) =>
                matches(`${move.name} ${move.purpose ?? ''} ${move.description}`),
              )
              .slice(0, 3)
              .map((move) => ({
                id: `move-${move.id}`,
                label: move.name,
                hint: `${project.name}${move.purpose ? ` · ${move.purpose}` : ''}`,
                icon: Lightbulb,
                run: () => useApp.getState().openProject(project.id),
              }));
          })
          .slice(0, 5)
      : [];

    return [
      { label: 'Commands', items: actionItems },
      { label: 'Chats', items: chatItems },
      { label: 'Projects', items: projectItems },
      { label: 'Saved moves', items: moveItems },
    ].filter((group) => group.items.length > 0);
  }, [actions, conversations, order, projects, projectOrder, term]);

  const rows = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  useEffect(() => {
    setSelected(0);
  }, [term]);

  useEffect(() => {
    if (selected >= rows.length) setSelected(0);
  }, [rows.length, selected]);

  useEffect(() => {
    if (!open) return;
    document
      .querySelector(`[data-palette-index="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selected, open]);

  if (!open) return null;

  const activate = (item: PaletteItem) => {
    close();
    window.setTimeout(item.run, 20);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((index) => (rows.length === 0 ? 0 : (index + 1) % rows.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((index) => (rows.length === 0 ? 0 : (index - 1 + rows.length) % rows.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = rows[selected];
      if (item) activate(item);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  let flatIndex = -1;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-center px-3 pt-[8vh] sm:pt-[12vh]">
      <button
        type="button"
        aria-label="Close command palette"
        onClick={close}
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]"
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
        className="relative flex max-h-[70vh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border border-line bg-panel-2 shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={16} className="shrink-0 text-ink-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats, projects, saved moves or commands…"
            aria-label="Command palette search"
            className="h-12 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-faint"
          />
          <kbd className="shrink-0 rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] text-ink-faint">
            Esc
          </kbd>
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto p-2">
          {rows.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-[13px] text-ink">No matches.</p>
              <p className="mt-1 text-[11.5px] text-ink-faint">
                Try a chat title, a move name, “settings” or “art”.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.label} className="mb-1">
                <h3 className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                  {group.label}
                </h3>
                {group.items.map((item) => {
                  flatIndex += 1;
                  const index = flatIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-palette-index={index}
                      onMouseMove={() => setSelected(index)}
                      onClick={() => activate(item)}
                      className={cx(
                        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                        index === selected ? 'bg-surface text-ink' : 'text-ink-muted hover:bg-surface/60',
                      )}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-panel text-ink-muted">
                        <Icon size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-ink">{item.label}</span>
                        {item.hint ? (
                          <span className="mt-0.5 block truncate text-[11px] text-ink-faint">
                            {item.hint}
                          </span>
                        ) : null}
                      </span>
                      {index === selected ? (
                        <kbd className="shrink-0 rounded border border-line bg-panel px-1.5 py-0.5 text-[9.5px] text-ink-faint">
                          Enter
                        </kbd>
                      ) : null}
                    </button>
                  );
                })}
              </section>
            ))
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-panel px-4 py-2 text-[10.5px] text-ink-faint">
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5">↑</kbd>
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5">↓</kbd>
            to move
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5">Enter</kbd>
            to open
          </span>
          <span>{rows.length} result{rows.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
