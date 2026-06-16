import { Platform } from 'react-native';
import { Capture, setSyncStatus, setProcessingStatus } from './database';
import { getSecure } from './storage';
import { appendToQueue, appendProcessedToQueue } from './vault';
import { addLog } from './log';

interface ProcessedEntry {
  original: string;
  cleaned: string;
  actions: string[];
  tags: string[];
}

async function cleanupCapture(capture: Capture, apiKey: string): Promise<ProcessedEntry> {
  const prompt = `You are processing a captured note from a personal knowledge app. Return:
1. A cleaned-up version (fix grammar, remove filler words, keep meaning intact)
2. Action items extracted (empty array if none)
3. Suggested tags (2-4 short lowercase tags)

Note:
${capture.text}

Respond with a JSON object only, no other text:
{"cleaned":"...","actions":["..."],"tags":["..."]}`;

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
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Processing failed.');
  }

  const data = await response.json();
  const raw = data.content[0].text.trim();
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const result = JSON.parse(text);
  return {
    original: capture.text,
    cleaned: result.cleaned,
    actions: result.actions ?? [],
    tags: result.tags ?? [],
  };
}

/**
 * Runs immediately after a note is saved: attempts Claude cleanup/tagging,
 * then syncs the resulting (processed or raw fallback) entry to the vault.
 * Replaces the old manual Queue/Process-with-Claude flow removed by the
 * History Screen renovation (HANDOFF-023) — every note processes itself once.
 */
export async function processAndSyncCapture(capture: Capture): Promise<void> {
  if (Platform.OS === 'web') return;

  await setProcessingStatus(capture.id, 'processing');
  await setSyncStatus(capture.id, 'pending');

  let entry: ProcessedEntry | null = null;
  const apiKey = await getSecure('claude_api_key');

  if (apiKey) {
    try {
      entry = await cleanupCapture(capture, apiKey);
      await setProcessingStatus(capture.id, 'processed');
      addLog('info', 'queue', `Processed capture ${capture.id} with Claude`);
    } catch (e: any) {
      await setProcessingStatus(capture.id, 'failed');
      addLog('error', 'queue', `Processing failed for ${capture.id}: ${e.message}`);
    }
  } else {
    await setProcessingStatus(capture.id, 'failed');
  }

  try {
    if (entry) await appendProcessedToQueue([entry]);
    else await appendToQueue(capture.text, capture.type);
    await setSyncStatus(capture.id, 'synced');
  } catch (e: any) {
    await setSyncStatus(capture.id, 'failed');
    addLog('error', 'vault', `Sync failed for ${capture.id}: ${e.message}`);
  }
}
