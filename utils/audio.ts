// Audio recording via expo-audio — implemented in Week 2 dev build
// Web uses Web Speech API; native recording requires a dev build (not Expo Go)

export async function startRecording(): Promise<void> {
  throw new Error('On-device audio recording coming soon. Use the text input for now.');
}

export async function stopRecording(): Promise<string | null> {
  return null;
}
