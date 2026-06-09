import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { saveSecure, getSecure, deleteSecure } from '../utils/storage';

function KeyField({
  label, placeholder, storageKey,
}: { label: string; placeholder: string; storageKey: string }) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) { Alert.alert('Error', 'Please enter an API key.'); return; }
    await saveSecure(storageKey, value.trim());
    setSaved(true);
    setValue('');
  };

  const handleClear = async () => {
    await deleteSecure(storageKey);
    setSaved(false);
    Alert.alert('Cleared', `${label} removed.`);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#aaa"
        value={value}
        onChangeText={setValue}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Save Key</Text>
      </TouchableOpacity>
      {saved && (
        <View style={styles.savedRow}>
          <Text style={styles.savedText}>✓ Key saved</Text>
          <TouchableOpacity onPress={handleClear}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <KeyField
          label="Claude API Key"
          placeholder="sk-ant-..."
          storageKey="claude_api_key"
        />
        <KeyField
          label="OpenAI API Key (Whisper transcription)"
          placeholder="sk-..."
          storageKey="openai_api_key"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#fff', flexGrow: 1 },
  section: { marginBottom: 32 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 12, fontSize: 14, color: '#333', marginBottom: 16,
  },
  button: {
    backgroundColor: '#6B4EFF', borderRadius: 8,
    padding: 14, alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  savedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  savedText: { color: '#4CAF50', fontSize: 14 },
  clearText: { color: '#FF4444', fontSize: 14 },
});
