import { Platform } from 'react-native';
import { getSecure } from './storage';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export type ConversationMode = 'task' | 'chat' | 'plan';

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

function todayPath(): string {
  const d = new Date();
  return 'today.md';
}

function buildSystemPrompt(
  mode: ConversationMode,
  wikiIndex: string,
  todayTasks: string,
  tomorrowTasks: string
): string {
  const base = `You are a personal AI assistant for Sabrina, accessed via her mobile agent app. She has ADHD and uses an Obsidian-based second brain to manage her goals, projects, health, and creative work.`;

  const taskContext = (todayTasks || tomorrowTasks) ? `

## Today's tasks
${todayTasks || '(empty)'}

## Tomorrow's tasks
${tomorrowTasks || '(empty)'}` : '';

  const wikiContext = wikiIndex ? `\n\n## Wiki Index\n\n${wikiIndex}` : '';

  const modePrompts: Record<ConversationMode, string> = {
    task: `${base}

You are in TASK MODE. Be fast and action-oriented. Process requests immediately when possible.
- Answer questions about today's tasks using the task list below
- Creating a reminder → confirm with exact time
- Complex tasks beyond your reach → tell her to queue it for desktop processing
- Keep all responses under 2 sentences. No pleasantries.
${taskContext}${wikiContext}`,

    chat: `${base}

You are in RUBBER DUCK MODE. This is a natural, low-pressure conversation space.
- Think out loud with her, ask follow-up questions, surface connections she might not see
- Reference her wiki, goals, and current tasks naturally — don't just list facts, weave them in
- Match her energy: casual and warm, not formal
- It's okay to push back gently or offer a different perspective
- Responses should feel like a thoughtful friend, not a task manager
${taskContext}${wikiContext}`,

    plan: `${base}

You are in PLAN MODE. Help Sabrina build structured, actionable plans.
- Ask 1-2 clarifying questions before generating anything substantial
- Output formatted markdown: headers, checklists, milestones
- Use [[wiki-links]] to reference related pages throughout
- Connect ideas across her goals, projects, health data, and current tasks when relevant
- Think in terms of weeks and concrete outcomes, not abstract advice
- Plans should be ready to paste directly into Obsidian
${taskContext}${wikiContext}`,
  };

  return modePrompts[mode];
}

export async function sendMessage(
  userMessage: string,
  history: Message[],
  mode: ConversationMode = 'chat'
): Promise<string> {
  if (Platform.OS === 'web') {
    throw new Error('Chat requires the mobile app — browser security blocks direct API calls.');
  }

  const [apiKey, token] = await Promise.all([
    getSecure('claude_api_key'),
    getSecure('github_token'),
  ]);
  if (!apiKey) throw new Error('Claude API key not set — add it in Settings.');

  // Fetch vault context in parallel
  const [wikiIndex, todayTasks, tomorrowTasks] = await Promise.all([
    token ? fetchVaultFile('wiki/index.md', token) : Promise.resolve(''),
    token ? fetchVaultFile('today.md', token) : Promise.resolve(''),
    token ? fetchVaultFile('tomorrow.md', token) : Promise.resolve(''),
  ]);

  const systemPrompt = buildSystemPrompt(mode, wikiIndex, todayTasks, tomorrowTasks);

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
