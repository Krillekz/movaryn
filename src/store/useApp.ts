import { create } from 'zustand';
import type {
  ChatMessage,
  Conversation,
  GeneratedImage,
  ImageAttachment,
  ImagePromptSpec,
  Project,
  ProviderStatus,
  SavedMove,
  Settings,
} from '../../shared/types';
import {
  clearAllData,
  deleteConversationRecord,
  deleteProjectRecord,
  loadState,
  queueConversation,
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
  | 'provider'
  | 'models'
  | 'prompts'
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
}

export interface AppState {
  hydrated: boolean;
  conversations: Record<string, Conversation>;
  order: string[];
  activeId: string | null;
  projects: Record<string, Project>;
  projectOrder: string[];
  settings: Settings;
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

let hydratePromise: Promise<void> | null = null;

export const useApp = create<AppState>()((set, get) => ({
  hydrated: false,
  conversations: {},
  order: [],
  activeId: null,
  projects: {},
  projectOrder: [],
  settings: DEFAULT_SETTINGS,
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
  },
  toasts: [],
  confirm: null,

  hydrate: async () => {
    if (get().hydrated) return;
    if (hydratePromise) return hydratePromise;

    hydratePromise = (async () => {
      try {
        const loaded = await loadState();
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
      for (const project of loaded.projects) {
        projects[project.id] = project;
      }
      // Drop dangling project links from deleted projects.
      for (const conversation of Object.values(conversations)) {
        if (conversation.projectId && !projects[conversation.projectId]) {
          conversation.projectId = undefined;
        }
      }

      const order = sortByUpdated(conversations);
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        ...(loaded.settings ?? {}),
      };

      set({
        conversations,
        order,
        projects,
        projectOrder: sortByUpdated(projects),
        settings: { ...settings, contextWindow: clamp(Number(settings.contextWindow) || 24, 4, 60) },
        activeId: order[0] ?? null,
        hydrated: true,
      });

        if (!storageAvailable) {
          get().pushToast('Local storage is unavailable — this session will not be saved.', 'danger');
        }
      } catch {
        set({ hydrated: true });
        get().pushToast(
          'Your saved workspace could not be opened. Starting a clean session.',
          'danger',
        );
      }
    })();

    return hydratePromise;
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
      streaming: null,
      confirm: null,
    });
    get().pushToast('All local conversations and projects were deleted.', 'success');
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
