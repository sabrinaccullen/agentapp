import { getSecure } from './storage';

export async function transcribeAudio(uri: string): Promise<string> {
  const apiKey = await getSecure('openai_api_key');
  if (!apiKey) throw new Error('OpenAI API key not set — add it in Settings.');

  const formData = new FormData();
  formData.append('file', { uri, type: 'audio/m4a', name: 'recording.m4a' } as any);
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Transcription failed.');
  }

  const data = await response.json();
  return data.text;
}
