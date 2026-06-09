import { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput,
  TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { startListening, stopListening, isSpeechSupported } from '../utils/speech';
import { startRecording, stopRecording } from '../utils/audio';
import { transcribeAudio } from '../utils/transcribe';
import { saveCapture } from '../utils/database';

export default function CaptureScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [textInput, setTextInput] = useState('');
  const [saved, setSaved] = useState(false);
  const [recordError, setRecordError] = useState('');
  const finalTextRef = useRef('');

  const handleToggleRecording = async () => {
    if (Platform.OS !== 'web') {
      if (isRecording) {
        setIsRecording(false);
        setInterimText('Transcribing…');
        setRecordError('');
        try {
          const uri = await stopRecording();
          if (uri) {
            const text = await transcribeAudio(uri);
            finalTextRef.current += (finalTextRef.current ? ' ' : '') + text;
            setTranscript(finalTextRef.current);
          }
        } catch (e: any) {
          setRecordError(e.message);
        } finally {
          setInterimText('');
        }
      } else {
        setSaved(false);
        setRecordError('');
        try {
          await startRecording();
          setIsRecording(true);
        } catch (e: any) {
          setRecordError(e.message);
        }
      }
      return;
    }

    if (isRecording) {
      stopListening();
      setIsRecording(false);
      setInterimText('');
    } else {
      setSaved(false);
      finalTextRef.current = transcript;
      startListening(
        (text, isFinal) => {
          if (isFinal) {
            finalTextRef.current += (finalTextRef.current ? ' ' : '') + text;
            setTranscript(finalTextRef.current);
            setInterimText('');
          } else {
            setInterimText(text);
          }
        },
        (error) => {
          console.error(error);
          setIsRecording(false);
        }
      );
      setIsRecording(true);
    }
  };

  const handleSave = async () => {
    const text = transcript || textInput;
    if (!text.trim()) return;
    await saveCapture(text);
    setSaved(true);
    setTranscript('');
    setTextInput('');
    finalTextRef.current = '';
    setInterimText('');
  };

  const handleDiscard = () => {
    if (isRecording) {
      if (Platform.OS === 'web') stopListening();
      else stopRecording().catch(() => {});
    }
    setIsRecording(false);
    setTranscript('');
    setTextInput('');
    setInterimText('');
    setRecordError('');
    finalTextRef.current = '';
    setSaved(false);
  };

  const displayText = transcript + (interimText ? (transcript ? ' ' : '') + interimText : '');
  const hasContent = !!(transcript || textInput.trim());

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* Dictation button */}
      {isSpeechSupported() && (
        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordButtonActive]}
          onPress={handleToggleRecording}
        >
          <Text style={styles.recordIcon}>{isRecording ? '⏹' : '🎙'}</Text>
          <Text style={styles.recordLabel}>
            {isRecording ? 'Tap to stop' : 'Tap to dictate'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Live transcript */}
      {displayText ? (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptText}>{displayText}</Text>
          {interimText ? <Text style={styles.interimLabel}>listening…</Text> : null}
        </View>
      ) : null}

      {/* Text input */}
      <TextInput
        style={styles.textInput}
        placeholder="Or type a note here…"
        placeholderTextColor="#aaa"
        value={textInput}
        onChangeText={setTextInput}
        multiline
      />

      {/* Actions */}
      {hasContent && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.discardButton} onPress={handleDiscard}>
            <Text style={styles.discardText}>Discard</Text>
          </TouchableOpacity>
        </View>
      )}

      {recordError ? <Text style={styles.errorText}>{recordError}</Text> : null}
      {saved && <Text style={styles.savedConfirm}>✓ Capture saved</Text>}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#fff' },
  recordButton: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#6B4EFF', borderRadius: 80,
    width: 140, height: 140, alignSelf: 'center',
    marginBottom: 28, marginTop: 12,
  },
  recordButtonActive: { backgroundColor: '#E53935' },
  recordIcon: { fontSize: 40 },
  recordLabel: { color: '#fff', fontSize: 13, marginTop: 4, fontWeight: '600' },
  transcriptBox: {
    backgroundColor: '#F5F3FF', borderRadius: 10,
    padding: 14, marginBottom: 16,
  },
  transcriptText: { fontSize: 16, color: '#333', lineHeight: 24 },
  interimLabel: { fontSize: 11, color: '#9B8AFF', marginTop: 6 },
  textInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 12, fontSize: 15, color: '#333',
    minHeight: 80, textAlignVertical: 'top', marginBottom: 16,
  },
  actions: { flexDirection: 'row', gap: 12 },
  saveButton: {
    flex: 1, backgroundColor: '#6B4EFF',
    borderRadius: 8, padding: 14, alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  discardButton: {
    flex: 1, borderWidth: 1, borderColor: '#ddd',
    borderRadius: 8, padding: 14, alignItems: 'center',
  },
  discardText: { color: '#666', fontSize: 15 },
  savedConfirm: { color: '#4CAF50', textAlign: 'center', marginTop: 16, fontSize: 14 },
  errorText: { color: '#E53935', textAlign: 'center', marginTop: 12, fontSize: 13 },
});
