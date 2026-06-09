import { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { sendMessage, Message } from '../utils/conversation';
import { startListening, stopListening, isSpeechSupported } from '../utils/speech';

export default function ConversationScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const listRef = useRef<FlatList>(null);
  const interimRef = useRef('');

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
      const reply = await sendMessage(content, messages);
      setMessages([...next, { role: 'assistant', content: reply }]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMic = () => {
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
    if (!isSpeechSupported()) return;
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

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.bubbleText, isUser ? styles.userText : styles.assistantText]}>
          {item.content}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>What's on your mind?</Text>
            <Text style={styles.emptyHint}>Ask about your goals, projects, or anything in your second brain.</Text>
            {['What should I focus on today?', 'What are my active goals?', 'Any tasks due soon?'].map(s => (
              <TouchableOpacity key={s} style={styles.suggestion} onPress={() => handleSend(s)}>
                <Text style={styles.suggestionText}>{s}</Text>
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
            <ActivityIndicator size="small" color="#6B4EFF" />
            <Text style={styles.typingText}>thinking…</Text>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.inputRow}>
          {(Platform.OS === 'web' && isSpeechSupported()) || Platform.OS !== 'web' ? (
            <TouchableOpacity
              style={[styles.micBtn, isListening && styles.micBtnActive]}
              onPress={handleMic}
            >
              <Text style={styles.micIcon}>{isListening ? '⏹' : '🎙'}</Text>
            </TouchableOpacity>
          ) : null}
          <TextInput
            style={styles.input}
            placeholder="Ask anything…"
            placeholderTextColor="#aaa"
            value={input}
            onChangeText={setInput}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => handleSend()}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  suggestion: {
    backgroundColor: '#F5F3FF', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 10,
  },
  suggestionText: { color: '#6B4EFF', fontSize: 14, fontWeight: '500' },
  messageList: { padding: 16, paddingBottom: 8 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12, marginBottom: 10 },
  userBubble: { backgroundColor: '#6B4EFF', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: '#F5F3FF', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
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
  micBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F3FF',
    alignItems: 'center', justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: '#FFE9E9' },
  micIcon: { fontSize: 18 },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#333',
    maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#6B4EFF',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#ddd' },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
