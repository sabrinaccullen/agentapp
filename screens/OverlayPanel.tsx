import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, FlatList, KeyboardAvoidingView, Platform,
  Alert, Dimensions, AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Waveform, ArrowUp, Check } from 'phosphor-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { sendMessage, type Message } from '../utils/conversation';
import { saveCapture, getConversationMessages, appendConversationMessage } from '../utils/database';
import { startRecording, stopRecording } from '../utils/audio';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const OVERLAY_COLORS: Record<string, { bgStart: string; bgEnd: string }> = {
  'Golden Hour': { bgStart: '#0E0603', bgEnd: '#1E0C0E' },
  'Candlelight': { bgStart: '#0D0600', bgEnd: '#180D05' },
  'Shoreline':   { bgStart: '#040B0E', bgEnd: '#061520' },
  'Overcast':    { bgStart: '#0A0B0E', bgEnd: '#111520' },
};

type Mode = 'note' | 'vesper';

interface LoadingDotProps { delay: number; color: string }

function LoadingDot({ delay, color }: LoadingDotProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity, delay]);

  return (
    <Animated.View style={[styles.dot, { backgroundColor: color, opacity }]} />
  );
}

interface Props {
  onRequestClose: () => void;
}

export default function OverlayPanel({ onRequestClose }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('note');
  const [noteText, setNoteText] = useState('');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const listRef = useRef<FlatList>(null);
  const isListeningRef = useRef(false);
  const noteInputRef = useRef<TextInput>(null);
  const underlineAnim = useRef(new Animated.Value(0)).current;
  const saveFadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    getConversationMessages().then(setMessages);
  }, []);

  useEffect(() => {
    return () => {
      if (isListeningRef.current) stopRecording().catch(() => {});
    };
  }, []);

  const switchMode = useCallback((next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setError('');
    const toValue = next === 'vesper' ? 1 : 0;
    if (reduceMotion) {
      underlineAnim.setValue(toValue);
    } else {
      Animated.timing(underlineAnim, { toValue, duration: 200, useNativeDriver: true }).start();
    }
  }, [mode, reduceMotion, underlineAnim]);

  const handleClose = useCallback(() => {
    if (mode === 'note' && noteText.trim().length > 0) {
      Alert.alert(
        'Discard note?',
        '',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onRequestClose },
        ]
      );
      return;
    }
    onRequestClose();
  }, [mode, noteText, onRequestClose]);

  const startDictation = useCallback(async () => {
    setError('');
    try {
      await startRecording();
      setIsListening(true);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const stopDictation = useCallback(async () => {
    if (!isListeningRef.current) return;
    setIsListening(false);
    setIsTranscribing(true);
    try {
      const uri = await stopRecording();
      if (uri) {
        const { transcribeAudio } = require('../utils/transcribe');
        const transcribed: string = await transcribeAudio(uri);
        if (transcribed.trim()) {
          setNoteText(prev => prev ? prev + '\n' + transcribed.trim() : transcribed.trim());
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const handleDictationToggle = useCallback(() => {
    if (isListening) stopDictation();
    else startDictation();
  }, [isListening, startDictation, stopDictation]);

  const handleNoteSave = useCallback(async () => {
    if (!noteText.trim()) return;
    try {
      await saveCapture(noteText.trim(), 'note');
      Animated.sequence([
        Animated.timing(saveFadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(saveFadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
      setNoteSaved(true);
      setTimeout(() => {
        setNoteSaved(false);
        setNoteText('');
        onRequestClose();
      }, 600);
    } catch (e: any) {
      setError(e.message);
    }
  }, [noteText, saveFadeAnim, onRequestClose]);

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? inputText).trim();
    if (!content || loading) return;
    const userMsg: Message = { role: 'user', content };
    const next = [...messages, userMsg];
    setMessages(next);
    setInputText('');
    setError('');
    setLoading(true);
    await appendConversationMessage('user', content);
    try {
      const reply = await sendMessage(content, messages);
      const updated = [...next, { role: 'assistant' as const, content: reply }];
      setMessages(updated);
      await appendConversationMessage('assistant', reply);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [inputText, loading, messages]);

  const handleConversationDictation = useCallback(async () => {
    if (isListening) {
      setIsListening(false);
      setIsTranscribing(true);
      try {
        const uri = await stopRecording();
        if (uri) {
          const { transcribeAudio } = require('../utils/transcribe');
          const transcribed: string = await transcribeAudio(uri);
          if (transcribed.trim()) await handleSend(transcribed.trim());
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsTranscribing(false);
      }
      return;
    }
    setError('');
    try {
      await startRecording();
      setIsListening(true);
    } catch (e: any) {
      setError(e.message);
    }
  }, [isListening, handleSend]);

  const c = theme.colors;
  const overlayGradient = OVERLAY_COLORS[theme.name] ?? OVERLAY_COLORS['Golden Hour'];
  const noteEmpty = noteText.trim().length === 0;

  // Underline interpolation: slides between Note (left ~0) and Vesper positions
  // We animate a translateX from 0 → label width offset; easiest to just use opacity + absolute positioning
  const noteUnderlineOpacity = underlineAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const vesperUnderlineOpacity = underlineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={[overlayGradient.bgStart, overlayGradient.bgEnd]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <View style={styles.modeToggle}>
          <View style={styles.modeItem}>
            <TouchableOpacity onPress={() => switchMode('note')}>
              <Text style={[styles.modeLabel, { color: mode === 'note' ? c.textPrimary : `${c.textPrimary}73` }]}>
                Note
              </Text>
            </TouchableOpacity>
            <Animated.View style={[styles.modeUnderline, { backgroundColor: c.textPrimary, opacity: noteUnderlineOpacity }]} />
          </View>

          <View style={[styles.modeItem, { marginLeft: 24 }]}>
            <TouchableOpacity onPress={() => switchMode('vesper')}>
              <Text style={[styles.modeLabel, { color: mode === 'vesper' ? c.textPrimary : `${c.textPrimary}73` }]}>
                Vesper
              </Text>
            </TouchableOpacity>
            <Animated.View style={[styles.modeUnderline, { backgroundColor: c.textPrimary, opacity: vesperUnderlineOpacity }]} />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.closeBtn}
        >
          <X size={20} color={c.textMuted} weight="regular" />
        </TouchableOpacity>
      </View>

      {mode === 'note' ? (
        <>
          <View style={styles.noteBody}>
            <TextInput
              ref={noteInputRef}
              style={[styles.noteInput, { color: c.textPrimary }]}
              placeholder="Start writing…"
              placeholderTextColor={`${c.textPrimary}66`}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              textAlignVertical="top"
              autoFocus
            />
            {noteText.length > 0 && (
              <Text style={[styles.charCount, { color: `${c.textPrimary}66` }]}>
                {noteText.length}
              </Text>
            )}
          </View>

          {error ? (
            <Text style={[styles.inlineError, { color: c.textMuted }]}>{error}</Text>
          ) : null}

          <View style={[styles.toolbar, { borderTopColor: c.separator, paddingBottom: insets.bottom || 16 }]}>
            <TouchableOpacity style={styles.dictateBtn} onPress={handleDictationToggle}>
              <Waveform size={20} color={isListening ? c.textPrimary : c.textMuted} weight="regular" />
              <Text style={[styles.toolbarLabel, { color: isListening ? c.textPrimary : c.textMuted }]}>
                {isTranscribing ? 'Processing…' : isListening ? 'Listening' : 'Speak'}
              </Text>
              {isListening && <View style={[styles.listeningDot, { backgroundColor: c.textPrimary }]} />}
            </TouchableOpacity>

            <Animated.View style={{ opacity: saveFadeAnim }}>
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: noteEmpty ? 'transparent' : c.entryFill },
                  noteEmpty && styles.saveBtnDisabled,
                ]}
                onPress={noteSaved ? undefined : handleNoteSave}
                disabled={noteEmpty}
              >
                {noteSaved ? (
                  <Check size={16} color={c.textPrimary} weight="bold" />
                ) : (
                  <Text style={[styles.saveBtnText, { color: noteEmpty ? c.textMuted : c.textPrimary }]}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => (
              item.role === 'user' ? (
                <View style={[styles.userBlock, { backgroundColor: c.entryFill }]}>
                  <Text style={[styles.userText, { color: `${c.textPrimary}D9` }]}>
                    {item.content}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.vesperText, { color: c.textPrimary }]}>
                  {item.content}
                </Text>
              )
            )}
            ListFooterComponent={
              loading ? (
                <View style={styles.dotsRow}>
                  <LoadingDot delay={0} color={c.textMuted} />
                  <LoadingDot delay={200} color={c.textMuted} />
                  <LoadingDot delay={400} color={c.textMuted} />
                </View>
              ) : null
            }
          />

          {error ? (
            <Text style={[styles.inlineError, { color: c.textMuted }]}>{error}</Text>
          ) : null}

          <View style={[styles.inputRow, { borderTopColor: c.separator, paddingBottom: insets.bottom || 16 }]}>
            <View style={[styles.inputPill, { backgroundColor: c.entryFill }]}>
              <TextInput
                style={[styles.inputField, { color: c.textPrimary }]}
                placeholder="Say something…"
                placeholderTextColor={`${c.textPrimary}66`}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={() => handleSend()}
                returnKeyType="send"
                blurOnSubmit={false}
              />
              <TouchableOpacity
                onPress={handleConversationDictation}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Waveform
                  size={20}
                  color={isListening ? c.textPrimary : c.textMuted}
                  weight="regular"
                />
              </TouchableOpacity>
              {inputText.trim().length > 0 && (
                <TouchableOpacity
                  onPress={() => handleSend()}
                  style={[styles.sendBtn, { backgroundColor: c.entryFill }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <ArrowUp size={16} color={c.textPrimary} weight="bold" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  modeItem: {
    alignItems: 'flex-start',
  },
  modeLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  modeUnderline: {
    height: 2,
    width: '100%',
    borderRadius: 1,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  noteInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 26,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 13,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dictateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolbarLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  listeningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  saveBtn: {
    height: 36,
    minWidth: 72,
    borderRadius: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.35,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  inlineError: {
    fontSize: 13,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 16,
  },
  userBlock: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  userText: {
    fontSize: 16,
    lineHeight: 24,
  },
  vesperText: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: 'CormorantGaramond_400Regular',
    marginTop: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 4,
    paddingLeft: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  inputRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputPill: {
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  inputField: {
    flex: 1,
    fontSize: 16,
  },
  sendBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
