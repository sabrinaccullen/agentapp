import { getSecure } from './storage';

export async function transcribeAudio(uri: string): Promise<string> {
  const apiKey = await getSecure('openai_api_key');
  if (!apiKey) throw new Error('OpenAI API key not set — add it in Settings.');

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', { uri, type: 'audio/m4a', name: 'recording.m4a' } as any);
    formData.append('model', 'whisper-1');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.openai.com/v1/audio/transcriptions');
    xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status === 200) {
          resolve(data.text);
        } else {
          reject(new Error(data.error?.message || `Transcription failed (${xhr.status}).`));
        }
      } catch {
        reject(new Error(`Transcription failed (${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during transcription.'));
    xhr.send(formData);
  });
}
