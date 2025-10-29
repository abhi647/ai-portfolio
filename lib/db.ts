import { openDB, type IDBPDatabase } from 'idb';
import type { Project, Watchlist, Note } from '@/types';

const DB_NAME = 'ai-portfolio-db';
const DB_VERSION = 1;

export interface AIPortfolioDB {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-created': number };
  };
  watchlists: {
    key: string;
    value: Watchlist;
    indexes: { 'by-created': number };
  };
  notes: {
    key: string;
    value: Note;
    indexes: { 'by-symbol': string; 'by-updated': number };
  };
}

let dbInstance: IDBPDatabase<AIPortfolioDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<AIPortfolioDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AIPortfolioDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Projects store
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', {
          keyPath: 'id',
        });
        projectStore.createIndex('by-created', 'createdAt');
      }

      // Watchlists store
      if (!db.objectStoreNames.contains('watchlists')) {
        const watchlistStore = db.createObjectStore('watchlists', {
          keyPath: 'id',
        });
        watchlistStore.createIndex('by-created', 'createdAt');
      }

      // Notes store
      if (!db.objectStoreNames.contains('notes')) {
        const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
        noteStore.createIndex('by-symbol', 'symbol');
        noteStore.createIndex('by-updated', 'updatedAt');
      }
    },
  });

  return dbInstance;
}

// Project CRUD operations
export async function saveProject(project: Project): Promise<void> {
  const db = await getDB();
  await db.put('projects', project);
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB();
  return db.getAll('projects');
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('projects', id);
}

// Watchlist CRUD operations
export async function saveWatchlist(watchlist: Watchlist): Promise<void> {
  const db = await getDB();
  await db.put('watchlists', watchlist);
}

export async function getWatchlist(
  id: string
): Promise<Watchlist | undefined> {
  const db = await getDB();
  return db.get('watchlists', id);
}

export async function getAllWatchlists(): Promise<Watchlist[]> {
  const db = await getDB();
  return db.getAll('watchlists');
}

export async function deleteWatchlist(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('watchlists', id);
}

// Note CRUD operations
export async function saveNote(note: Note): Promise<void> {
  const db = await getDB();
  await db.put('notes', note);
}

export async function getNote(id: string): Promise<Note | undefined> {
  const db = await getDB();
  return db.get('notes', id);
}

export async function getNotesBySymbol(symbol: string): Promise<Note[]> {
  const db = await getDB();
  return db.getAllFromIndex('notes', 'by-symbol', symbol);
}

export async function getAllNotes(): Promise<Note[]> {
  const db = await getDB();
  return db.getAll('notes');
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('notes', id);
}

// Bulk operations
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear('projects'),
    db.clear('watchlists'),
    db.clear('notes'),
  ]);
}

export async function exportDatabase(): Promise<{
  projects: Project[];
  watchlists: Watchlist[];
  notes: Note[];
}> {
  const [projects, watchlists, notes] = await Promise.all([
    getAllProjects(),
    getAllWatchlists(),
    getAllNotes(),
  ]);

  return { projects, watchlists, notes };
}

export async function importDatabase(data: {
  projects: Project[];
  watchlists: Watchlist[];
  notes: Note[];
}): Promise<void> {
  const db = await getDB();

  const tx = db.transaction(['projects', 'watchlists', 'notes'], 'readwrite');

  await Promise.all([
    ...data.projects.map((p) => tx.objectStore('projects').put(p)),
    ...data.watchlists.map((w) => tx.objectStore('watchlists').put(w)),
    ...data.notes.map((n) => tx.objectStore('notes').put(n)),
  ]);

  await tx.done;
}
