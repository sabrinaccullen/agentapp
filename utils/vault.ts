import { getSecure } from './storage';

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
    throw new Error(err.message || 'GitHub API error');
  }
  return response.json();
}

export async function appendToQueue(text: string, type: string = 'note'): Promise<void> {
  // fetch current file to get SHA and content
  const file = await githubRequest(QUEUE_PATH, 'GET');
  const currentContent = atob(file.content.replace(/\n/g, ''));

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const entry = `\n- [${timestamp}] (${type}) ${text}`;
  const newContent = currentContent.trimEnd() + entry + '\n';

  await githubRequest(QUEUE_PATH, 'PUT', {
    message: `queue: add capture ${timestamp}`,
    content: btoa(unescape(encodeURIComponent(newContent))),
    sha: file.sha,
  });
}
