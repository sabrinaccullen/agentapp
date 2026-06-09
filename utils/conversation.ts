import { Platform } from 'react-native';
import { getSecure } from './storage';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const OWNER = 'sabrinaccullen';
const REPO = 'obsidian-vault';

async function fetchWikiIndex(): Promise<string> {
  const token = await getSecure('github_token');
  if (!token) return '';

  try {
    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/wiki/index.md`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
    );
    if (!response.ok) return '';
    const file = await response.json();
    return atob(file.content.replace(/\n/g, ''));
  } catch {
    return '';
  }
}

export async function sendMessage(
  userMessage: string,
  history: Message[]
): Promise<string> {
  if (Platform.OS === 'web') {
    throw new Error('Conversation requires the mobile app — browser security blocks direct API calls.');
  }

  const apiKey = await getSecure('claude_api_key');
  if (!apiKey) throw new Error('Claude API key not set — add it in Settings.');

  const wikiIndex = await fetchWikiIndex();

  const systemPrompt = `You are a personal AI assistant for Sabrina, accessed via her mobile agent app.

Sabrina has ADHD and uses an Obsidian-based second brain to manage her goals, projects, health, and creative ideas. You have access to her wiki index below — use it to give contextual, relevant answers.

Keep responses concise and actionable. When relevant, reference specific pages or goals from her wiki.

${wikiIndex ? `## Sabrina's Wiki Index\n\n${wikiIndex}` : ''}`.trim();

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
      system: systemPrompt,
      messages: [
        ...history,
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Request failed.');
  }

  const data = await response.json();
  return data.content[0].text;
}
