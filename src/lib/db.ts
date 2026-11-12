import type { Conversation, Notebook, Project, ResearchFact, Settings } from '../../shared/types';

const GUEST_DB_NAME = 'movaryn';
const ACCOUNT_DB_PREFIX = 'movaryn-account-';
const DB_VERSION = 4;
const CONVERSATIONS = 'conversations';
const PROJECTS = 'projects';
const VERSIONS = 'versions';
const RESEARCH = 'research';
const NOTEBOOKS = 'notebooks';
const KV = 'kv';
const SETTINGS_KEY = 'settings';

let dbPromise: Promise<IDBDatabase | null> | null = null;
let currentOwnerId: string | null = null;
let currentDbName = GUEST_DB_NAME;
export let storageAvailable = true;

function workspaceDbName(ownerId: string | null): string {
  return ownerId ? `${ACCOUNT_DB_PREFIX}${ownerId}` : GUEST_DB_NAME;
}

function ensureSchema(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(CONVERSATIONS)) db.createObjectStore(CONVERSATIONS, { keyPath: 'id' });
  if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: 'id' });
  if (!db.objectStoreNames.contains(VERSIONS)) {
    const versions = db.createObjectStore(VERSIONS, { keyPath: 'id' });
    versions.createIndex('projectId', 'projectId', { unique: false });
  }
  if (!db.objectStoreNames.contains(RESEARCH)) db.createObjectStore(RESEARCH, { keyPath: 'key' });
  if (!db.objectStoreNames.contains(NOTEBOOKS)) db.createObjectStore(NOTEBOOKS, { keyPath: 'id' });
  if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
}

function openNamedDb(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: IDBDatabase | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    if (typeof indexedDB === 'undefined') {
      storageAvailable = false;
      finish(null);
      return;
    }
    // A second tab can hold an older database version open and block an upgrade.
    // Start the app read-only instead of leaving the workspace on its loading screen.
    const timeout = setTimeout(() => {
      storageAvailable = false;
      finish(null);
    }, 3_000);
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(name, DB_VERSION);
    } catch {
      clearTimeout(timeout);
      storageAvailable = false;
      finish(null);
      return;
    }
    request.onupgradeneeded = () => ensureSchema(request.result);
    request.onsuccess = () => {
      clearTimeout(timeout);
      const db = request.result;
      if (settled) {
        db.close();
        return;
      }
      // Let a future version upgrade proceed instead of blocking it from this tab.
      db.onversionchange = () => db.close();
      finish(db);
    };
    request.onerror = () => {
      clearTimeout(timeout);
      storageAvailable = false;
      finish(null);
    };
    request.onblocked = () => {
      clearTimeout(timeout);
      storageAvailable = false;
      finish(null);
    };
  });
}

function openDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) dbPromise = openNamedDb(currentDbName);
  return dbPromise;
}

/** Close the active workspace connection and point the DB helpers at another account. */
export async function switchWorkspaceDb(ownerId: string | null): Promise<void> {
  const nextName = workspaceDbName(ownerId);
  if (nextName === currentDbName && dbPromise) return;
  if (dbPromise) {
    const db = await dbPromise;
    db?.close();
  }
  dbPromise = null;
  currentOwnerId = ownerId;
  currentDbName = nextName;
}

export function activeWorkspaceOwner(): string | null {
  return currentOwnerId;
}

/** Remove an account's database after its sign-in has been deleted. */
export async function deleteWorkspaceDb(ownerId: string): Promise<void> {
  const name = workspaceDbName(ownerId);
  if (name === currentDbName) await switchWorkspaceDb(null);
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => resolve(null);
  });
}

async function readAllFromDb<T>(db: IDBDatabase, store: string): Promise<T[]> {
  try {
    const transaction = db.transaction(store, 'readonly');
    const result = await requestToPromise(transaction.objectStore(store).getAll());
    return (result as T[] | null) ?? [];
  } catch {
    return [];
  }
}

async function readKvFromDb(db: IDBDatabase): Promise<{ key: IDBValidKey; value: unknown }[]> {
  try {
    const transaction = db.transaction(KV, 'readonly');
    const store = transaction.objectStore(KV);
    // Queue both requests before awaiting so the transaction cannot auto-commit
    // between them.
    const keysRequest = store.getAllKeys();
    const valuesRequest = store.getAll();
    const [keys, values] = await Promise.all([
      requestToPromise(keysRequest),
      requestToPromise(valuesRequest),
    ]);
    return (keys ?? []).map((key, index) => ({ key, value: values?.[index] }));
  } catch {
    return [];
  }
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
  notebooks: Notebook[];
  settings: Partial<Settings> | null;
  available: boolean;
}

export async function loadState(): Promise<LoadedState> {
  const [conversations, projects, notebooks, settings] = await Promise.all([
    readAll<Conversation>(CONVERSATIONS),
    readAll<Project>(PROJECTS),
    readAll<Notebook>(NOTEBOOKS),
    readSettings(),
  ]);
  return { conversations, projects, notebooks, settings, available: storageAvailable };
}

export interface WorkspaceSummary {
  conversations: number;
  projects: number;
  notebooks: number;
  total: number;
}

async function summaryFromDb(db: IDBDatabase): Promise<WorkspaceSummary> {
  const count = async (store: string): Promise<number> => {
    try {
      const transaction = db.transaction(store, 'readonly');
      return (await requestToPromise(transaction.objectStore(store).count())) ?? 0;
    } catch {
      return 0;
    }
  };
  const [conversations, projects, notebooks] = await Promise.all([
    count(CONVERSATIONS),
    count(PROJECTS),
    count(NOTEBOOKS),
  ]);
  return { conversations, projects, notebooks, total: conversations + projects + notebooks };
}

export async function workspaceSummary(ownerId: string | null): Promise<WorkspaceSummary> {
  const db = await openNamedDb(workspaceDbName(ownerId));
  if (!db) return { conversations: 0, projects: 0, notebooks: 0, total: 0 };
  const summary = await summaryFromDb(db);
  db.close();
  return summary;
}

export interface WorkspaceCopyResult {
  copied: boolean;
  reason?: 'not-empty' | 'unavailable';
  summary: WorkspaceSummary;
}

/** Copy the guest workspace into an empty account workspace without touching the guest copy. */
export async function copyGuestWorkspaceToAccount(accountId: string): Promise<WorkspaceCopyResult> {
  const source = await openNamedDb(GUEST_DB_NAME);
  const target = await openNamedDb(workspaceDbName(accountId));
  if (!source || !target) {
    source?.close();
    target?.close();
    return {
      copied: false,
      reason: 'unavailable',
      summary: { conversations: 0, projects: 0, notebooks: 0, total: 0 },
    };
  }

  try {
    const targetSummary = await summaryFromDb(target);
    if (targetSummary.total > 0) {
      return { copied: false, reason: 'not-empty', summary: targetSummary };
    }
    const [conversations, projects, notebooks, versions, research, kv] = await Promise.all([
      readAllFromDb<Conversation>(source, CONVERSATIONS),
      readAllFromDb<Project>(source, PROJECTS),
      readAllFromDb<Notebook>(source, NOTEBOOKS),
      readAllFromDb<ProjectVersion>(source, VERSIONS),
      readAllFromDb<ResearchCacheEntry>(source, RESEARCH),
      readKvFromDb(source),
    ]);

    await new Promise<void>((resolve) => {
      const transaction = target.transaction(
        [CONVERSATIONS, PROJECTS, VERSIONS, RESEARCH, NOTEBOOKS, KV],
        'readwrite',
      );
      for (const record of conversations) transaction.objectStore(CONVERSATIONS).put(record);
      for (const record of projects) transaction.objectStore(PROJECTS).put(record);
      for (const record of notebooks) transaction.objectStore(NOTEBOOKS).put(record);
      for (const record of versions) transaction.objectStore(VERSIONS).put(record);
      for (const record of research) transaction.objectStore(RESEARCH).put(record);
      for (const entry of kv) transaction.objectStore(KV).put(entry.value, entry.key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });

    return { copied: true, summary: await summaryFromDb(target) };
  } finally {
    source.close();
    target.close();
  }
}

export interface WorkspaceSnapshot {
  settings: Partial<Settings> | null;
  conversations: Conversation[];
  projects: Project[];
  notebooks: Notebook[];
  versions: ProjectVersion[];
  research: ResearchCacheEntry[];
}

export async function exportWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const db = await openDb();
  if (!db) {
    return { settings: null, conversations: [], projects: [], notebooks: [], versions: [], research: [] };
  }
  const [conversations, projects, notebooks, versions, research, settings] = await Promise.all([
    readAllFromDb<Conversation>(db, CONVERSATIONS),
    readAllFromDb<Project>(db, PROJECTS),
    readAllFromDb<Notebook>(db, NOTEBOOKS),
    readAllFromDb<ProjectVersion>(db, VERSIONS),
    readAllFromDb<ResearchCacheEntry>(db, RESEARCH),
    readSettings(),
  ]);
  return { settings, conversations, projects, notebooks, versions, research };
}

export async function importWorkspaceSnapshot(snapshot: WorkspaceSnapshot): Promise<void> {
  await clearAllData();
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(
      [CONVERSATIONS, PROJECTS, VERSIONS, RESEARCH, NOTEBOOKS, KV],
      'readwrite',
    );
    for (const record of snapshot.conversations ?? []) transaction.objectStore(CONVERSATIONS).put(record);
    for (const record of snapshot.projects ?? []) transaction.objectStore(PROJECTS).put(record);
    for (const record of snapshot.notebooks ?? []) transaction.objectStore(NOTEBOOKS).put(record);
    for (const record of snapshot.versions ?? []) transaction.objectStore(VERSIONS).put(record);
    for (const record of snapshot.research ?? []) transaction.objectStore(RESEARCH).put(record);
    if (snapshot.settings) transaction.objectStore(KV).put(snapshot.settings, SETTINGS_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

export async function clearAllData(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  pendingConversations.clear();
  pendingProjects.clear();
  pendingNotebooks.clear();
  pendingSettings = null;
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(
        [CONVERSATIONS, PROJECTS, VERSIONS, RESEARCH, NOTEBOOKS, KV],
        'readwrite',
      );
      transaction.objectStore(CONVERSATIONS).clear();
      transaction.objectStore(PROJECTS).clear();
      transaction.objectStore(VERSIONS).clear();
      transaction.objectStore(RESEARCH).clear();
      transaction.objectStore(NOTEBOOKS).clear();
      transaction.objectStore(KV).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  } catch {
    // ignored
  }
}

// ── Debounced write queue ────────────────────────────────────
const pendingConversations = new Map<string, Conversation>();
const pendingProjects = new Map<string, Project>();
const pendingNotebooks = new Map<string, Notebook>();
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

export function queueNotebook(notebook: Notebook): void {
  pendingNotebooks.set(notebook.id, notebook);
  schedule();
}

export async function flushPersistence(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const conversations = Array.from(pendingConversations.values());
  const projects = Array.from(pendingProjects.values());
  const notebooks = Array.from(pendingNotebooks.values());
  const settings = pendingSettings;
  pendingConversations.clear();
  pendingProjects.clear();
  pendingNotebooks.clear();
  pendingSettings = null;

  await Promise.all([
    ...conversations.map((conversation) => write(CONVERSATIONS, conversation)),
    ...projects.map((project) => write(PROJECTS, project)),
    ...notebooks.map((notebook) => write(NOTEBOOKS, notebook)),
    settings ? write(KV, settings, SETTINGS_KEY) : Promise.resolve(),
  ]);
}

export function deleteConversationRecord(id: string): void {
  pendingConversations.delete(id);
  void remove(CONVERSATIONS, id);
}

export function deleteNotebookRecord(id: string): void {
  pendingNotebooks.delete(id);
  void remove(NOTEBOOKS, id);
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

// ── Local research cache ────────────────────────────────────
export interface ResearchCacheEntry {
  key: string;
  character: string;
  series?: string;
  version?: string;
  game?: string;
  facts: ResearchFact[];
  createdAt: number;
}

/** Cached lookups stay on this device; nothing is uploaded or shared. */
export async function getResearchCache(key: string): Promise<ResearchCacheEntry | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const transaction = db.transaction(RESEARCH, 'readonly');
    const result = await requestToPromise(transaction.objectStore(RESEARCH).get(key));
    return (result as ResearchCacheEntry | null) ?? null;
  } catch {
    return null;
  }
}

export async function putResearchCache(entry: ResearchCacheEntry): Promise<void> {
  await write(RESEARCH, entry);
}

if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushPersistence();
  });
  window.addEventListener('beforeunload', () => {
    void flushPersistence();
  });
}
