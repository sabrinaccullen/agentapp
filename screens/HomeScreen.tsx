import { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, AppState, AccessibilityInfo, Dimensions, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClockCounterClockwise, GearSix } from 'phosphor-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getSecure, saveSecure } from '../utils/storage';
import { useTheme } from '../contexts/ThemeContext';
import OverlayPanel from './OverlayPanel';

export type RootStackParamList = {
  Home: undefined;
  History: undefined;
  Settings: undefined;
};

type HomeNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeNavigationProp;
}

const FIRST_LAUNCH_KEY = 'vesper_first_launch_done';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const OVERLAY_HEIGHT = SCREEN_HEIGHT * 0.92;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning.';
  if (h >= 12 && h < 18) return 'Good afternoon.';
  return 'Good evening.';
}

export default function HomeScreen({ navigation }: Props) {
  const { theme, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [greeting, setGreeting] = useState(getGreeting);
  const [promptPlaceholder, setPromptPlaceholder] = useState("What's on your mind?");
  const [entryPressed, setEntryPressed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const contentOpacity = useRef(new Animated.Value(1)).current;
  const entryScale = useRef(new Animated.Value(1)).current;
  const dimAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(OVERLAY_HEIGHT)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);

    getSecure(FIRST_LAUNCH_KEY).then(val => {
      if (val === null) {
        setPromptPlaceholder('Say hello to Vesper.');
        saveSecure(FIRST_LAUNCH_KEY, 'done');
      }
    });

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') setGreeting(getGreeting());
    });
    return () => sub.remove();
  }, []);

  const openOverlay = useCallback(() => {
    setOverlayOpen(true);
    if (reduceMotion) {
      dimAnim.setValue(0.4);
      slideAnim.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 80,
        stiffness: 400,
        mass: 1,
      }),
      Animated.timing(dimAnim, { toValue: 0.4, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [reduceMotion, slideAnim, dimAnim]);

  const closeOverlay = useCallback(() => {
    if (reduceMotion) {
      dimAnim.setValue(0);
      slideAnim.setValue(OVERLAY_HEIGHT);
      setOverlayOpen(false);
      return;
    }
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: OVERLAY_HEIGHT, duration: 280, useNativeDriver: true }),
      Animated.timing(dimAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setOverlayOpen(false));
  }, [reduceMotion, slideAnim, dimAnim]);

  const handleCycleTheme = useCallback(() => {
    if (reduceMotion) { cycleTheme(); return; }
    Animated.timing(contentOpacity, { toValue: 0.08, duration: 200, useNativeDriver: true })
      .start(() => {
        cycleTheme();
        Animated.timing(contentOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
  }, [reduceMotion, cycleTheme, contentOpacity]);

  const handleEntryPressIn = useCallback(() => {
    setEntryPressed(true);
    Animated.spring(entryScale, { toValue: 0.97, useNativeDriver: true, speed: 60, bounciness: 0 }).start();
  }, [entryScale]);

  const handleEntryPressOut = useCallback(() => {
    setEntryPressed(false);
    Animated.spring(entryScale, { toValue: 1, useNativeDriver: true, speed: 60, bounciness: 0 }).start();
  }, [entryScale]);

  const c = theme.colors;

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <LinearGradient colors={[c.bgStart, c.bgEnd]} style={StyleSheet.absoluteFill} />

      <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
        {/* Header row */}
        <View style={[styles.header, { marginTop: insets.top + 20 }]}>
          <Text style={[styles.wordmark, { color: c.textPrimary }]}>vesper</Text>
          <TouchableOpacity
            onPress={handleCycleTheme}
            style={styles.themeBadge}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.themeIcon, { color: c.textSecondary }]}>◐</Text>
            <Text style={[styles.themeLabel, { color: c.textSecondary }]}>{theme.name}</Text>
          </TouchableOpacity>
        </View>

        {/* Greeting + entry prompt */}
        <View style={[styles.centreBlock, { top: SCREEN_HEIGHT * 0.40 }]}>
          <Text style={[styles.greeting, { color: c.textPrimary }]}>{greeting}</Text>
          <View style={styles.promptGap} />
          <TouchableOpacity
            activeOpacity={1}
            onPressIn={handleEntryPressIn}
            onPressOut={handleEntryPressOut}
            onPress={openOverlay}
          >
            <Animated.View
              style={[
                styles.entryPrompt,
                {
                  backgroundColor: entryPressed ? c.entryFillPressed : c.entryFill,
                  transform: [{ scale: entryScale }],
                },
              ]}
            >
              <Text style={[styles.entryPlaceholder, { color: c.entryPlaceholder }]}>
                {promptPlaceholder}
              </Text>
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Bottom nav */}
        <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={[styles.separator, { backgroundColor: c.separator }]} />
          <View style={styles.navRow}>
            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('History')}>
              <ClockCounterClockwise size={20} color={c.textMuted} weight="light" />
              <Text style={[styles.navLabel, { color: c.textMuted }]}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Settings')}>
              <GearSix size={20} color={c.textMuted} weight="light" />
              <Text style={[styles.navLabel, { color: c.textMuted }]}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Dim overlay — tapping behind the panel closes it */}
      {overlayOpen && (
        <Animated.View
          style={[styles.dim, { opacity: dimAnim }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeOverlay} activeOpacity={1} />
        </Animated.View>
      )}

      {/* Overlay panel */}
      {overlayOpen && (
        <Animated.View
          style={[
            styles.overlayContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <OverlayPanel onRequestClose={closeOverlay} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  wordmark: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 17,
  },
  themeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  themeIcon: { fontSize: 16 },
  themeLabel: { fontSize: 13, fontWeight: '500' },
  centreBlock: { position: 'absolute', left: 24, right: 24 },
  greeting: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 32,
  },
  promptGap: { height: 32 },
  entryPrompt: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  entryPlaceholder: { fontSize: 16 },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  separator: { height: StyleSheet.hairlineWidth },
  navRow: {
    height: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navLabel: { fontSize: 13, fontWeight: '500' },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  overlayContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: OVERLAY_HEIGHT,
  },
});
