import { Platform } from 'react-native';
import { addLog } from './log';

let _recorder: any = null;

export async function startRecording(): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Audio recording requires the native app — use the text input on web.');
  }

  const {
    AudioModule,
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
  } = require('expo-audio');

  const { granted } = await requestRecordingPermissionsAsync();
  if (!granted) throw new Error('Microphone permission denied — enable it in iOS Settings > Agent App.');

  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

  _recorder = new AudioModule.AudioRecorder({});
  await _recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
  _recorder.record();
  addLog('info', 'audio', 'Recording started');
}

export async function stopRecording(): Promise<string | null> {
  if (!_recorder) return null;
  await _recorder.stop();
  const uri = _recorder.uri ?? null;
  _recorder = null;
  if (uri) addLog('info', 'audio', `Recording saved: ${uri.split('/').pop()}`);
  return uri;
}
