import { Platform } from 'react-native';

export interface Capture {
  id: string;
  text: string;
  createdAt: number;
  type: 'note' | 'quick-add';
  synced: boolean;
  queued: boolean;
}

// --- Web fallback (localStorage) ---

const WEB_KEY = 'agent_captures';

function webGetAll(): Capture[] {
  try { return JSON.parse(localStorage.getItem(WEB_KEY) || '[]'); }
  catch { return []; }
}

function webSaveAll(captures: Capture[]) {
  localStorage.setItem(WEB_KEY, JSON.stringify(captures));
}

// --- Native SQLite ---

let db: any = null;

async function getDb() {
  if (!db) {
    const SQLite = require('expo-sqlite');
    db = await SQLite.openDatabaseAsync('captures.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS captures (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        type TEXT NOT NULL,
        synced INTEGER DEFAULT 0,
        queued INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    // migrate existing installs that predate the queued column
    try { await db.execAsync('ALTER TABLE captures ADD COLUMN queued INTEGER DEFAULT 0'); } catch {}
  }
  return db;
}

function rowToCapture(row: any): Capture {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    type: row.type as 'note' | 'quick-add',
    synced: Boolean(row.synced),
    queued: Boolean(row.queued),
  };
}

// --- Public API ---

export async function saveCapture(
  text: string,
  type: 'note' | 'quick-add' = 'note'
): Promise<Capture> {
  const capture: Capture = {
    id: Date.now().toString(),
    text: text.trim(),
    createdAt: Date.now(),
    type,
    synced: false,
    queued: false,
  };

  if (Platform.OS === 'web') {
    const all = webGetAll();
    all.unshift(capture);
    webSaveAll(all);
    return capture;
  }

  const database = await getDb();
  await database.runAsync(
    'INSERT INTO captures (id, text, created_at, type, synced, queued) VALUES (?, ?, ?, ?, ?, ?)',
    [capture.id, capture.text, capture.createdAt, capture.type, 0, 0]
  );
  return capture;
}

export async function getAllCaptures(): Promise<Capture[]> {
  if (Platform.OS === 'web') {
    return webGetAll().map(c => ({ ...c, queued: c.queued ?? false }));
  }
  const database = await getDb();
  const rows = await database.getAllAsync('SELECT * FROM captures ORDER BY created_at DESC');
  return rows.map(rowToCapture);
}

export async function deleteCapture(id: string): Promise<void> {
  if (Platform.OS === 'web') {
    webSaveAll(webGetAll().filter(c => c.id !== id));
    return;
  }
  const database = await getDb();
  await database.runAsync('DELETE FROM captures WHERE id = ?', [id]);
}

export async function setQueued(id: string, queued: boolean): Promise<void> {
  if (Platform.OS === 'web') {
    webSaveAll(webGetAll().map(c => c.id === id ? { ...c, queued } : c));
    return;
  }
  const database = await getDb();
  await database.runAsync('UPDATE captures SET queued = ? WHERE id = ?', [queued ? 1 : 0, id]);
}

export async function getQueuedCaptures(): Promise<Capture[]> {
  if (Platform.OS === 'web') {
    return webGetAll().filter(c => c.queued);
  }
  const database = await getDb();
  const rows = await database.getAllAsync(
    'SELECT * FROM captures WHERE queued = 1 ORDER BY created_at ASC'
  );
  return rows.map(rowToCapture);
}

// --- Conversation messages ---

import type { Message } from './conversation';

export async function getConversationMessages(): Promise<Message[]> {
  if (Platform.OS === 'web') return [];
  const database = await getDb();
  const rows = await database.getAllAsync(
    'SELECT role, content FROM conversation_messages ORDER BY created_at ASC'
  );
  return rows.map((r: any) => ({ role: r.role as Message['role'], content: r.content }));
}

export async function appendConversationMessage(role: Message['role'], content: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const database = await getDb();
  await database.runAsync(
    'INSERT INTO conversation_messages (role, content, created_at) VALUES (?, ?, ?)',
    [role, content, Date.now()]
  );
}
