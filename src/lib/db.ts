import type { Conversation, Project, Settings } from '../../shared/types';

const DB_NAME = 'movaryn';
const DB_VERSION = 2;
const CONVERSATIONS = 'conversations';
const PROJECTS = 'projects';
const VERSIONS = 'versions';
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
      if (!db.objectStoreNames.contains(VERSIONS)) {
        const versions = db.createObjectStore(VERSIONS, { keyPath: 'id' });
        versions.createIndex('projectId', 'projectId', { unique: false });
      }
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
    // Resolve on transaction completion, not on put(), so a reload or app close
    // right after a save cannot drop the queued write before it commits.
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(store, 'readwrite');
      const objectStore = transaction.objectStore(store);
      if (key === undefined) objectStore.put(value);
      else objectStore.put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => {
        storageAvailable = false;
        resolve();
      };
      transaction.onabort = () => resolve();
    });
  } catch {
    storageAvailable = false;
  }
}

async function remove(store: string, key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(store, 'readwrite');
      transaction.objectStore(store).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
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
    const transaction = db.transaction([CONVERSATIONS, PROJECTS, VERSIONS, KV], 'readwrite');
    transaction.objectStore(CONVERSATIONS).clear();
    transaction.objectStore(PROJECTS).clear();
    transaction.objectStore(VERSIONS).clear();
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
  void clearProjectVersions(id);
}

// ── Project version history ──────────────────────────────────
export interface ProjectVersion {
  id: string;
  projectId: string;
  createdAt: number;
  label: string;
  project: Project;
}

/** Snapshots are explicit saves; nothing is uploaded or synced. */
export async function saveProjectVersion(
  project: Project,
  label: string,
): Promise<ProjectVersion | null> {
  const db = await openDb();
  if (!db) return null;
  const record: ProjectVersion = {
    id: `ver_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    projectId: project.id,
    createdAt: Date.now(),
    label: label.trim().slice(0, 120) || 'Saved version',
    project: JSON.parse(JSON.stringify(project)) as Project,
  };
  await write(VERSIONS, record);
  const all = await readAll<ProjectVersion>(VERSIONS);
  const forProject = all
    .filter((version) => version.projectId === project.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  for (const extra of forProject.slice(25)) await remove(VERSIONS, extra.id);
  return record;
}

export async function listProjectVersions(projectId: string): Promise<ProjectVersion[]> {
  const all = await readAll<ProjectVersion>(VERSIONS);
  return all
    .filter((version) => version.projectId === projectId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteProjectVersion(id: string): Promise<void> {
  await remove(VERSIONS, id);
}

export async function clearProjectVersions(projectId: string): Promise<void> {
  const all = await readAll<ProjectVersion>(VERSIONS);
  for (const version of all.filter((entry) => entry.projectId === projectId)) {
    await remove(VERSIONS, version.id);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushPersistence();
  });
  window.addEventListener('beforeunload', () => {
    void flushPersistence();
  });
}
