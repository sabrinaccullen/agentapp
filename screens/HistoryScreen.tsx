import { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, Animated, LayoutAnimation, UIManager, Platform,
  AccessibilityInfo, Dimensions, StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CaretLeft, MagnifyingGlass, X, CloudCheck, CloudArrowUp, CloudSlash,
  PencilSimpleLine,
} from 'phosphor-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getAllCaptures, deleteCapture, Capture } from '../utils/database';
import { processAndSyncCapture } from '../utils/queue';
import { useTheme } from '../contexts/ThemeContext';
import type { RootStackParamList } from './HomeScreen';
import OverlayPanel from './OverlayPanel';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const OVERLAY_HEIGHT = SCREEN_HEIGHT * 0.92;
const SEARCH_DEBOUNCE_MS = 200;

type HistoryNavigationProp = NativeStackNavigationProp<RootStackParamList, 'History'>;

interface Props {
  navigation: HistoryNavigationProp;
}

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

const QUEUE_LABEL: Record<Capture['processingStatus'], string> = {
  processing: 'Processing',
  processed: 'Processed',
  failed: 'Failed',
};

function CloudIcon({ status, color }: { status: Capture['syncStatus']; color: { synced: string; pending: string; failed: string } }) {
  if (status === 'synced') return <CloudCheck size={16} color={color.synced} weight="fill" />;
  if (status === 'failed') return <CloudSlash size={16} color={color.failed} weight="regular" />;
  return <CloudArrowUp size={16} color={color.pending} weight="regular" />;
}

export default function HistoryScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const c = theme.colors;

  const [captures, setCaptures] = useState<Capture[]>([]);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const dimAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(OVERLAY_HEIGHT)).current;
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    getAllCaptures().then(setCaptures).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearchQuery(searchInput), SEARCH_DEBOUNCE_MS);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchInput]);

  const animateLayout = useCallback(() => {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [reduceMotion]);

  const toggleSearch = useCallback(() => {
    animateLayout();
    if (searchVisible) {
      setSearchVisible(false);
      setSearchInput('');
      setSearchQuery('');
    } else {
      setSearchVisible(true);
    }
  }, [searchVisible, animateLayout]);

  const toggleExpand = useCallback((id: string) => {
    animateLayout();
    setDeleteConfirmId(null);
    setExpandedId(prev => (prev === id ? null : id));
  }, [animateLayout]);

  const handleDeleteConfirm = useCallback(async (id: string) => {
    animateLayout();
    await deleteCapture(id);
    setDeleteConfirmId(null);
    setExpandedId(null);
    load();
  }, [animateLayout, load]);

  const handleRetrySync = useCallback(async (item: Capture) => {
    setRetryingId(item.id);
    await processAndSyncCapture(item);
    setRetryingId(null);
    load();
  }, [load]);

  const openOverlay = useCallback(() => {
    setOverlayOpen(true);
    if (reduceMotion) {
      dimAnim.setValue(0.4);
      slideAnim.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 80, stiffness: 400, mass: 1 }),
      Animated.timing(dimAnim, { toValue: 0.4, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [reduceMotion, slideAnim, dimAnim]);

  const closeOverlay = useCallback(() => {
    if (reduceMotion) {
      dimAnim.setValue(0);
      slideAnim.setValue(OVERLAY_HEIGHT);
      setOverlayOpen(false);
      load();
      return;
    }
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: OVERLAY_HEIGHT, duration: 280, useNativeDriver: true }),
      Animated.timing(dimAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => { setOverlayOpen(false); load(); });
  }, [reduceMotion, slideAnim, dimAnim, load]);

  const query = searchQuery.trim().toLowerCase();
  const notes = captures.filter(item => !query || item.text.toLowerCase().includes(query));
  const showNoResults = query.length > 0 && notes.length === 0;

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient colors={[c.bgStart, c.bgEnd]} style={StyleSheet.absoluteFill} />

      <View style={[styles.topBar, { marginTop: insets.top + 20 }]}>
        <TouchableOpacity style={styles.backArea} onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <CaretLeft size={20} color={c.textPrimary} weight="regular" />
          <Text style={[styles.topBarLabel, { color: c.textPrimary }]}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleSearch} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          {searchVisible ? (
            <Text style={[styles.doneLabel, { color: c.textPrimary }]}>Done</Text>
          ) : (
            <MagnifyingGlass size={20} color={c.textPrimary} weight="regular" />
          )}
        </TouchableOpacity>
      </View>

      {searchVisible && (
        <View style={[styles.searchBarWrap, { marginTop: 12 }]}>
          <View style={[styles.searchBar, { backgroundColor: c.entryFill }]}>
            <MagnifyingGlass size={16} color={c.textMuted} weight="regular" />
            <TextInput
              style={[styles.searchInput, { color: c.textPrimary }]}
              placeholder="Search…"
              placeholderTextColor={c.textMuted}
              value={searchInput}
              onChangeText={setSearchInput}
              autoFocus
            />
            {searchInput.length > 0 && (
              <TouchableOpacity onPress={() => setSearchInput('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color={c.textMuted} weight="regular" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {showNoResults ? (
          <Text style={[styles.noResults, { color: c.textMuted }]}>No results.</Text>
        ) : (
          <>
            <Text style={[styles.sectionHeader, { color: c.textMuted }]}>Notes</Text>
            {notes.length === 0 ? (
              <Text style={[styles.emptyText, { color: c.textMuted }]}>
                {query ? 'No notes match your search.' : 'No notes yet.'}
              </Text>
            ) : (
              notes.map(item => {
                const expanded = expandedId === item.id;
                const confirming = deleteConfirmId === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.9}
                    onPress={() => toggleExpand(item.id)}
                    style={[
                      styles.card,
                      { backgroundColor: expanded ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.07)' },
                    ]}
                  >
                    <View style={styles.cardTopRow}>
                      <Text
                        style={[styles.cardText, { color: c.textPrimary }]}
                        numberOfLines={expanded ? undefined : 2}
                      >
                        {item.text}
                      </Text>
                      <View style={styles.cloudIconSlot}>
                        <CloudIcon
                          status={item.syncStatus}
                          color={{ synced: '#4ADE80', pending: `${c.textPrimary}66`, failed: `${c.textPrimary}B3` }}
                        />
                      </View>
                    </View>
                    <Text style={[styles.timestamp, { color: c.textMuted }]}>{timeLabel(item.createdAt)}</Text>

                    {expanded && (
                      <View style={[styles.expandedSection, { borderTopColor: c.separator }]}>
                        {confirming ? (
                          <View style={styles.confirmRow}>
                            <Text style={[styles.confirmText, { color: c.textPrimary }]}>Delete this note?</Text>
                            <View style={styles.confirmActions}>
                              <TouchableOpacity onPress={() => setDeleteConfirmId(null)}>
                                <Text style={[styles.cancelLabel, { color: c.textMuted }]}>Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDeleteConfirm(item.id)}>
                                <Text style={styles.deleteLabel}>Delete</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <View style={styles.expandedRow}>
                            <View style={styles.queueStateRow}>
                              <View style={[styles.queueDot, { backgroundColor: c.textMuted }]} />
                              <Text style={[styles.queueLabel, { color: c.textMuted }]}>
                                {retryingId === item.id ? 'Processing' : QUEUE_LABEL[item.processingStatus]}
                              </Text>
                            </View>
                            <View style={styles.expandedActions}>
                              {item.syncStatus === 'failed' && (
                                <TouchableOpacity onPress={() => handleRetrySync(item)}>
                                  <Text style={[styles.retryLabel, { color: theme.colors.textPrimary }]}>Retry sync</Text>
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity onPress={() => setDeleteConfirmId(item.id)}>
                                <Text style={styles.deleteLabel}>Delete</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.composeBtn, { bottom: insets.bottom + 16, backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.12)' }]}
        onPress={openOverlay}
        activeOpacity={0.85}
      >
        <PencilSimpleLine size={20} color={c.textPrimary} weight="regular" />
      </TouchableOpacity>

      {overlayOpen && (
        <Animated.View style={[styles.dim, { opacity: dimAnim }]} pointerEvents="box-none">
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeOverlay} activeOpacity={1} />
        </Animated.View>
      )}

      {overlayOpen && (
        <Animated.View style={[styles.overlayContainer, { transform: [{ translateY: slideAnim }] }]}>
          <OverlayPanel onRequestClose={closeOverlay} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backArea: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topBarLabel: { fontSize: 17, fontWeight: '600' },
  doneLabel: { fontSize: 17, fontWeight: '400' },
  searchBarWrap: { paddingHorizontal: 20 },
  searchBar: {
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 },
  sectionHeader: { fontSize: 13, fontWeight: '600', marginBottom: 8, opacity: 0.55 },
  emptyText: { fontSize: 16, textAlign: 'center', opacity: 0.45, paddingVertical: 24 },
  noResults: { fontSize: 14, textAlign: 'center', opacity: 0.4, paddingTop: 24 },
  card: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardText: { fontSize: 16, opacity: 0.9, flex: 1 },
  cloudIconSlot: { marginTop: 2 },
  timestamp: { fontSize: 13, opacity: 0.45, marginTop: 6 },
  expandedSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  expandedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  queueStateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  queueDot: { width: 6, height: 6, borderRadius: 3 },
  queueLabel: { fontSize: 13, opacity: 0.6 },
  expandedActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  retryLabel: { fontSize: 13, fontWeight: '500' },
  deleteLabel: { fontSize: 13, fontWeight: '500', color: '#EF4444' },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confirmText: { fontSize: 14, opacity: 0.9 },
  confirmActions: { flexDirection: 'row', gap: 16 },
  cancelLabel: { fontSize: 13, fontWeight: '500' },
  composeBtn: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: '#000' },
  overlayContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: OVERLAY_HEIGHT,
  },
});
