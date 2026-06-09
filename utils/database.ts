import { Platform } from 'react-native';

export interface Capture {
  id: string;
  text: string;
  createdAt: number;
  type: 'note' | 'quick-add';
  synced: boolean;
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
        synced INTEGER DEFAULT 0
      );
    `);
  }
  return db;
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
  };

  if (Platform.OS === 'web') {
    const all = webGetAll();
    all.unshift(capture);
    webSaveAll(all);
    return capture;
  }

  const database = await getDb();
  await database.runAsync(
    'INSERT INTO captures (id, text, created_at, type, synced) VALUES (?, ?, ?, ?, ?)',
    [capture.id, capture.text, capture.createdAt, capture.type, 0]
  );
  return capture;
}

export async function getAllCaptures(): Promise<Capture[]> {
  if (Platform.OS === 'web') {
    return webGetAll();
  }

  const database = await getDb();
  const rows = await database.getAllAsync(
    'SELECT * FROM captures ORDER BY created_at DESC'
  );
  return rows.map((row: any) => ({
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    type: row.type as 'note' | 'quick-add',
    synced: Boolean(row.synced),
  }));
}

export async function deleteCapture(id: string): Promise<void> {
  if (Platform.OS === 'web') {
    webSaveAll(webGetAll().filter(c => c.id !== id));
    return;
  }

  const database = await getDb();
  await database.runAsync('DELETE FROM captures WHERE id = ?', [id]);
}
