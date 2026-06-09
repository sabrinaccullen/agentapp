import { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { sendMessage, Message, ConversationMode } from '../utils/conversation';
import { startListening, stopListening, isSpeechSupported } from '../utils/speech';
import { startRecording, stopRecording } from '../utils/audio';
import { transcribeAudio } from '../utils/transcribe';

const MODES: { key: ConversationMode; label: string; color: string; suggestions: string[] }[] = [
  {
    key: 'task',
    label: 'Task',
    color: '#FF6B35',
    suggestions: ['Remind me to call the bank at 2pm', 'Add milk to my grocery list', 'What tasks are due today?'],
  },
  {
    key: 'chat',
    label: 'Rubber Duck',
    color: '#6B4EFF',
    suggestions: ["I'm feeling stuck on something", "What's been on my mind lately?", 'Help me think through a decision'],
  },
  {
    key: 'plan',
    label: 'Plan',
    color: '#2196F3',
    suggestions: ['Help me plan my week', 'Build out a project page for my costume', 'What should I focus on to hit my June 30 deadline?'],
  },
];

export default function ConversationScreen() {
  const [mode, setMode] = useState<ConversationMode>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const listRef = useRef<FlatList>(null);
  const interimRef = useRef('');
  const currentMode = MODES.find(m => m.key === mode)!;

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const userMsg: Message = { role: 'user', content };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setError('');
    setLoading(true);
    try {
      const reply = await sendMessage(content, messages, mode);
      setMessages([...next, { role: 'assistant', content: reply }]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Tap-to-toggle mic for Task and Plan modes
  const handleMicTap = () => {
    if (isListening) {
      stopListening();
      setIsListening(false);
      if (interimRef.current.trim()) {
        handleSend(interimRef.current.trim());
        interimRef.current = '';
        setInput('');
      }
      return;
    }
    if (!isSpeechSupported() && Platform.OS === 'web') return;
    interimRef.current = '';
    startListening(
      (text, isFinal) => {
        if (isFinal) {
          interimRef.current += (interimRef.current ? ' ' : '') + text;
          setInput(interimRef.current);
        } else {
          setInput((interimRef.current + ' ' + text).trim());
        }
      },
      () => setIsListening(false)
    );
    setIsListening(true);
  };

  // Press-and-hold mic for Rubber Duck mode (native only)
  const handleMicPressIn = async () => {
    if (Platform.OS === 'web') { handleMicTap(); return; }
    interimRef.current = '';
    try {
      await startRecording();
      setIsListening(true);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleMicPressOut = async () => {
    if (Platform.OS === 'web') return;
    if (!isListening) return;
    setIsListening(false);
    setLoading(true);
    try {
      const uri = await stopRecording();
      if (uri) {
        const text = await transcribeAudio(uri);
        if (text.trim()) await handleSend(text.trim());
      }
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleModeChange = (newMode: ConversationMode) => {
    setMode(newMode);
    setMessages([]);
    setInput('');
    setError('');
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubble, isUser
        ? [styles.userBubble, { backgroundColor: currentMode.color }]
        : styles.assistantBubble
      ]}>
        <Text style={[styles.bubbleText, isUser ? styles.userText : styles.assistantText]}>
          {item.content}
        </Text>
      </View>
    );
  };

  const isRubberDuck = mode === 'chat';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={{ flex: 1, backgroundColor: '#fff' }}>

        {/* Mode selector */}
        <View style={styles.modeBar}>
          {MODES.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[styles.modeBtn, mode === m.key && { backgroundColor: m.color }]}
              onPress={() => handleModeChange(m.key)}
            >
              <Text style={[styles.modeBtnText, mode === m.key && styles.modeBtnTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyHint}>
              {isRubberDuck
                ? 'Press and hold the mic to speak.'
                : 'What do you need?'}
            </Text>
            {currentMode.suggestions.map(s => (
              <TouchableOpacity key={s} style={[styles.suggestion, { borderColor: currentMode.color }]} onPress={() => handleSend(s)}>
                <Text style={[styles.suggestionText, { color: currentMode.color }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {loading && (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={currentMode.color} />
            <Text style={styles.typingText}>
              {mode === 'task' ? 'on it…' : mode === 'plan' ? 'planning…' : 'thinking…'}
            </Text>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Input row */}
        <View style={styles.inputRow}>
          {isRubberDuck ? (
            <TouchableOpacity
              style={[styles.holdMicBtn, { backgroundColor: isListening ? '#E53935' : currentMode.color }]}
              onPressIn={handleMicPressIn}
              onPressOut={handleMicPressOut}
              delayLongPress={0}
            >
              <Text style={styles.holdMicIcon}>{isListening ? '⏹' : '🎙'}</Text>
              <Text style={styles.holdMicLabel}>{isListening ? 'Release to send' : 'Hold to speak'}</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.micBtn, isListening && styles.micBtnActive]}
                onPress={handleMicTap}
              >
                <Text style={styles.micIcon}>{isListening ? '⏹' : '🎙'}</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder={mode === 'task' ? 'What needs doing?' : 'Describe your project…'}
                placeholderTextColor="#aaa"
                value={input}
                onChangeText={setInput}
                multiline
                onSubmitEditing={() => handleSend()}
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: currentMode.color }, (!input.trim() || loading) && styles.sendBtnDisabled]}
                onPress={() => handleSend()}
                disabled={!input.trim() || loading}
              >
                <Text style={styles.sendIcon}>↑</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  modeBar: {
    flexDirection: 'row', padding: 12, gap: 8,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  modeBtn: {
    flex: 1, borderRadius: 20, paddingVertical: 8,
    alignItems: 'center', backgroundColor: '#F5F5F5',
  },
  modeBtnText: { fontSize: 13, fontWeight: '600', color: '#999' },
  modeBtnTextActive: { color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyHint: { fontSize: 15, color: '#999', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  suggestion: {
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 16,
    paddingVertical: 10, marginBottom: 10,
  },
  suggestionText: { fontSize: 14, fontWeight: '500' },
  messageList: { padding: 16, paddingBottom: 8 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12, marginBottom: 10 },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: '#F5F5F5', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#fff' },
  assistantText: { color: '#333' },
  typingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
  typingText: { color: '#999', fontSize: 13 },
  errorText: { color: '#E53935', fontSize: 13, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12,
    borderTopWidth: 1, borderTopColor: '#eee', gap: 8,
  },
  holdMicBtn: {
    flex: 1, borderRadius: 28, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  holdMicIcon: { fontSize: 28, marginBottom: 4 },
  holdMicLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
  micBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F3FF',
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: '#FFE9E9' },
  micIcon: { fontSize: 18 },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#333', maxHeight: 100,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#ddd' },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
