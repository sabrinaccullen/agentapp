import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { saveSecure, getSecure, deleteSecure } from '../utils/storage';

const API_KEY_STORAGE_KEY = 'claude_api_key';

export default function SettingsScreen() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter an API key.');
      return;
    }
    await saveSecure(API_KEY_STORAGE_KEY, apiKey.trim());
    setSaved(true);
    setApiKey('');
  };

  const handleClear = async () => {
    await deleteSecure(API_KEY_STORAGE_KEY);
    setSaved(false);
    Alert.alert('Cleared', 'API key removed.');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.label}>Claude API Key</Text>
      <TextInput
        style={styles.input}
        placeholder="sk-ant-..."
        placeholderTextColor="#aaa"
        value={apiKey}
        onChangeText={setApiKey}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Save Key</Text>
      </TouchableOpacity>

      {saved && (
        <View style={styles.savedRow}>
          <Text style={styles.savedText}>✓ API key saved</Text>
          <TouchableOpacity onPress={handleClear}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff', justifyContent: 'center' },
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
