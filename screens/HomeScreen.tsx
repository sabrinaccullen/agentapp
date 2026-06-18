import { useRef, useState, useEffect, useCallback } from 'react';
import type { ComponentType } from 'react';
import type { IconWeight } from 'phosphor-react-native';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Easing, AppState, AccessibilityInfo, Dimensions, StatusBar, PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CaretUp, CaretDown, Sun, CheckCircle, CalendarBlank,
  ClockCounterClockwise, GearSix,
} from 'phosphor-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getSecure, saveSecure } from '../utils/storage';
import { useTheme } from '../contexts/ThemeContext';
import OverlayPanel from './OverlayPanel';

export type RootStackParamList = {
  Home: undefined;
  History: undefined;
  Settings: undefined;
  Weather: undefined;
  TasksReminders: undefined;
  Calendar: undefined;
};

type HomeNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeNavigationProp;
}

type PhosphorIcon = ComponentType<{ size?: number; color?: string; weight?: IconWeight }>;

interface DockIconProps {
  Icon: PhosphorIcon;
  onPress: () => void;
}

function DockIcon({ Icon, onPress }: DockIconProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 100, bounciness: 0 }),
      Animated.timing(opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 100, bounciness: 0 }),
      Animated.timing(opacity, { toValue: 0.8, duration: 100, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  return (
    <TouchableOpacity
      style={styles.dockCell}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <Icon size={22} color="#FDF8F2" weight="light" />
      </Animated.View>
    </TouchableOpacity>
  );
}

const FIRST_LAUNCH_KEY = 'vesper_first_launch_done';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const OVERLAY_HEIGHT = SCREEN_HEIGHT * 0.92;
const DOCK_HIDE_OFFSET = 100;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning.';
  if (h >= 12 && h < 18) return 'Good afternoon.';
  return 'Good evening.';
}

const DOCK_ICONS: { Icon: PhosphorIcon; screen: keyof RootStackParamList }[] = [
  { Icon: Sun, screen: 'Weather' },
  { Icon: CheckCircle, screen: 'TasksReminders' },
  { Icon: CalendarBlank, screen: 'Calendar' },
  { Icon: ClockCounterClockwise, screen: 'History' },
  { Icon: GearSix, screen: 'Settings' },
];

export default function HomeScreen({ navigation }: Props) {
  const { theme, cycleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [greeting, setGreeting] = useState(getGreeting);
  const [promptPlaceholder, setPromptPlaceholder] = useState("What's on your mind?");
  const [entryPressed, setEntryPressed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);

  const contentOpacity = useRef(new Animated.Value(1)).current;
  const entryScale = useRef(new Animated.Value(1)).current;
  const dimAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(OVERLAY_HEIGHT)).current;
  const dockSlideAnim = useRef(new Animated.Value(DOCK_HIDE_OFFSET)).current;
  const dockOpacityAnim = useRef(new Animated.Value(0)).current;

  // Refs for PanResponder stale-closure avoidance
  const dockOpenRef = useRef(false);
  const reduceMotionRef = useRef(false);
  const openDockRef = useRef<() => void>(() => {});
  const closeDockRef = useRef<(cb?: () => void) => void>(() => {});

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(v => {
      setReduceMotion(v);
      reduceMotionRef.current = v;
    });
    const motionSub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => {
      setReduceMotion(v);
      reduceMotionRef.current = v;
    });

    getSecure(FIRST_LAUNCH_KEY).then(val => {
      if (val === null) {
        setPromptPlaceholder('Say hello to Vesper.');
        saveSecure(FIRST_LAUNCH_KEY, 'done');
      }
    });

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') setGreeting(getGreeting());
    });
    return () => {
      sub.remove();
      motionSub.remove();
    };
  }, []);

  const openDock = useCallback(() => {
    dockOpenRef.current = true;
    setDockOpen(true);
    if (reduceMotionRef.current) {
      dockOpacityAnim.setValue(1);
      return;
    }
    Animated.timing(dockSlideAnim, {
      toValue: 0,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [dockSlideAnim, dockOpacityAnim]);

  const closeDock = useCallback((cb?: () => void) => {
    if (reduceMotionRef.current) {
      Animated.timing(dockOpacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        dockOpenRef.current = false;
        setDockOpen(false);
        cb?.();
      });
      return;
    }
    Animated.timing(dockSlideAnim, {
      toValue: DOCK_HIDE_OFFSET,
      duration: 200,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      dockOpenRef.current = false;
      setDockOpen(false);
      cb?.();
    });
  }, [dockSlideAnim, dockOpacityAnim]);

  useEffect(() => { openDockRef.current = openDock; }, [openDock]);
  useEffect(() => { closeDockRef.current = closeDock; }, [closeDock]);

  const swipeZonePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => !dockOpenRef.current && g.dy < -10,
      onPanResponderRelease: (_, g) => {
        if (!dockOpenRef.current && g.dy < -20) openDockRef.current();
      },
    }),
  ).current;

  const dockPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => dockOpenRef.current && g.dy > 10,
      onPanResponderRelease: (_, g) => {
        if (dockOpenRef.current && g.dy > 30) closeDockRef.current();
      },
    }),
  ).current;

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

  const handleDockNav = useCallback((screen: keyof RootStackParamList) => {
    navigation.navigate(screen as any);
    closeDock();
  }, [navigation, closeDock]);

  const c = theme.colors;

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <LinearGradient colors={[c.bgStart, c.bgEnd]} style={StyleSheet.absoluteFill} />

      <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
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
      </Animated.View>

      {/* Swipe-up zone — captures upward drags from the bottom region when dock is hidden */}
      <View
        style={styles.swipeZone}
        {...swipeZonePanResponder.panHandlers}
        pointerEvents={dockOpen ? 'none' : 'auto'}
      />

      {/* Nav dock */}
      <Animated.View
        style={[
          styles.dock,
          reduceMotion
            ? { opacity: dockOpacityAnim }
            : { transform: [{ translateY: dockSlideAnim }] },
        ]}
        {...dockPanResponder.panHandlers}
        pointerEvents={dockOpen ? 'box-none' : 'none'}
      >
        <View style={[styles.dockSeparator, { backgroundColor: c.separator }]} />
        <View style={[styles.dockRow, { paddingBottom: insets.bottom }]}>
          {DOCK_ICONS.map(({ Icon, screen }) => (
            <DockIcon key={screen} Icon={Icon} onPress={() => handleDockNav(screen)} />
          ))}
        </View>
      </Animated.View>

      {/* Arrow affordance — always on top of dock */}
      <View
        style={[styles.arrowAffordance, { bottom: insets.bottom + 16 }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={() => dockOpen ? closeDock() : openDock()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {dockOpen
            ? <CaretDown size={16} color="rgba(255,255,255,0.35)" weight="bold" />
            : <CaretUp size={16} color="rgba(255,255,255,0.35)" weight="bold" />
          }
        </TouchableOpacity>
      </View>

      {overlayOpen && (
        <Animated.View
          style={[styles.dim, { opacity: dimAnim }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeOverlay} activeOpacity={1} />
        </Animated.View>
      )}

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
  swipeZone: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  dock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  dockSeparator: { height: 1 },
  dockRow: {
    height: 52,
    flexDirection: 'row',
  },
  dockCell: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowAffordance: {
    position: 'absolute',
    right: 20,
  },
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
