import { Platform } from 'react-native';
import { getQueuedCaptures, setQueued } from './database';
import { getSecure } from './storage';

export interface ProcessedCapture {
  id: string;
  original: string;
  cleaned: string;
  actions: string[];
  tags: string[];
}

export async function processQueue(): Promise<ProcessedCapture[]> {
  if (Platform.OS === 'web') {
    throw new Error('Queue processing requires the mobile app — browser security blocks direct API calls.');
  }

  const apiKey = await getSecure('claude_api_key');
  if (!apiKey) throw new Error('Claude API key not set — add it in Settings.');

  const queued = await getQueuedCaptures();
  if (queued.length === 0) throw new Error('No captures in queue.');

  const prompt = `You are processing a batch of captured notes from a personal knowledge app. For each note, return:
1. A cleaned-up version (fix grammar, remove filler words, keep meaning intact)
2. Action items extracted (empty array if none)
3. Suggested tags (2-4 short lowercase tags)

Notes:
${queued.map((c, i) => `[${i + 1}] id:${c.id}\n${c.text}`).join('\n\n')}

Respond with a JSON array only, no other text:
[{"id":"...","cleaned":"...","actions":["..."],"tags":["..."]}]`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Processing failed.');
  }

  const data = await response.json();
  const text = data.content[0].text.trim();
  const results: ProcessedCapture[] = JSON.parse(text).map((r: any, i: number) => ({
    ...r,
    original: queued[i]?.text ?? '',
  }));

  // mark all processed items as unqueued
  await Promise.all(queued.map(c => setQueued(c.id, false)));

  return results;
}
