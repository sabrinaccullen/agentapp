import { getSecure } from './storage';
import { addLog } from './log';

const OWNER = 'sabrinaccullen';
const REPO = 'obsidian-vault';
const QUEUE_PATH = 'processing-queue.md';

async function githubRequest(path: string, method: string, body?: object) {
  const token = await getSecure('github_token');
  if (!token) throw new Error('GitHub token not set — add it in Settings.');

  const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const err = await response.json();
    const error = new Error(err.message || 'GitHub API error') as any;
    error.status = response.status;
    addLog('error', 'vault', `${method} ${path}: ${error.message}`);
    throw error;
  }
  return response.json();
}

interface ProcessedEntry {
  original: string;
  cleaned: string;
  actions: string[];
  tags: string[];
}

export async function appendProcessedToQueue(entries: ProcessedEntry[]): Promise<void> {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const lines = entries.map(e => {
    const actionsLine = e.actions?.length ? `\n  - actions: ${e.actions.join('; ')}` : '';
    const tagsLine = e.tags?.length ? `\n  - tags: ${e.tags.join(', ')}` : '';
    return `- [${timestamp}] (processed) ${e.cleaned}${actionsLine}${tagsLine}`;
  }).join('\n');

  for (let attempt = 0; attempt < 3; attempt++) {
    const file = await githubRequest(QUEUE_PATH, 'GET');
    const currentContent = atob(file.content.replace(/\n/g, ''));
    const newContent = currentContent.trimEnd() + '\n' + lines + '\n';

    try {
      await githubRequest(QUEUE_PATH, 'PUT', {
        message: `queue: ${entries.length} processed capture(s) ${timestamp}`,
        content: btoa(unescape(encodeURIComponent(newContent))),
        sha: file.sha,
      });
      addLog('info', 'vault', `${entries.length} processed capture(s) synced to vault`);
      return;
    } catch (e: any) {
      if (attempt < 2 && (e.status === 409 || e.message?.includes('does not match'))) {
        continue;
      }
      throw e;
    }
  }
}

export async function appendToQueue(text: string, type: string = 'note'): Promise<void> {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const entry = `\n- [${timestamp}] (${type}) ${text}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const file = await githubRequest(QUEUE_PATH, 'GET');
    const currentContent = atob(file.content.replace(/\n/g, ''));
    const newContent = currentContent.trimEnd() + entry + '\n';

    try {
      await githubRequest(QUEUE_PATH, 'PUT', {
        message: `queue: add capture ${timestamp}`,
        content: btoa(unescape(encodeURIComponent(newContent))),
        sha: file.sha,
      });
      addLog('info', 'vault', `Capture appended to queue (attempt ${attempt + 1})`);
      return;
    } catch (e: any) {
      // SHA conflict — vault-sync pushed between our GET and PUT, retry with fresh SHA
      if (attempt < 2 && (e.status === 409 || e.message?.includes('does not match'))) {
        continue;
      }
      throw e;
    }
  }
}
