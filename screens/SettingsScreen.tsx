import { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { saveSecure, deleteSecure } from '../utils/storage';
import {
  requestNotificationPermission,
  scheduleTestNotification,
  scheduleDailyReminder,
  cancelAllReminders,
} from '../utils/notifications';
import { getLogs, clearLogs, LogEntry } from '../utils/log';
import { appendToQueue } from '../utils/vault';

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

  const run = async (fn: () => Promise<string>) => {
    setStatus('…');
    try { setStatus(await fn()); }
    catch (e: any) { setStatus(`✗ ${e.message}`); }
  };

  const handleEnable = () => run(async () => {
    const granted = await requestNotificationPermission();
    return granted ? '✓ Permission granted' : '✗ Permission denied — check Settings > Notifications';
  });

  const handleTest = () => run(async () => {
    const granted = await requestNotificationPermission();
    if (!granted) return '✗ Permission denied — check Settings > Notifications';
    await scheduleTestNotification();
    return '✓ Notification scheduled — lock your phone and wait 5s';
  });

  const handleDailyReminder = () => run(async () => {
    const granted = await requestNotificationPermission();
    if (!granted) return '✗ Permission denied';
    await scheduleDailyReminder(9, 0);
    return '✓ Daily reminder set for 9:00 AM';
  });

  const handleCancel = () => run(async () => {
    await cancelAllReminders();
    return 'All reminders cancelled';
  });

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

function LogSection() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sendStatus, setSendStatus] = useState<Record<string, string>>({});

  useFocusEffect(useCallback(() => { setLogs(getLogs()); }, []));

  const handleClear = () => { clearLogs(); setLogs([]); };

  const handleSend = async (entry: LogEntry) => {
    setSendStatus(s => ({ ...s, [entry.id]: '…' }));
    try {
      await appendToQueue(`[${entry.tag}] ${entry.message}`, 'log');
      setSendStatus(s => ({ ...s, [entry.id]: '✓' }));
    } catch (e: any) {
      setSendStatus(s => ({ ...s, [entry.id]: '✗' }));
    }
  };

  return (
    <View style={styles.section}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={styles.label}>Event Log</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={() => setLogs(getLogs())}>
            <Text style={{ color: '#6B4EFF', fontSize: 13 }}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClear}>
            <Text style={{ color: '#E53935', fontSize: 13 }}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>
      {logs.length === 0 ? (
        <Text style={{ color: '#aaa', fontSize: 13 }}>No events yet — use the app to generate logs.</Text>
      ) : (
        logs.map(entry => (
          <View key={entry.id} style={logStyles.entry}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[logStyles.tag, entry.level === 'error' && logStyles.tagError]}>
                {entry.level === 'error' ? '✗' : '✓'} {entry.tag}
              </Text>
              <Text style={logStyles.ts}>{entry.ts}</Text>
            </View>
            <Text style={logStyles.message}>{entry.message}</Text>
            <TouchableOpacity onPress={() => handleSend(entry)}>
              <Text style={logStyles.sendBtn}>{sendStatus[entry.id] ?? 'Send to queue'}</Text>
            </TouchableOpacity>
          </View>
        ))
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
        <KeyField
          label="GitHub Token (vault sync)"
          placeholder="ghp_..."
          storageKey="github_token"
        />
        <NotificationsSection />
        <LogSection />
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

const logStyles = StyleSheet.create({
  entry: {
    borderWidth: 1, borderColor: '#eee', borderRadius: 8,
    padding: 10, marginBottom: 8, backgroundColor: '#fafafa',
  },
  tag: { fontSize: 11, fontWeight: '700', color: '#4CAF50', textTransform: 'uppercase' },
  tagError: { color: '#E53935' },
  ts: { fontSize: 11, color: '#bbb' },
  message: { fontSize: 13, color: '#444', marginTop: 3, marginBottom: 6 },
  sendBtn: { fontSize: 12, color: '#2196F3', fontWeight: '600' },
});
