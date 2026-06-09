import { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { startListening, stopListening, isSpeechSupported } from '../utils/speech';
import { startRecording, stopRecording } from '../utils/audio';
import { transcribeAudio } from '../utils/transcribe';
import { saveCapture } from '../utils/database';

type Status = 'idle' | 'recording' | 'saving' | 'saved' | 'error';

export default function QuickAddScreen() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const finalTextRef = useRef('');

  // Reset to idle when navigating away mid-recording
  useFocusEffect(useCallback(() => {
    return () => {
      if (Platform.OS === 'web') stopListening();
      else stopRecording().catch(() => {});
      setStatus('idle');
      finalTextRef.current = '';
    };
  }, []));

  const startCapture = async () => {
    finalTextRef.current = '';
    setErrorMsg('');

    if (Platform.OS !== 'web') {
      try {
        await startRecording();
        setStatus('recording');
      } catch (e: any) {
        setErrorMsg(e.message);
        setStatus('error');
      }
      return;
    }

    if (!isSpeechSupported()) {
      setErrorMsg('Speech not supported in this browser.');
      setStatus('error');
      return;
    }

    startListening(
      (text, isFinal) => {
        if (isFinal) {
          finalTextRef.current += (finalTextRef.current ? ' ' : '') + text;
        }
      },
      (err) => { setErrorMsg(err); setStatus('error'); }
    );
    setStatus('recording');
  };

  const stopAndSave = async () => {
    setStatus('saving');
    try {
      let text = '';
      if (Platform.OS !== 'web') {
        const uri = await stopRecording();
        if (uri) text = await transcribeAudio(uri);
      } else {
        stopListening();
        text = finalTextRef.current;
      }

      if (text.trim()) {
        await saveCapture(text.trim(), 'quick-add');
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
      } else {
        setStatus('idle');
      }
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  };

  const handlePress = () => {
    if (status === 'recording') stopAndSave();
    else if (status === 'idle' || status === 'saved') startCapture();
  };

  const isRecording = status === 'recording';
  const isSaving = status === 'saving';
  const isSaved = status === 'saved';

  const bgColor = isRecording ? '#E53935' : isSaved ? '#4CAF50' : '#6B4EFF';
  const icon = isRecording ? '⏹' : isSaved ? '✓' : '⚡';
  const label = isRecording ? 'Tap to save' : isSaving ? 'Saving…' : isSaved ? 'Saved!' : 'Tap to capture';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: bgColor }]}
        onPress={handlePress}
        disabled={isSaving}
        activeOpacity={0.85}
      >
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.label}>{label}</Text>
        {isRecording && <Text style={styles.recording}>recording…</Text>}
      </TouchableOpacity>

      {status === 'error' && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity onPress={() => setStatus('idle')}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.hint}>
        Tap once to start · tap again to save{'\n'}No confirmation needed
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 32 },
  button: {
    width: 180, height: 180, borderRadius: 90,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 40, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
    elevation: 6,
  },
  icon: { fontSize: 52, marginBottom: 4 },
  label: { color: '#fff', fontWeight: '700', fontSize: 15 },
  recording: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4 },
  errorBox: { alignItems: 'center', marginBottom: 24 },
  errorText: { color: '#E53935', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  retryText: { color: '#6B4EFF', fontSize: 14, fontWeight: '600' },
  hint: { color: '#bbb', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
