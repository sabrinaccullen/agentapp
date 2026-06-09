import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { saveSecure, deleteSecure } from '../utils/storage';
import {
  requestNotificationPermission,
  scheduleTestNotification,
  scheduleDailyReminder,
  cancelAllReminders,
} from '../utils/notifications';

function KeyField({
  label, placeholder, storageKey,
}: { label: string; placeholder: string; storageKey: string }) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);
  const [visible, setVisible] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) { Alert.alert('Error', 'Please enter an API key.'); return; }
    await saveSecure(storageKey, value.trim());
    setSaved(true);
    setValue('');
    setVisible(false);
  };

  const handleClear = async () => {
    await deleteSecure(storageKey);
    setSaved(false);
    Alert.alert('Cleared', `${label} removed.`);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder={placeholder}
          placeholderTextColor="#aaa"
          value={value}
          onChangeText={setValue}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={() => setVisible(v => !v)}>
          <Text style={styles.eyeIcon}>{visible ? '🙈' : '👁'}</Text>
        </TouchableOpacity>
      </View>
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

function NotificationsSection() {
  const [status, setStatus] = useState('');

  if (Platform.OS === 'web') {
    return (
      <View style={styles.section}>
        <Text style={styles.label}>Notifications</Text>
        <Text style={{ color: '#999', fontSize: 13 }}>Not supported on web — test on device.</Text>
      </View>
    );
  }

  const handleEnable = async () => {
    const granted = await requestNotificationPermission();
    setStatus(granted ? '✓ Permission granted' : '✗ Permission denied');
  };

  const handleTest = async () => {
    const granted = await requestNotificationPermission();
    if (!granted) { setStatus('✗ Permission denied'); return; }
    await scheduleTestNotification();
    setStatus('Test notification fires in 5 seconds');
  };

  const handleDailyReminder = async () => {
    const granted = await requestNotificationPermission();
    if (!granted) { setStatus('✗ Permission denied'); return; }
    await scheduleDailyReminder(9, 0);
    setStatus('✓ Daily reminder set for 9:00 AM');
  };

  const handleCancel = async () => {
    await cancelAllReminders();
    setStatus('All reminders cancelled');
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Notifications</Text>
      <TouchableOpacity style={styles.button} onPress={handleEnable}>
        <Text style={styles.buttonText}>Enable Notifications</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={handleTest}>
        <Text style={styles.buttonText}>Send Test (5s)</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={handleDailyReminder}>
        <Text style={styles.buttonText}>Set Daily Reminder (9 AM)</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={handleCancel}>
        <Text style={styles.buttonText}>Cancel All Reminders</Text>
      </TouchableOpacity>
      {status ? <Text style={styles.savedText}>{status}</Text> : null}
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
        <KeyField
          label="GitHub Token (vault sync)"
          placeholder="ghp_..."
          storageKey="github_token"
        />
        <NotificationsSection />
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
    padding: 12, fontSize: 14, color: '#333',
  },
  button: {
    backgroundColor: '#6B4EFF', borderRadius: 8,
    padding: 14, alignItems: 'center', marginBottom: 10,
  },
  buttonSecondary: { backgroundColor: '#8B72FF' },
  buttonDanger: { backgroundColor: '#E53935' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { padding: 10 },
  eyeIcon: { fontSize: 18 },
  savedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  savedText: { color: '#4CAF50', fontSize: 14 },
  clearText: { color: '#FF4444', fontSize: 14 },
});
