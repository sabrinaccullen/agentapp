import { useState, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { startListening, stopListening, isSpeechSupported } from '../utils/speech';
import { startRecording, stopRecording } from '../utils/audio';
import { transcribeAudio } from '../utils/transcribe';
import { saveCapture } from '../utils/database';

type CaptureTab = 'write' | 'dictate';

export default function CaptureScreen() {
  const [tab, setTab] = useState<CaptureTab>('write');
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const baseTextRef = useRef('');
  const interimRef = useRef('');

  useFocusEffect(useCallback(() => {
    return () => {
      if (Platform.OS === 'web') stopListening();
      else stopRecording().catch(() => {});
      setIsListening(false);
    };
  }, []));

  const startDictation = async () => {
    baseTextRef.current = text;
    interimRef.current = '';
    setInterimText('');
    setError('');

    if (Platform.OS !== 'web') {
      try {
        await startRecording();
        setIsListening(true);
      } catch (e: any) {
        setError(e.message);
        setTab('write');
      }
      return;
    }

    if (!isSpeechSupported()) {
      setError('Speech not available in this browser.');
      setTab('write');
      return;
    }

    startListening(
      (t, isFinal) => {
        if (isFinal) {
          interimRef.current += (interimRef.current ? ' ' : '') + t;
          setText(baseTextRef.current
            ? baseTextRef.current + '\n' + interimRef.current
            : interimRef.current);
          setInterimText('');
        } else {
          setInterimText(t);
        }
      },
      () => setIsListening(false)
    );
    setIsListening(true);
  };

  const stopDictation = async (thenSave = false) => {
    if (!isListening) return;
    setIsListening(false);
    setInterimText('');

    if (Platform.OS !== 'web') {
      setIsTranscribing(true);
      try {
        const uri = await stopRecording();
        if (uri) {
          const transcribed = await transcribeAudio(uri);
          if (transcribed.trim()) {
            const newText = baseTextRef.current
              ? baseTextRef.current + '\n' + transcribed.trim()
              : transcribed.trim();
            setText(newText);
            if (thenSave) {
              await saveCapture(newText);
              setSaved(true);
              setText('');
              setTimeout(() => setSaved(false), 2000);
            }
          }
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsTranscribing(false);
      }
    } else {
      stopListening();
    }
  };

  const handleTabChange = async (newTab: CaptureTab) => {
    if (newTab === tab) return;
    if (newTab === 'dictate') {
      setTab('dictate');
      await startDictation();
    } else {
      await stopDictation();
      setTab('write');
    }
  };

  const handleSave = async () => {
    if (isListening) { await stopDictation(true); return; }
    if (!text.trim()) return;
    await saveCapture(text.trim());
    setSaved(true);
    setText('');
    setTab('write');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDiscard = () => {
    if (isListening) {
      if (Platform.OS === 'web') stopListening();
      else stopRecording().catch(() => {});
      setIsListening(false);
    }
    setText('');
    setInterimText('');
    setError('');
    setSaved(false);
    setTab('write');
    baseTextRef.current = '';
    interimRef.current = '';
  };

  const insertBullet = () => setText(t => t + (t.endsWith('\n') || !t ? '- ' : '\n- '));
  const insertDivider = () => setText(t => t + (t.endsWith('\n') || !t ? '---\n' : '\n---\n'));

  const hasContent = text.trim().length > 0 || isListening;
  const displayText = text + (interimText ? (text ? ' ' : '') + interimText : '');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Capture</Text>
          <View style={styles.headerRight}>
            {text.trim().length > 0 && (
              <Text style={styles.charCount}>{text.trim().length} chars</Text>
            )}
            {hasContent && (
              <TouchableOpacity onPress={handleDiscard}>
                <Text style={styles.discardBtn}>Discard</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Text area */}
        <View style={styles.textAreaWrapper}>
          {isTranscribing ? (
            <View style={styles.transcribingBox}>
              <ActivityIndicator color="#6B4EFF" size="large" />
              <Text style={styles.transcribingText}>Transcribing…</Text>
            </View>
          ) : (
            <TextInput
              style={styles.textArea}
              placeholder={tab === 'dictate' ? 'Listening… speak now' : 'Start typing, or tap Dictate below…'}
              placeholderTextColor="#ccc"
              value={displayText}
              onChangeText={t => { if (!isListening) setText(t); }}
              multiline
              autoFocus={tab === 'write'}
              editable={!isListening && !isTranscribing}
              textAlignVertical="top"
            />
          )}
          {isListening && (
            <View style={styles.listeningBadge}>
              <Text style={styles.listeningDot}>●</Text>
              <Text style={styles.listeningLabel}>Listening</Text>
            </View>
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {saved ? <Text style={styles.savedText}>✓ Saved to History</Text> : null}

        {/* Formatting toolbar */}
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolBtn} onPress={insertBullet}>
            <Text style={styles.toolIcon}>•</Text>
            <Text style={styles.toolLabel}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={insertDivider}>
            <Text style={styles.toolIcon}>—</Text>
            <Text style={styles.toolLabel}>Divider</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={() => setError('Photo capture coming in a future update.')}>
            <Text style={styles.toolIcon}>📷</Text>
            <Text style={styles.toolLabel}>Photo</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {hasContent && (
            <TouchableOpacity
              style={[styles.saveBtn, isTranscribing && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isTranscribing}
            >
              <Text style={styles.saveBtnText}>
                {isListening ? 'Stop & Save' : 'Save'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Write / Dictate tab bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'write' && styles.tabBtnActive]}
            onPress={() => handleTabChange('write')}
          >
            <Text style={[styles.tabIcon, tab === 'write' && styles.tabIconActive]}>✏️</Text>
            <Text style={[styles.tabLabel, tab === 'write' && styles.tabLabelActive]}>Write</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'dictate' && styles.tabBtnActive]}
            onPress={() => handleTabChange('dictate')}
          >
            <Text style={[styles.tabIcon, tab === 'dictate' && styles.tabIconActive]}>
              {isListening ? '🔴' : '🎙'}
            </Text>
            <Text style={[styles.tabLabel, tab === 'dictate' && styles.tabLabelActive]}>
              {isListening ? 'Listening…' : 'Dictate'}
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  charCount: { fontSize: 12, color: '#ccc' },
  discardBtn: { color: '#E53935', fontSize: 14, fontWeight: '600' },
  textAreaWrapper: { flex: 1, position: 'relative' },
  textArea: {
    flex: 1, padding: 16, fontSize: 17, color: '#1a1a1a',
    lineHeight: 28, textAlignVertical: 'top',
  },
  transcribingBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  transcribingText: { color: '#6B4EFF', fontSize: 15, fontWeight: '500' },
  listeningBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FFF0F0', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  listeningDot: { color: '#E53935', fontSize: 10 },
  listeningLabel: { color: '#E53935', fontSize: 12, fontWeight: '600' },
  errorText: { color: '#E53935', fontSize: 13, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  savedText: { color: '#4CAF50', fontSize: 13, textAlign: 'center', paddingBottom: 6, fontWeight: '500' },
  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 4,
  },
  toolBtn: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4 },
  toolIcon: { fontSize: 18 },
  toolLabel: { fontSize: 10, color: '#bbb', marginTop: 2 },
  saveBtn: {
    backgroundColor: '#6B4EFF', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 9,
  },
  saveBtnDisabled: { backgroundColor: '#ddd' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
    backgroundColor: '#fafafa',
    paddingBottom: Platform.OS === 'ios' ? 8 : 0,
  },
  tabBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderTopWidth: 2, borderTopColor: 'transparent',
  },
  tabBtnActive: { borderTopColor: '#6B4EFF', backgroundColor: '#fff' },
  tabIcon: { fontSize: 20, marginBottom: 2 },
  tabIconActive: {},
  tabLabel: { fontSize: 12, fontWeight: '600', color: '#bbb' },
  tabLabelActive: { color: '#6B4EFF' },
});
