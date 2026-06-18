import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Animated, Easing, PanResponder, StatusBar, AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { CaretLeft, CircleIcon, CheckCircle, Clock, Trash } from 'phosphor-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getAllCaptures, deleteCapture, setCompleted, type Capture } from '../utils/database';
import { useTheme } from '../contexts/ThemeContext';
import type { RootStackParamList } from './HomeScreen';

type TasksRemindersNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TasksReminders'>;
interface Props { navigation: TasksRemindersNavigationProp; }

const COMPLETED_COLLAPSE_THRESHOLD = 5;
const DELETE_REVEAL_WIDTH = 80;

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

interface CardProps {
  item: Capture;
  type: 'task' | 'reminder';
  accent: string;
  textPrimary: string;
  textMuted: string;
  reduceMotionRef: React.MutableRefObject<boolean>;
  onComplete: () => void;
  onDelete: () => void;
}

function SwipeableItemCard({ item, type, accent, textPrimary, textMuted, reduceMotionRef, onComplete, onDelete }: CardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const swipedRef = useRef(false);
  const confirmingRef = useRef(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const snapBack = useCallback(() => {
    const dur = reduceMotionRef.current ? 0 : 150;
    Animated.timing(translateX, { toValue: 0, duration: dur, useNativeDriver: true, easing: Easing.out(Easing.ease) }).start();
    swipedRef.current = false;
    confirmingRef.current = false;
    setConfirmingDelete(false);
  }, [translateX, reduceMotionRef]);

  const handleDeleteReveal = useCallback(() => {
    const dur = reduceMotionRef.current ? 0 : 150;
    Animated.timing(translateX, { toValue: 0, duration: dur, useNativeDriver: true }).start();
    swipedRef.current = false;
    confirmingRef.current = true;
    setConfirmingDelete(true);
  }, [translateX, reduceMotionRef]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        !confirmingRef.current &&
        Math.abs(gs.dx) > Math.abs(gs.dy) &&
        Math.abs(gs.dx) > 8,
      onPanResponderMove: (_, gs) => {
        const base = swipedRef.current ? -DELETE_REVEAL_WIDTH : 0;
        translateX.setValue(Math.max(-DELETE_REVEAL_WIDTH, Math.min(0, base + gs.dx)));
      },
      onPanResponderRelease: (_, gs) => {
        const base = swipedRef.current ? -DELETE_REVEAL_WIDTH : 0;
        const effective = base + gs.dx;
        const dur = reduceMotionRef.current ? 0 : 150;
        if (effective < -40) {
          Animated.timing(translateX, { toValue: -DELETE_REVEAL_WIDTH, duration: dur, useNativeDriver: true, easing: Easing.out(Easing.ease) }).start();
          swipedRef.current = true;
        } else {
          Animated.timing(translateX, { toValue: 0, duration: dur, useNativeDriver: true, easing: Easing.out(Easing.ease) }).start();
          swipedRef.current = false;
        }
      },
    })
  ).current;

  const activeTextColor = `${textPrimary}E6`;
  const completedTextColor = `${textPrimary}66`;
  const timestampColor = `${textPrimary}73`;

  return (
    <View style={styles.cardOuter}>
      <TouchableOpacity style={styles.deleteAction} onPress={handleDeleteReveal} activeOpacity={0.8}>
        <Trash size={20} color="#fff" weight="regular" />
        <Text style={styles.deleteActionLabel}>Delete</Text>
      </TouchableOpacity>

      <Animated.View
        style={[styles.card, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {confirmingDelete ? (
          <View style={styles.confirmRow}>
            <Text style={[styles.confirmText, { color: activeTextColor }]}>
              {type === 'task' ? 'Delete this task?' : 'Delete this reminder?'}
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity onPress={snapBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.cancelLabel, { color: textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.deleteConfirmLabel}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.cardContent}>
            <TouchableOpacity
              onPress={!item.completed ? onComplete : undefined}
              disabled={item.completed}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {item.completed ? (
                <CheckCircle size={20} color={accent} weight="fill" />
              ) : type === 'task' ? (
                <CircleIcon size={20} color={textMuted} weight="regular" />
              ) : (
                <Clock size={20} color={textMuted} weight="regular" />
              )}
            </TouchableOpacity>
            <View style={styles.cardTextCol}>
              <Text
                style={[styles.cardText, { color: item.completed ? completedTextColor : activeTextColor }]}
                numberOfLines={2}
              >
                {item.text}
              </Text>
              <Text style={[styles.timestamp, { color: timestampColor }]}>
                {formatTimestamp(item.completed && item.completedAt ? item.completedAt : item.createdAt)}
              </Text>
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

export default function TasksRemindersScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const c = theme.colors;

  const [captures, setCaptures] = useState<Capture[]>([]);
  const [activeTab, setActiveTab] = useState<'tasks' | 'reminders'>('tasks');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [toastCapture, setToastCapture] = useState<Capture | null>(null);
  const [tasksBtnLayout, setTasksBtnLayout] = useState({ x: 0, width: 0 });
  const [remindersBtnLayout, setRemindersBtnLayout] = useState({ x: 0, width: 0 });

  const reduceMotionRef = useRef(false);
  const activeTabRef = useRef<'tasks' | 'reminders'>('tasks');
  const scrollRef = useRef<ScrollView>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const contentOpacity = useRef(new Animated.Value(1)).current;
  const underlineLeft = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => { reduceMotionRef.current = reduceMotion; }, [reduceMotion]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    return () => { if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current); };
  }, []);

  const load = useCallback(() => {
    getAllCaptures().then(setCaptures).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const target = activeTab === 'tasks' ? tasksBtnLayout : remindersBtnLayout;
    if (target.width === 0) return;
    const dur = reduceMotion ? 0 : 150;
    Animated.parallel([
      Animated.timing(underlineLeft, { toValue: target.x, duration: dur, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(underlineWidth, { toValue: target.width, duration: dur, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
    ]).start();
  }, [activeTab, tasksBtnLayout, remindersBtnLayout, reduceMotion, underlineLeft, underlineWidth]);

  const switchTab = useCallback((tab: 'tasks' | 'reminders') => {
    if (tab === activeTabRef.current) return;
    const dur = reduceMotionRef.current ? 0 : 150;
    Animated.timing(contentOpacity, { toValue: 0, duration: dur, useNativeDriver: true }).start(() => {
      setActiveTab(tab);
      setShowAllCompleted(false);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      Animated.timing(contentOpacity, { toValue: 1, duration: dur, useNativeDriver: true }).start();
    });
  }, [contentOpacity]);

  const handleComplete = useCallback(async (item: Capture) => {
    await setCompleted(item.id, true, Date.now());
    load();
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastCapture(item);
    toastTimeoutRef.current = setTimeout(() => {
      setToastCapture(null);
      toastTimeoutRef.current = null;
    }, 4000);
  }, [load]);

  const handleUndo = useCallback(async () => {
    if (!toastCapture) return;
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = null;
    await setCompleted(toastCapture.id, false, null);
    setToastCapture(null);
    load();
  }, [toastCapture, load]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteCapture(id);
    load();
  }, [load]);

  const tag = activeTab === 'tasks' ? 'task' : 'reminder';
  const filtered = captures.filter(cap => cap.tag === tag);
  const active = filtered.filter(cap => !cap.completed).sort((a, b) => b.createdAt - a.createdAt);
  const completed = filtered.filter(cap => cap.completed).sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt));
  const visibleCompleted = showAllCompleted ? completed : completed.slice(0, COMPLETED_COLLAPSE_THRESHOLD);
  const hiddenCount = completed.length - COMPLETED_COLLAPSE_THRESHOLD;

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient colors={[c.bgStart, c.bgEnd]} style={StyleSheet.absoluteFill} />

      <View style={[styles.topBar, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <CaretLeft size={20} color={c.textPrimary} weight="regular" />
          <Text style={[styles.backLabel, { color: c.textPrimary }]}>
            {activeTab === 'tasks' ? 'Tasks' : 'Reminders'}
          </Text>
        </TouchableOpacity>

        <View style={styles.toggleContainer}>
          <TouchableOpacity
            onLayout={e => setTasksBtnLayout({ x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width })}
            onPress={() => switchTab('tasks')}
            style={styles.toggleBtn}
          >
            <Text style={[styles.toggleLabel, { color: activeTab === 'tasks' ? c.textPrimary : `${c.textPrimary}73` }]}>
              Tasks
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onLayout={e => setRemindersBtnLayout({ x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width })}
            onPress={() => switchTab('reminders')}
            style={styles.toggleBtn}
          >
            <Text style={[styles.toggleLabel, { color: activeTab === 'reminders' ? c.textPrimary : `${c.textPrimary}73` }]}>
              Reminders
            </Text>
          </TouchableOpacity>
          <Animated.View
            style={[styles.toggleUnderline, { backgroundColor: c.accent, left: underlineLeft, width: underlineWidth }]}
          />
        </View>

        <View style={styles.topBarSpacer} />
      </View>

      <Animated.View style={[styles.flex1, { opacity: contentOpacity }]}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        >
          {active.length === 0 ? (
            <Text style={[styles.emptyText, { color: `${c.textPrimary}73` }]}>
              {activeTab === 'tasks' ? 'No tasks yet.' : 'No reminders yet.'}
            </Text>
          ) : (
            active.map(item => (
              <SwipeableItemCard
                key={item.id}
                item={item}
                type={tag}
                accent={c.accent}
                textPrimary={c.textPrimary}
                textMuted={c.textMuted}
                reduceMotionRef={reduceMotionRef}
                onComplete={() => handleComplete(item)}
                onDelete={() => handleDelete(item.id)}
              />
            ))
          )}

          {completed.length > 0 && (
            <>
              <View style={styles.completedHeader}>
                <View style={[styles.completedHairline, { backgroundColor: '#FFFFFF1A' }]} />
                <Text style={[styles.completedLabel, { color: `${c.textPrimary}66` }]}>Completed</Text>
                <View style={[styles.completedHairline, { backgroundColor: '#FFFFFF1A' }]} />
              </View>

              {visibleCompleted.map(item => (
                <SwipeableItemCard
                  key={item.id}
                  item={item}
                  type={tag}
                  accent={c.accent}
                  textPrimary={c.textPrimary}
                  textMuted={c.textMuted}
                  reduceMotionRef={reduceMotionRef}
                  onComplete={() => {}}
                  onDelete={() => handleDelete(item.id)}
                />
              ))}

              {!showAllCompleted && hiddenCount > 0 && (
                <TouchableOpacity onPress={() => setShowAllCompleted(true)} style={styles.showAllBtn}>
                  <Text style={[styles.showAllLabel, { color: c.accent }]}>
                    Show all ({completed.length})
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>

      {toastCapture !== null && (
        <View style={[styles.toast, { bottom: insets.bottom + 16 }]}>
          <Text style={styles.toastText}>
            {toastCapture.tag === 'task' ? 'Task completed.' : 'Reminder completed.'}
          </Text>
          <TouchableOpacity onPress={handleUndo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.toastUndo, { color: c.accent }]}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  backLabel: {
    fontSize: 17,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    paddingBottom: 4,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  toggleLabel: {
    fontSize: 15,
  },
  toggleUnderline: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    borderRadius: 1,
  },
  topBarSpacer: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    marginTop: 16,
    gap: 8,
  },
  completedHairline: {
    flex: 1,
    height: 1,
  },
  completedLabel: {
    fontSize: 13,
  },
  showAllBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  showAllLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  cardOuter: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_REVEAL_WIDTH,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteActionLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTextCol: {
    flex: 1,
    gap: 4,
  },
  cardText: {
    fontSize: 16,
  },
  timestamp: {
    fontSize: 13,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  confirmText: {
    fontSize: 14,
    flex: 1,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: 16,
  },
  cancelLabel: {
    fontSize: 14,
  },
  deleteConfirmLabel: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(30,30,30,0.94)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toastText: {
    color: '#FDF8F2',
    fontSize: 14,
    flex: 1,
  },
  toastUndo: {
    fontSize: 14,
    fontWeight: '500',
  },
});
