export interface LogEntry {
  id: string;
  ts: string;
  level: 'info' | 'error';
  tag: string;
  message: string;
}

const entries: LogEntry[] = [];

export function addLog(level: 'info' | 'error', tag: string, message: string): void {
  entries.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ts: new Date().toLocaleTimeString(),
    level,
    tag,
    message,
  });
  if (entries.length > 100) entries.splice(100);
}

export function getLogs(): LogEntry[] {
  return [...entries];
}

export function clearLogs(): void {
  entries.splice(0);
}
