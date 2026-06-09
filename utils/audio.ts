let recording: any = null;

export async function startRecording(): Promise<void> {
  const { Audio } = require('expo-av');
  const { status } = await Audio.requestPermissionsAsync();
  if (status !== 'granted') throw new Error('Microphone permission denied.');

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording: rec } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );
  recording = rec;
}

export async function stopRecording(): Promise<string | null> {
  if (!recording) return null;
  const { Audio } = require('expo-av');
  await recording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  const uri = recording.getURI();
  recording = null;
  return uri;
}
