import { Platform } from 'react-native';
import { getSecure } from './storage';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const OWNER = 'sabrinaccullen';
const REPO = 'obsidian-vault';

async function fetchVaultFile(path: string, token: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
    );
    if (!response.ok) return '';
    const file = await response.json();
    return atob(file.content.replace(/\n/g, ''));
  } catch {
    return '';
  }
}

function buildSystemPrompt(wikiIndex: string, todayTasks: string, tomorrowTasks: string): string {
  const taskContext = (todayTasks || tomorrowTasks)
    ? `\n\n## Today's tasks\n${todayTasks || '(empty)'}\n\n## Tomorrow's tasks\n${tomorrowTasks || '(empty)'}`
    : '';
  const wikiContext = wikiIndex ? `\n\n## Wiki Index\n\n${wikiIndex}` : '';

  return `You are Vesper, Sabrina's personal AI. She has ADHD and uses an Obsidian-based second brain to manage her goals, projects, health, and creative work.

Think out loud with her. Ask follow-up questions. Surface connections she might not see. Reference her wiki, goals, and current tasks naturally — weave them in rather than listing facts. Match her energy: warm and present, not formal. It's okay to gently push back or offer a different perspective. Responses should feel like a thoughtful companion, not a task manager.${taskContext}${wikiContext}`;
}

export async function sendMessage(userMessage: string, history: Message[]): Promise<string> {
  if (Platform.OS === 'web') {
    throw new Error('Chat requires the mobile app — browser security blocks direct API calls.');
  }

  const [apiKey, token] = await Promise.all([
    getSecure('claude_api_key'),
    getSecure('github_token'),
  ]);
  if (!apiKey) throw new Error('Claude API key not set — add it in Settings.');

  const [wikiIndex, todayTasks, tomorrowTasks] = await Promise.all([
    token ? fetchVaultFile('wiki/index.md', token) : Promise.resolve(''),
    token ? fetchVaultFile('today.md', token) : Promise.resolve(''),
    token ? fetchVaultFile('tomorrow.md', token) : Promise.resolve(''),
  ]);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: buildSystemPrompt(wikiIndex, todayTasks, tomorrowTasks),
      messages: [...history, { role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Request failed.');
  }

  const data = await response.json();
  return data.content[0].text;
}
