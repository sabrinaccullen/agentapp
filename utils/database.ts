import { Platform } from 'react-native';

export type SyncStatus = 'pending' | 'synced' | 'failed';
export type ProcessingStatus = 'processing' | 'processed' | 'failed';

export interface Capture {
  id: string;
  text: string;
  createdAt: number;
  type: 'note' | 'quick-add';
  synced: boolean;
  tag: string | null;
  syncStatus: SyncStatus;
  processingStatus: ProcessingStatus;
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
        queued INTEGER DEFAULT 0,
        tag TEXT,
        sync_status TEXT DEFAULT 'pending',
        processing_status TEXT DEFAULT 'processing'
      );
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    // migrate existing installs that predate the queued/tag/status columns
    try { await db.execAsync('ALTER TABLE captures ADD COLUMN queued INTEGER DEFAULT 0'); } catch {}
    try { await db.execAsync('ALTER TABLE captures ADD COLUMN tag TEXT'); } catch {}
    try { await db.execAsync("ALTER TABLE captures ADD COLUMN sync_status TEXT DEFAULT 'pending'"); } catch {}
    try { await db.execAsync("ALTER TABLE captures ADD COLUMN processing_status TEXT DEFAULT 'processing'"); } catch {}
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
    tag: row.tag ?? null,
    syncStatus: (row.sync_status ?? 'pending') as SyncStatus,
    processingStatus: (row.processing_status ?? 'processing') as ProcessingStatus,
  };
}

// --- Public API ---

export async function saveCapture(
  text: string,
  type: 'note' | 'quick-add' = 'note',
  tag: string | null = null
): Promise<Capture> {
  const capture: Capture = {
    id: Date.now().toString(),
    text: text.trim(),
    createdAt: Date.now(),
    type,
    synced: false,
    tag,
    syncStatus: 'pending',
    processingStatus: 'processing',
  };

  if (Platform.OS === 'web') {
    const all = webGetAll();
    all.unshift(capture);
    webSaveAll(all);
    return capture;
  }

  const database = await getDb();
  await database.runAsync(
    'INSERT INTO captures (id, text, created_at, type, synced, tag, sync_status, processing_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [capture.id, capture.text, capture.createdAt, capture.type, 0, capture.tag, capture.syncStatus, capture.processingStatus]
  );
  return capture;
}

export async function getAllCaptures(): Promise<Capture[]> {
  if (Platform.OS === 'web') {
    return webGetAll().map(c => ({
      ...c,
      tag: c.tag ?? null,
      syncStatus: c.syncStatus ?? 'pending',
      processingStatus: c.processingStatus ?? 'processing',
    }));
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

export async function setSyncStatus(id: string, status: SyncStatus): Promise<void> {
  if (Platform.OS === 'web') {
    webSaveAll(webGetAll().map(c => c.id === id ? { ...c, syncStatus: status } : c));
    return;
  }
  const database = await getDb();
  await database.runAsync('UPDATE captures SET sync_status = ? WHERE id = ?', [status, id]);
}

export async function setProcessingStatus(id: string, status: ProcessingStatus): Promise<void> {
  if (Platform.OS === 'web') {
    webSaveAll(webGetAll().map(c => c.id === id ? { ...c, processingStatus: status } : c));
    return;
  }
  const database = await getDb();
  await database.runAsync('UPDATE captures SET processing_status = ? WHERE id = ?', [status, id]);
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
