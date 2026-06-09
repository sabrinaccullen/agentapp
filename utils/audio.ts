import { Platform } from 'react-native';
import { addLog } from './log';

let _recorder: any = null;

export async function startRecording(): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Audio recording requires the native app — use the text input on web.');
  }

  const { AudioRecorder, RecordingPresets, AudioModule } = require('expo-audio');

  const { granted } = await AudioModule.requestRecordingPermissionsAsync();
  if (!granted) throw new Error('Microphone permission denied — enable it in iOS Settings > Agent App.');

  await AudioModule.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

  _recorder = new AudioRecorder(RecordingPresets.HIGH_QUALITY);
  await _recorder.prepareToRecordAsync();
  _recorder.record();
  addLog('info', 'audio', 'Recording started');
}

export async function stopRecording(): Promise<string | null> {
  if (!_recorder) return null;
  await _recorder.stop();
  const uri = _recorder.uri;
  _recorder = null;
  if (uri) addLog('info', 'audio', `Recording saved: ${uri.split('/').pop()}`);
  return uri ?? null;
}
