import { create } from 'zustand';
import type {
  AccountUser,
  ChatMessage,
  Conversation,
  GeneratedImage,
  ImageAttachment,
  ImagePromptSpec,
  Notebook,
  NotebookMessage,
  NotebookNote,
  Project,
  ProviderStatus,
  SavedMove,
  Settings,
} from '../../shared/types';
import {
  clearAllData,
  deleteConversationRecord,
  deleteNotebookRecord,
  deleteProjectRecord,
  loadState,
  type LoadedState,
  flushPersistence,
  switchWorkspaceDb,
  queueConversation,
  queueNotebook,
  queueProject,
  queueSettings,
  storageAvailable,
} from '../lib/db';
import { clamp, uid } from '../lib/utils';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  chatModel: '',
  imageModel: '',
  aspect: '3:4',
  imageQuality: '',
  contextWindow: 24,
  attachReferences: true,
  lastImageStyle: '',
  houseRules: '',
  quickKit: false,
  layoutWidth: 'standard',
  layoutDensity: 'comfortable',
  responseStyle: 'balanced',
  responseFormat: 'mixed',
  explainChoices: false,
  accent: 'violet',
  ambience: 'glow',
  corners: 'soft',
  readingFont: 'sans',
  reduceMotion: false,
  sidebarCompact: false,
};

export interface Toast {
  id: string;
  message: string;
  tone: 'default' | 'success' | 'danger';
}

export interface ConfirmRequest {
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

export interface ImageBriefState {
  open: boolean;
  spec: ImagePromptSpec | null;
  mode: 'new' | 'revise';
  conversationId?: string;
  messageId?: string;
}

export type SettingsTabId =
  | 'account'
  | 'provider'
  | 'models'
  | 'prompts'
  | 'layout'
  | 'appearance'
  | 'data'
  | 'credits'
  | 'about';

export type ToolsTabId = 'brief' | 'sandbox' | 'remap' | 'history' | 'compare';

interface UiState {
  sidebarCollapsed: boolean;
  mobileSidebar: boolean;
  search: string;
  /** Composer text, kept here so starter cards can prefill it and drafts survive failures. */
  draft: string;
  settingsOpen: boolean;
  projectId: string | null;
  imageBrief: ImageBriefState;
  ideasOpen: boolean;
  settingsTab: SettingsTabId;
  paletteOpen: boolean;
  whatsNewOpen: boolean;
  toolsOpen: boolean;
  toolsTab: ToolsTabId;
  notebookOpen: boolean;
  accountOpen: boolean;
}

export interface AppState {
  hydrated: boolean;
  conversations: Record<string, Conversation>;
  order: string[];
  activeId: string | null;
  projects: Record<string, Project>;
  projectOrder: string[];
  notebooks: Record<string, Notebook>;
  notebookOrder: string[];
  activeNotebookId: string | null;
  settings: Settings;
  account: AccountUser | null;
  accountState: 'loading' | 'ready' | 'offline';
  hasLocalAccounts: boolean;
  workspaceOwner: string | null;
  provider: ProviderStatus | null;
  providerError: string | null;
  streaming: { conversationId: string; messageId: string } | null;
  ui: UiState;
  toasts: Toast[];
  confirm: ConfirmRequest | null;

  hydrate: () => Promise<void>;
  setProvider: (provider: ProviderStatus | null, error?: string | null) => void;
  newConversation: (projectId?: string) => string;
  setActive: (id: string | null) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  assignProject: (conversationId: string, projectId: string | undefined) => void;
  appendMessage: (conversationId: string, message: ChatMessage) => void;
  patchMessage: (conversationId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  truncateFrom: (conversationId: string, index: number) => void;
  setSummary: (conversationId: string, summary: string, cursor: number) => void;
  setStreaming: (value: AppState['streaming']) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  setAccount: (account: AccountUser | null) => void;
  setAccountState: (state: AppState['accountState']) => void;
  setHasLocalAccounts: (value: boolean) => void;
  switchWorkspace: (ownerId: string | null, force?: boolean) => Promise<void>;
  openAccount: () => void;
  closeAccount: () => void;

  createProject: (
    seed?: Partial<Pick<Project, 'name' | 'game' | 'theme' | 'description'>>,
    options?: { open?: boolean },
  ) => string;
  updateProject: (id: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>) => void;
  deleteProject: (id: string) => void;
  addProjectMove: (projectId: string, move: Omit<SavedMove, 'id' | 'createdAt'>) => void;
  removeProjectMove: (projectId: string, moveId: string) => void;
  addProjectImages: (projectId: string, images: GeneratedImage[]) => void;
  addProjectReference: (projectId: string, reference: ImageAttachment) => void;
  removeProjectReference: (projectId: string, referenceId: string) => void;

  createNotebook: () => string;
  updateNotebook: (id: string, patch: Partial<Pick<Notebook, 'title'>>) => void;
  deleteNotebook: (id: string) => void;
  setActiveNotebook: (id: string) => void;
  addNotebookSource: (id: string, source: { title: string; text: string; url?: string }) => void;
  removeNotebookSource: (id: string, sourceId: string) => void;
  appendNotebookMessage: (id: string, message: NotebookMessage) => void;
  patchNotebookMessage: (id: string, messageId: string, patch: Partial<NotebookMessage>) => void;
  addNotebookNote: (id: string, note: Omit<NotebookNote, 'id' | 'createdAt'>) => void;
  removeNotebookNote: (id: string, noteId: string) => void;
  openNotebook: () => void;
  closeNotebook: () => void;

  setSearch: (value: string) => void;
  setDraft: (value: string) => void;
  setSidebarCollapsed: (value: boolean) => void;
  setMobileSidebar: (value: boolean) => void;
  openSettings: (tab?: SettingsTabId) => void;
  closeSettings: () => void;
  setSettingsTab: (tab: SettingsTabId) => void;
  openPalette: () => void;
  closePalette: () => void;
  openWhatsNew: () => void;
  closeWhatsNew: () => void;
  openProject: (id: string) => void;
  closeProject: () => void;
  openImageBrief: (options?: { spec?: ImagePromptSpec; conversationId?: string; messageId?: string }) => void;
  closeImageBrief: () => void;
  openIdeas: () => void;
  closeIdeas: () => void;
  openTools: (tab?: ToolsTabId) => void;
  closeTools: () => void;
  setToolsTab: (tab: ToolsTabId) => void;

  pushToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
  requestConfirm: (request: ConfirmRequest) => void;
  closeConfirm: () => void;
  resetAllData: () => Promise<void>;
}

const SIDEBAR_KEY = 'movaryn:sidebar-collapsed';

function readSidebarPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSidebarPreference(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  } catch {
    // preference is not critical
  }
}

function sortByUpdated<T extends { id: string; updatedAt: number }>(record: Record<string, T>): string[] {
  return Object.values(record)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((item) => item.id);
}

function workspaceState(loaded: LoadedState, ownerId: string | null): Partial<AppState> {
  const conversations: Record<string, Conversation> = {};
  for (const conversation of loaded.conversations) {
    conversations[conversation.id] = {
      ...conversation,
      messages: (conversation.messages ?? []).map((message) =>
        message.status === 'streaming'
          ? { ...message, status: 'complete' as const, stopped: true }
          : message,
      ),
    };
  }
  const projects: Record<string, Project> = {};
  for (const project of loaded.projects) projects[project.id] = project;
  const notebooks: Record<string, Notebook> = {};
  for (const notebook of loaded.notebooks ?? []) {
    notebooks[notebook.id] = {
      ...notebook,
      sources: notebook.sources ?? [],
      messages: (notebook.messages ?? []).map((message) =>
        message.status === 'streaming'
          ? { ...message, status: 'complete' as const }
          : message,
      ),
      notes: notebook.notes ?? [],
    };
  }
  for (const conversation of Object.values(conversations)) {
    if (conversation.projectId && !projects[conversation.projectId]) {
      conversation.projectId = undefined;
    }
  }
  const order = sortByUpdated(conversations);
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(loaded.settings ?? {}) };
  return {
    conversations,
    order,
    projects,
    projectOrder: sortByUpdated(projects),
    notebooks,
    notebookOrder: sortByUpdated(notebooks),
    activeNotebookId: sortByUpdated(notebooks)[0] ?? null,
    settings: { ...settings, contextWindow: clamp(Number(settings.contextWindow) || 24, 4, 60) },
    activeId: order[0] ?? null,
    hydrated: true,
    workspaceOwner: ownerId,
  };
}

let hydratePromise: Promise<void> | null = null;

export const useApp = create<AppState>()((set, get) => ({
  hydrated: false,
  conversations: {},
  order: [],
  activeId: null,
  projects: {},
  projectOrder: [],
  notebooks: {},
  notebookOrder: [],
  activeNotebookId: null,
  settings: DEFAULT_SETTINGS,
  account: null,
  accountState: 'loading',
  hasLocalAccounts: false,
  workspaceOwner: null,
  provider: null,
  providerError: null,
  streaming: null,
  ui: {
    sidebarCollapsed: readSidebarPreference(),
    mobileSidebar: false,
    search: '',
    draft: '',
    settingsOpen: false,
    projectId: null,
    imageBrief: { open: false, spec: null, mode: 'new' },
    ideasOpen: false,
    settingsTab: 'provider',
    paletteOpen: false,
    whatsNewOpen: false,
    toolsOpen: false,
    toolsTab: 'brief',
    notebookOpen: false,
    accountOpen: false,
  },
  toasts: [],
  confirm: null,

  hydrate: async () => {
    if (get().hydrated) return;
    if (hydratePromise) return hydratePromise;
    const ownerId = get().account?.id ?? null;
    hydratePromise = get()
      .switchWorkspace(ownerId)
      .finally(() => {
        hydratePromise = null;
      });
    return hydratePromise;
  },

  switchWorkspace: async (ownerId, force = false) => {
    if (!force && get().workspaceOwner === ownerId && get().hydrated) return;
    hydratePromise = null;
    await flushPersistence();
    await switchWorkspaceDb(ownerId);
    set({
      conversations: {},
      order: [],
      activeId: null,
      projects: {},
      projectOrder: [],
      notebooks: {},
      notebookOrder: [],
      activeNotebookId: null,
      streaming: null,
      hydrated: false,
      workspaceOwner: ownerId,
    });
    try {
      const loaded = await loadState();
      set(workspaceState(loaded, ownerId));
      if (!storageAvailable) {
        get().pushToast('Local storage is unavailable — this session will not be saved.', 'danger');
      }
    } catch {
      set({ hydrated: true });
      get().pushToast(
        'This workspace could not be opened. Starting a clean session.',
        'danger',
      );
    }
  },

  setProvider: (provider, error = null) => set({ provider, providerError: error }),

  newConversation: (projectId) => {
    const now = Date.now();
    const conversation: Conversation = {
      id: uid('conv'),
      title: '',
      createdAt: now,
      updatedAt: now,
      projectId,
      messages: [],
      summary: '',
      summaryCursor: 0,
    };
    set((state) => ({
      conversations: { ...state.conversations, [conversation.id]: conversation },
      order: [conversation.id, ...state.order],
      activeId: conversation.id,
      ui: { ...state.ui, mobileSidebar: false },
    }));
    queueConversation(conversation);
    return conversation.id;
  },

  setActive: (id) =>
    set((state) => ({ activeId: id, ui: { ...state.ui, mobileSidebar: false } })),

  deleteConversation: (id) => {
    const state = get();
    const conversations = { ...state.conversations };
    delete conversations[id];
    const order = state.order.filter((item) => item !== id);
    const activeId = state.activeId === id ? (order[0] ?? null) : state.activeId;
    set({ conversations, order, activeId });
    deleteConversationRecord(id);
  },

  renameConversation: (id, title) => {
    const conversation = get().conversations[id];
    if (!conversation) return;
    const next = { ...conversation, title: title.trim().slice(0, 90), updatedAt: Date.now() };
    set((state) => ({ conversations: { ...state.conversations, [id]: next } }));
    queueConversation(next);
  },

  assignProject: (conversationId, projectId) => {
    const conversation = get().conversations[conversationId];
    if (!conversation) return;
    const next = { ...conversation, projectId, updatedAt: Date.now() };
    set((state) => ({ conversations: { ...state.conversations, [conversationId]: next } }));
    queueConversation(next);
  },

  appendMessage: (conversationId, message) => {
    const state = get();
    const conversation = state.conversations[conversationId];
    if (!conversation) return;
    const next: Conversation = {
      ...conversation,
      messages: [...conversation.messages, message],
      updatedAt: Date.now(),
    };
    set({
      conversations: { ...state.conversations, [conversationId]: next },
      order: [conversationId, ...state.order.filter((id) => id !== conversationId)],
    });
    queueConversation(next);
  },

  patchMessage: (conversationId, messageId, patch) => {
    const state = get();
    const conversation = state.conversations[conversationId];
    if (!conversation) return;
    let changed = false;
    const messages = conversation.messages.map((message) => {
      if (message.id !== messageId) return message;
      changed = true;
      return { ...message, ...patch };
    });
    if (!changed) return;
    const next = { ...conversation, messages, updatedAt: Date.now() };
    set({ conversations: { ...state.conversations, [conversationId]: next } });
    queueConversation(next);
  },

  truncateFrom: (conversationId, index) => {
    const state = get();
    const conversation = state.conversations[conversationId];
    if (!conversation) return;
    const messages = conversation.messages.slice(0, Math.max(0, index));
    const cursor = conversation.summaryCursor ?? 0;
    const next: Conversation = {
      ...conversation,
      messages,
      updatedAt: Date.now(),
      ...(cursor > messages.length ? { summary: '', summaryCursor: 0 } : {}),
    };
    set({ conversations: { ...state.conversations, [conversationId]: next } });
    queueConversation(next);
  },

  setSummary: (conversationId, summary, cursor) => {
    const state = get();
    const conversation = state.conversations[conversationId];
    if (!conversation) return;
    const next: Conversation = {
      ...conversation,
      summary: summary.slice(0, 12_000),
      summaryCursor: Math.min(cursor, conversation.messages.length),
    };
    set({ conversations: { ...state.conversations, [conversationId]: next } });
    queueConversation(next);
  },

  setStreaming: (streaming) => set({ streaming }),

  updateSettings: (patch) => {
    const next: Settings = {
      ...get().settings,
      ...patch,
    };
    next.contextWindow = clamp(Number(next.contextWindow) || 24, 4, 60);
    set({ settings: next });
    queueSettings(next);
  },

  setAccount: (account) => set({ account }),
  setAccountState: (accountState) => set({ accountState }),
  setHasLocalAccounts: (hasLocalAccounts) => set({ hasLocalAccounts }),
  openAccount: () =>
    set((state) => ({
      ui: { ...state.ui, accountOpen: true, settingsOpen: false, mobileSidebar: false },
    })),
  closeAccount: () => set((state) => ({ ui: { ...state.ui, accountOpen: false } })),

  createProject: (seed, options) => {
    const now = Date.now();
    const project: Project = {
      id: uid('prj'),
      name: seed?.name?.trim() || 'Untitled character',
      game: seed?.game?.trim() || '',
      theme: seed?.theme?.trim() || '',
      description: seed?.description?.trim() || '',
      constraints: '',
      moves: [],
      references: [],
      images: [],
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      projects: { ...state.projects, [project.id]: project },
      projectOrder: [project.id, ...state.projectOrder],
      ui: { ...state.ui, projectId: options?.open === false ? state.ui.projectId : project.id },
    }));
    queueProject(project);
    return project.id;
  },

  updateProject: (id, patch) => {
    const project = get().projects[id];
    if (!project) return;
    const next: Project = { ...project, ...patch, updatedAt: Date.now() };
    set((state) => ({ projects: { ...state.projects, [id]: next } }));
    queueProject(next);
  },

  deleteProject: (id) => {
    const state = get();
    const projects = { ...state.projects };
    delete projects[id];
    const projectOrder = state.projectOrder.filter((item) => item !== id);
    const conversations = { ...state.conversations };
    const changed: Conversation[] = [];
    for (const conversation of Object.values(conversations)) {
      if (conversation.projectId === id) {
        const next = { ...conversation, projectId: undefined };
        conversations[conversation.id] = next;
        changed.push(next);
      }
    }
    set({
      projects,
      projectOrder,
      conversations,
      ui: { ...state.ui, projectId: null },
    });
    deleteProjectRecord(id);
    changed.forEach(queueConversation);
  },

  addProjectMove: (projectId, move) => {
    const project = get().projects[projectId];
    if (!project) return;
    const name = move.name.trim();
    if (!name) return;
    const existingIndex = project.moves.findIndex(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );
    const saved: SavedMove = {
      id: existingIndex >= 0 ? project.moves[existingIndex].id : uid('move'),
      name,
      description: move.description.trim(),
      purpose: move.purpose?.trim() || undefined,
      source: move.source,
      createdAt: existingIndex >= 0 ? project.moves[existingIndex].createdAt : Date.now(),
    };
    const moves =
      existingIndex >= 0
        ? project.moves.map((item, index) => (index === existingIndex ? saved : item))
        : [...project.moves, saved];
    get().updateProject(projectId, { moves });
  },

  removeProjectMove: (projectId, moveId) => {
    const project = get().projects[projectId];
    if (!project) return;
    get().updateProject(projectId, { moves: project.moves.filter((move) => move.id !== moveId) });
  },

  addProjectImages: (projectId, images) => {
    const project = get().projects[projectId];
    if (!project || images.length === 0) return;
    const seen = new Set(project.images.map((image) => image.id));
    const merged = [...project.images, ...images.filter((image) => !seen.has(image.id))];
    get().updateProject(projectId, { images: merged });
  },

  addProjectReference: (projectId, reference) => {
    const project = get().projects[projectId];
    if (!project) return;
    get().updateProject(projectId, { references: [...project.references, reference] });
  },

  removeProjectReference: (projectId, referenceId) => {
    const project = get().projects[projectId];
    if (!project) return;
    get().updateProject(projectId, {
      references: project.references.filter((reference) => reference.id !== referenceId),
    });
  },

  createNotebook: () => {
    const now = Date.now();
    const notebook: Notebook = {
      id: uid('nb'),
      title: 'Untitled notebook',
      sources: [],
      messages: [],
      notes: [],
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      notebooks: { ...state.notebooks, [notebook.id]: notebook },
      notebookOrder: [notebook.id, ...state.notebookOrder],
      activeNotebookId: notebook.id,
    }));
    queueNotebook(notebook);
    return notebook.id;
  },

  updateNotebook: (id, patch) => {
    const notebook = get().notebooks[id];
    if (!notebook) return;
    const next: Notebook = {
      ...notebook,
      ...patch,
      ...(patch.title !== undefined ? { title: patch.title.trim().slice(0, 90) || 'Untitled notebook' } : {}),
      updatedAt: Date.now(),
    };
    set((state) => ({
      notebooks: { ...state.notebooks, [id]: next },
      notebookOrder: [id, ...state.notebookOrder.filter((item) => item !== id)],
    }));
    queueNotebook(next);
  },

  deleteNotebook: (id) => {
    const state = get();
    const notebooks = { ...state.notebooks };
    delete notebooks[id];
    const notebookOrder = state.notebookOrder.filter((item) => item !== id);
    set({
      notebooks,
      notebookOrder,
      activeNotebookId:
        state.activeNotebookId === id ? (notebookOrder[0] ?? null) : state.activeNotebookId,
    });
    deleteNotebookRecord(id);
  },

  setActiveNotebook: (id) => set({ activeNotebookId: id }),

  addNotebookSource: (id, source) => {
    const notebook = get().notebooks[id];
    const text = source.text.trim();
    if (!notebook || !text) return;
    if (notebook.sources.length >= 12) {
      get().pushToast('A notebook holds up to 12 sources. Remove one to add another.', 'danger');
      return;
    }
    const existingChars = notebook.sources.reduce((sum, item) => sum + item.text.length, 0);
    if (existingChars + text.length > 120_000) {
      get().pushToast('This notebook is full (120,000 characters across its sources).', 'danger');
      return;
    }
    const entry = {
      id: uid('src'),
      title: source.title.trim().slice(0, 140) || 'Untitled source',
      text: text.slice(0, 20_000),
      url: source.url?.trim().slice(0, 500) || undefined,
      createdAt: Date.now(),
    };
    const current = get().notebooks[id];
    if (!current) return;
    const next: Notebook = {
      ...current,
      sources: [...current.sources, entry],
      updatedAt: Date.now(),
    };
    set((state) => ({ notebooks: { ...state.notebooks, [id]: next } }));
    queueNotebook(next);
  },

  removeNotebookSource: (id, sourceId) => {
    const notebook = get().notebooks[id];
    if (!notebook) return;
    const next: Notebook = {
      ...notebook,
      sources: notebook.sources.filter((source) => source.id !== sourceId),
      updatedAt: Date.now(),
    };
    set((state) => ({ notebooks: { ...state.notebooks, [id]: next } }));
    queueNotebook(next);
  },

  appendNotebookMessage: (id, message) => {
    const notebook = get().notebooks[id];
    if (!notebook) return;
    const next: Notebook = {
      ...notebook,
      messages: [...notebook.messages, message],
      updatedAt: Date.now(),
    };
    set((state) => ({
      notebooks: { ...state.notebooks, [id]: next },
      notebookOrder: [id, ...state.notebookOrder.filter((item) => item !== id)],
    }));
    queueNotebook(next);
  },

  patchNotebookMessage: (id, messageId, patch) => {
    const notebook = get().notebooks[id];
    if (!notebook) return;
    let changed = false;
    const messages = notebook.messages.map((message) => {
      if (message.id !== messageId) return message;
      changed = true;
      return { ...message, ...patch };
    });
    if (!changed) return;
    const next: Notebook = { ...notebook, messages, updatedAt: Date.now() };
    set((state) => ({ notebooks: { ...state.notebooks, [id]: next } }));
    queueNotebook(next);
  },

  addNotebookNote: (id, note) => {
    const notebook = get().notebooks[id];
    if (!notebook) return;
    const next: Notebook = {
      ...notebook,
      notes: [
        { ...note, id: uid('note'), createdAt: Date.now() },
        ...notebook.notes,
      ],
      updatedAt: Date.now(),
    };
    set((state) => ({ notebooks: { ...state.notebooks, [id]: next } }));
    queueNotebook(next);
  },

  removeNotebookNote: (id, noteId) => {
    const notebook = get().notebooks[id];
    if (!notebook) return;
    const next: Notebook = {
      ...notebook,
      notes: notebook.notes.filter((note) => note.id !== noteId),
      updatedAt: Date.now(),
    };
    set((state) => ({ notebooks: { ...state.notebooks, [id]: next } }));
    queueNotebook(next);
  },

  openNotebook: () => {
    const state = get();
    let id =
      state.activeNotebookId && state.notebooks[state.activeNotebookId]
        ? state.activeNotebookId
        : (state.notebookOrder.find((item) => state.notebooks[item]) ?? null);
    if (!id) id = get().createNotebook();
    set((current) => ({
      activeNotebookId: id,
      ui: { ...current.ui, notebookOpen: true, mobileSidebar: false },
    }));
  },

  closeNotebook: () => set((state) => ({ ui: { ...state.ui, notebookOpen: false } })),


  setSearch: (value) => set((state) => ({ ui: { ...state.ui, search: value } })),

  setDraft: (value) => set((state) => ({ ui: { ...state.ui, draft: value } })),

  setSidebarCollapsed: (value) => {
    writeSidebarPreference(value);
    set((state) => ({ ui: { ...state.ui, sidebarCollapsed: value } }));
  },

  setMobileSidebar: (value) => set((state) => ({ ui: { ...state.ui, mobileSidebar: value } })),

  openSettings: (tab) =>
    set((state) => ({
      ui: {
        ...state.ui,
        settingsOpen: true,
        ...(tab ? { settingsTab: tab } : {}),
      },
    })),
  closeSettings: () => set((state) => ({ ui: { ...state.ui, settingsOpen: false } })),
  setSettingsTab: (tab) => set((state) => ({ ui: { ...state.ui, settingsTab: tab } })),

  openPalette: () => set((state) => ({ ui: { ...state.ui, paletteOpen: true } })),
  closePalette: () => set((state) => ({ ui: { ...state.ui, paletteOpen: false } })),

  openWhatsNew: () => set((state) => ({ ui: { ...state.ui, whatsNewOpen: true } })),
  closeWhatsNew: () => set((state) => ({ ui: { ...state.ui, whatsNewOpen: false } })),

  openProject: (id) => set((state) => ({ ui: { ...state.ui, projectId: id } })),
  closeProject: () => set((state) => ({ ui: { ...state.ui, projectId: null } })),

  openImageBrief: (options) =>
    set((state) => ({
      ui: {
        ...state.ui,
        imageBrief: {
          open: true,
          spec: options?.spec ?? null,
          mode: options?.messageId ? 'revise' : 'new',
          conversationId: options?.conversationId ?? state.activeId ?? undefined,
          messageId: options?.messageId,
        },
      },
    })),

  closeImageBrief: () =>
    set((state) => ({ ui: { ...state.ui, imageBrief: { open: false, spec: null, mode: 'new' } } })),

  openIdeas: () => set((state) => ({ ui: { ...state.ui, ideasOpen: true } })),
  closeIdeas: () => set((state) => ({ ui: { ...state.ui, ideasOpen: false } })),

  openTools: (tab) =>
    set((state) => ({
      ui: {
        ...state.ui,
        toolsOpen: true,
        ...(tab ? { toolsTab: tab } : {}),
      },
    })),
  closeTools: () => set((state) => ({ ui: { ...state.ui, toolsOpen: false } })),
  setToolsTab: (tab) => set((state) => ({ ui: { ...state.ui, toolsTab: tab } })),

  pushToast: (message, tone = 'default') => {
    const id = uid('toast');
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
    setTimeout(() => get().dismissToast(id), 3_400);
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  requestConfirm: (request) => set({ confirm: request }),
  closeConfirm: () => set({ confirm: null }),

  resetAllData: async () => {
    await clearAllData();
    set({
      conversations: {},
      order: [],
      activeId: null,
      projects: {},
      projectOrder: [],
      notebooks: {},
      notebookOrder: [],
      activeNotebookId: null,
      streaming: null,
      confirm: null,
    });
    get().pushToast('All local conversations, projects and notebooks were deleted.', 'success');
  },
}));

// ── Selectors and derived helpers ────────────────────────────

export function selectActiveConversation(state: AppState): Conversation | null {
  return state.activeId ? (state.conversations[state.activeId] ?? null) : null;
}

export function useActiveConversation(): Conversation | null {
  return useApp((state) => (state.activeId ? (state.conversations[state.activeId] ?? null) : null));
}

export function useActiveProject(): Project | null {
  return useApp((state) => {
    const conversation = state.activeId ? state.conversations[state.activeId] : null;
    return conversation?.projectId ? (state.projects[conversation.projectId] ?? null) : null;
  });
}

export function useIsStreaming(): boolean {
  return useApp((state) => state.streaming !== null);
}

export function projectConversations(state: AppState, projectId: string): Conversation[] {
  return state.order
    .map((id) => state.conversations[id])
    .filter((conversation): conversation is Conversation => Boolean(conversation) && conversation.projectId === projectId);
}
