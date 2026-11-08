import type { Conversation, Project, Settings } from '../../shared/types';

const DB_NAME = 'movaryn';
const DB_VERSION = 1;
const CONVERSATIONS = 'conversations';
const PROJECTS = 'projects';
const KV = 'kv';
const SETTINGS_KEY = 'settings';

let dbPromise: Promise<IDBDatabase | null> | null = null;
export let storageAvailable = true;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      storageAvailable = false;
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      storageAvailable = false;
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CONVERSATIONS)) db.createObjectStore(CONVERSATIONS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      storageAvailable = false;
      resolve(null);
    };
    request.onblocked = () => {
      storageAvailable = false;
      resolve(null);
    };
  });
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => resolve(null);
  });
}

async function readAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const transaction = db.transaction(store, 'readonly');
    const result = await requestToPromise(transaction.objectStore(store).getAll());
    return (result as T[] | null) ?? [];
  } catch {
    storageAvailable = false;
    return [];
  }
}

async function write(store: string, value: unknown, key?: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const transaction = db.transaction(store, 'readwrite');
    const objectStore = transaction.objectStore(store);
    if (key === undefined) objectStore.put(value);
    else objectStore.put(value, key);
  } catch {
    storageAvailable = false;
  }
}

async function remove(store: string, key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const transaction = db.transaction(store, 'readwrite');
    transaction.objectStore(store).delete(key);
  } catch {
    // ignored: the in-memory state is still correct
  }
}

async function readSettings(): Promise<Partial<Settings> | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const transaction = db.transaction(KV, 'readonly');
    const result = await requestToPromise(transaction.objectStore(KV).get(SETTINGS_KEY));
    return (result as Partial<Settings> | null) ?? null;
  } catch {
    return null;
  }
}

export interface LoadedState {
  conversations: Conversation[];
  projects: Project[];
  settings: Partial<Settings> | null;
  available: boolean;
}

export async function loadState(): Promise<LoadedState> {
  const [conversations, projects, settings] = await Promise.all([
    readAll<Conversation>(CONVERSATIONS),
    readAll<Project>(PROJECTS),
    readSettings(),
  ]);
  return { conversations, projects, settings, available: storageAvailable };
}

export async function clearAllData(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const transaction = db.transaction([CONVERSATIONS, PROJECTS, KV], 'readwrite');
    transaction.objectStore(CONVERSATIONS).clear();
    transaction.objectStore(PROJECTS).clear();
    transaction.objectStore(KV).clear();
  } catch {
    // ignored
  }
}

// ── Debounced write queue ────────────────────────────────────
const pendingConversations = new Map<string, Conversation>();
const pendingProjects = new Map<string, Project>();
let pendingSettings: Settings | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function schedule(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushPersistence();
  }, 450);
}

export function queueConversation(conversation: Conversation): void {
  pendingConversations.set(conversation.id, conversation);
  schedule();
}

export function queueProject(project: Project): void {
  pendingProjects.set(project.id, project);
  schedule();
}

export function queueSettings(settings: Settings): void {
  pendingSettings = settings;
  schedule();
}

export async function flushPersistence(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const conversations = Array.from(pendingConversations.values());
  const projects = Array.from(pendingProjects.values());
  const settings = pendingSettings;
  pendingConversations.clear();
  pendingProjects.clear();
  pendingSettings = null;

  await Promise.all([
    ...conversations.map((conversation) => write(CONVERSATIONS, conversation)),
    ...projects.map((project) => write(PROJECTS, project)),
    settings ? write(KV, settings, SETTINGS_KEY) : Promise.resolve(),
  ]);
}

export function deleteConversationRecord(id: string): void {
  pendingConversations.delete(id);
  void remove(CONVERSATIONS, id);
}

export function deleteProjectRecord(id: string): void {
  pendingProjects.delete(id);
  void remove(PROJECTS, id);
}

if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushPersistence();
  });
  window.addEventListener('beforeunload', () => {
    void flushPersistence();
  });
}
