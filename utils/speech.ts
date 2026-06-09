import { Platform } from 'react-native';

type TranscriptCallback = (text: string, isFinal: boolean) => void;
type ErrorCallback = (error: string) => void;

let recognition: any = null;

export function isSpeechSupported(): boolean {
  if (Platform.OS !== 'web') return false;
  return !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
}

export function startListening(onTranscript: TranscriptCallback, onError: ErrorCallback): void {
  if (Platform.OS !== 'web') {
    onError('On-device dictation coming soon.');
    return;
  }

  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    onError('Speech recognition not supported in this browser. Try Chrome.');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event: any) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }
    if (final) onTranscript(final, true);
    else if (interim) onTranscript(interim, false);
  };

  recognition.onerror = (event: any) => {
    onError(`Speech error: ${event.error}`);
  };

  recognition.start();
}

export function stopListening(): void {
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
}
