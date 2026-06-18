import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Easing, StatusBar, Dimensions, PanResponder,
  Linking, AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ExpoCalendar from 'expo-calendar';
import { CaretLeft, Plus } from 'phosphor-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './HomeScreen';
import { useTheme } from '../contexts/ThemeContext';

type CalendarNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Calendar'>;
interface Props { navigation: CalendarNavigationProp; }

const HOUR_ROW_H = 64;
const TIMELINE_START = 8;
const TIMELINE_END = 22;
const HOUR_LABEL_W = 44;
const H_MARGIN = 24;
const TRACK_OFFSET = HOUR_LABEL_W + 8;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const TOTAL_TIMELINE_H = (TIMELINE_END - TIMELINE_START) * HOUR_ROW_H;

const JS_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const HOUR_LABELS: string[] = Array.from(
  { length: TIMELINE_END - TIMELINE_START + 1 },
  (_, i) => {
    const h = TIMELINE_START + i;
    if (h === 12) return '12 PM';
    if (h < 12) return `${h} AM`;
    return `${h - 12} PM`;
  }
);

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Monday = 0, ..., Sunday = 6
function dowMonFirst(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function formatTimeRange(start: Date, end: Date): string {
  const fmt = (d: Date) => {
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

interface CalEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  calendarColor: string;
  allDay: boolean;
}

function buildMonthGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1);
  const offset = dowMonFirst(firstDay);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export default function CalendarScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const c = theme.colors;

  const [permission, setPermission] = useState<'loading' | 'granted' | 'denied'>('loading');
  const [viewMode, setViewMode] = useState<'day' | 'month'>('day');
  const [viewedDate, setViewedDate] = useState<Date>(() => startOfDay(new Date()));
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [reduceMotion, setReduceMotion] = useState(false);

  const [dayBtnLayout, setDayBtnLayout] = useState({ x: 0, width: 0 });
  const [monthBtnLayout, setMonthBtnLayout] = useState({ x: 0, width: 0 });

  const contentOpacity = useRef(new Animated.Value(1)).current;
  const viewOpacity = useRef(new Animated.Value(1)).current;
  const underlineLeft = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;

  const reduceMotionRef = useRef(false);
  const viewedDateRef = useRef(viewedDate);
  const viewModeRef = useRef<'day' | 'month'>('day');
  const navigatingRef = useRef(false);
  const timelineScrollRef = useRef<ScrollView>(null);
  const navigateDayRef = useRef((_delta: 1 | -1) => {});

  const today = startOfDay(new Date());

  useEffect(() => { viewedDateRef.current = viewedDate; }, [viewedDate]);
  useEffect(() => { reduceMotionRef.current = reduceMotion; }, [reduceMotion]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    ExpoCalendar.requestCalendarPermissionsAsync().then(({ status }) => {
      setPermission(status === 'granted' ? 'granted' : 'denied');
    });
  }, []);

  const fetchEvents = useCallback(async (centreDate: Date) => {
    try {
      const calendars = await ExpoCalendar.getCalendarsAsync(ExpoCalendar.EntityTypes.EVENT);
      const colorMap = new Map(calendars.map(cal => [cal.id, cal.color]));
      const calIds = calendars.map(cal => cal.id);
      const rangeStart = addDays(centreDate, -30);
      const rangeEnd = addDays(centreDate, 30);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd.setHours(23, 59, 59, 999);
      const raw = await ExpoCalendar.getEventsAsync(calIds, rangeStart, rangeEnd);
      setEvents(
        raw.map(e => ({
          id: e.id,
          title: e.title || 'Untitled',
          startDate: new Date(e.startDate),
          endDate: new Date(e.endDate),
          calendarColor: colorMap.get(e.calendarId) ?? c.accent,
          allDay: e.allDay ?? false,
        }))
      );
    } catch { /* fail silently */ }
  }, [c.accent]);

  useEffect(() => {
    if (permission === 'granted') {
      fetchEvents(viewedDate);
    }
  }, [permission, fetchEvents]);

  // Auto-scroll timeline to current time on first load when viewing today
  useEffect(() => {
    if (permission !== 'granted') return;
    if (!isSameDay(viewedDate, today)) return;
    const now = new Date();
    const y = ((now.getHours() - TIMELINE_START) * 60 + now.getMinutes()) / 60 * HOUR_ROW_H;
    const scrollY = Math.max(0, y - SCREEN_H * 0.3);
    const t = setTimeout(() => {
      timelineScrollRef.current?.scrollTo({ y: scrollY, animated: false });
    }, 300);
    return () => clearTimeout(t);
  }, [permission]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Toggle underline
  useEffect(() => {
    const target = viewMode === 'day' ? dayBtnLayout : monthBtnLayout;
    if (target.width === 0) return;
    const dur = reduceMotion ? 0 : 150;
    Animated.parallel([
      Animated.timing(underlineLeft, {
        toValue: target.x,
        duration: dur,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(underlineWidth, {
        toValue: target.width,
        duration: dur,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
    ]).start();
  }, [viewMode, dayBtnLayout, monthBtnLayout, reduceMotion, underlineLeft, underlineWidth]);

  const navigateDay = useCallback(
    (delta: 1 | -1) => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      const dur = reduceMotionRef.current ? 0 : 100;
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: dur,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        const newDate = addDays(viewedDateRef.current, delta);
        viewedDateRef.current = newDate;
        setViewedDate(newDate);
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: dur,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }).start(() => {
          navigatingRef.current = false;
        });
      });
    },
    [contentOpacity]
  );

  navigateDayRef.current = navigateDay;

  const switchViewMode = useCallback(
    (mode: 'day' | 'month') => {
      if (mode === viewModeRef.current) return;
      const dur = reduceMotionRef.current ? 0 : 75;
      Animated.timing(viewOpacity, {
        toValue: 0,
        duration: dur,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setViewMode(mode);
        Animated.timing(viewOpacity, {
          toValue: 1,
          duration: dur,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }).start();
      });
    },
    [viewOpacity]
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        viewModeRef.current === 'day' &&
        Math.abs(gs.dx) > Math.abs(gs.dy) &&
        Math.abs(gs.dx) > 16,
      onPanResponderRelease: (_, gs) => {
        if (Math.abs(gs.dx) < 40) return;
        navigateDayRef.current(gs.dx < 0 ? 1 : -1);
      },
    })
  ).current;

  function eventsForDay(date: Date): CalEvent[] {
    return events.filter(e => !e.allDay && isSameDay(e.startDate, date));
  }

  function dayHasEvents(date: Date): boolean {
    return events.some(e => !e.allDay && isSameDay(e.startDate, date));
  }

  function timeToY(date: Date): number {
    return ((date.getHours() - TIMELINE_START) * 60 + date.getMinutes()) / 60 * HOUR_ROW_H;
  }

  function eventCardHeight(e: CalEvent): number {
    const durationMins = (e.endDate.getTime() - e.startDate.getTime()) / 60000;
    return Math.max(44, (durationMins / 60) * HOUR_ROW_H);
  }

  function shouldShowTimeRange(e: CalEvent): boolean {
    const durationMins = (e.endDate.getTime() - e.startDate.getTime()) / 60000;
    return (durationMins / 60) * HOUR_ROW_H >= 44;
  }

  const currentTimeY = timeToY(currentTime);
  const isViewingToday = isSameDay(viewedDate, today);
  const showCurrentTimeLine =
    isViewingToday &&
    currentTime.getHours() >= TIMELINE_START &&
    currentTime.getHours() < TIMELINE_END;

  const contentW = SCREEN_W - H_MARGIN * 2;
  const eventsLeft = TRACK_OFFSET + 4;
  const eventsRight = H_MARGIN;

  const monthGrid = buildMonthGrid(viewedDate.getFullYear(), viewedDate.getMonth());
  const cellW = (SCREEN_W - H_MARGIN * 2) / 7;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={[c.bgStart, c.bgEnd]} style={StyleSheet.absoluteFill} />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <CaretLeft size={20} color={c.textPrimary} weight="regular" />
          <Text style={[styles.backLabel, { color: c.textPrimary }]}>Calendar</Text>
        </TouchableOpacity>

        <View style={styles.toggleContainer}>
          <TouchableOpacity
            onLayout={e => setDayBtnLayout({ x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width })}
            onPress={() => switchViewMode('day')}
            style={styles.toggleBtn}
          >
            <Text style={[styles.toggleLabel, { color: viewMode === 'day' ? c.textPrimary : `${c.textPrimary}73` }]}>
              Day
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onLayout={e => setMonthBtnLayout({ x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width })}
            onPress={() => switchViewMode('month')}
            style={styles.toggleBtn}
          >
            <Text style={[styles.toggleLabel, { color: viewMode === 'month' ? c.textPrimary : `${c.textPrimary}73` }]}>
              Month
            </Text>
          </TouchableOpacity>
          <Animated.View
            style={[
              styles.toggleUnderline,
              { backgroundColor: c.accent, left: underlineLeft, width: underlineWidth },
            ]}
          />
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => {}}>
          <Plus size={20} color={c.textPrimary} weight="regular" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {permission === 'loading' ? null : permission === 'denied' ? (
        <View style={styles.deniedContainer}>
          <Text style={[styles.deniedText, { color: c.textSecondary }]}>Calendar access needed.</Text>
          <TouchableOpacity onPress={() => Linking.openSettings()}>
            <Text style={[styles.openSettingsLink, { color: c.accent }]}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.View style={[styles.viewContainer, { opacity: viewOpacity }]}>
          {viewMode === 'day' ? (
            <Animated.View style={[styles.dayView, { opacity: contentOpacity }]} {...panResponder.panHandlers}>
              {/* Date display */}
              <View style={[styles.dateDisplay, { paddingHorizontal: H_MARGIN }]}>
                <Text style={[styles.dateDayOfWeek, { color: c.textPrimary }]}>
                  {JS_DAYS[viewedDate.getDay()]}
                </Text>
                <Text style={[styles.dateMonthDay, { color: c.textPrimary }]}>
                  {MONTH_NAMES[viewedDate.getMonth()]} {viewedDate.getDate()}
                </Text>
                <Text style={[styles.dateYear, { color: `${c.textPrimary}66` }]}>
                  {viewedDate.getFullYear()}
                </Text>
              </View>

              {/* Timeline */}
              <ScrollView
                ref={timelineScrollRef}
                style={styles.timeline}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
              >
                <View style={{ height: TOTAL_TIMELINE_H + insets.bottom + 32 }}>
                  {/* Vertical track line */}
                  <View
                    style={[
                      styles.trackLine,
                      { left: H_MARGIN + TRACK_OFFSET, height: TOTAL_TIMELINE_H },
                    ]}
                  />

                  {/* Hour labels */}
                  {HOUR_LABELS.map((label, i) => (
                    <Text
                      key={label}
                      style={[
                        styles.hourLabel,
                        { left: H_MARGIN, top: i * HOUR_ROW_H - 8, color: `${c.textPrimary}59`, width: HOUR_LABEL_W },
                      ]}
                    >
                      {label}
                    </Text>
                  ))}

                  {/* Current time indicator */}
                  {showCurrentTimeLine && (
                    <View
                      style={[
                        styles.currentTimeLine,
                        {
                          top: currentTimeY,
                          left: H_MARGIN + TRACK_OFFSET,
                          right: H_MARGIN,
                          borderColor: 'rgba(255,255,255,0.50)',
                        },
                      ]}
                    />
                  )}

                  {/* Event cards */}
                  {eventsForDay(viewedDate).map(event => {
                    const topY = timeToY(event.startDate);
                    if (topY < 0 || topY > TOTAL_TIMELINE_H) return null;
                    const h = eventCardHeight(event);
                    const showTime = shouldShowTimeRange(event);
                    return (
                      <View
                        key={event.id}
                        style={[
                          styles.eventCard,
                          { top: topY, left: H_MARGIN + eventsLeft, right: eventsRight, height: h },
                        ]}
                      >
                        <View style={[styles.calDot, { backgroundColor: event.calendarColor }]} />
                        <View style={styles.eventTextBlock}>
                          <Text style={[styles.eventTitle, { color: `${c.textPrimary}E6` }]} numberOfLines={1}>
                            {event.title}
                          </Text>
                          {showTime && (
                            <Text style={[styles.eventTime, { color: `${c.textPrimary}8C` }]}>
                              {formatTimeRange(event.startDate, event.endDate)}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </Animated.View>
          ) : (
            /* Month view */
            <ScrollView
              style={styles.monthScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            >
              {/* Month + year header */}
              <Text style={[styles.monthHeader, { color: c.textPrimary, paddingHorizontal: H_MARGIN }]}>
                {MONTH_NAMES[viewedDate.getMonth()]} {viewedDate.getFullYear()}
              </Text>

              {/* DOW headers */}
              <View style={[styles.dowRow, { paddingHorizontal: H_MARGIN }]}>
                {DOW_SHORT.map((d, i) => (
                  <View key={i} style={[styles.dowCell, { width: cellW }]}>
                    <Text style={[styles.dowLabel, { color: `${c.textPrimary}66` }]}>{d}</Text>
                  </View>
                ))}
              </View>

              {/* Calendar grid */}
              <View style={{ paddingHorizontal: H_MARGIN }}>
                {monthGrid.map((row, ri) => (
                  <View key={ri} style={styles.gridRow}>
                    {row.map((day, ci) => {
                      if (day === null) {
                        return <View key={ci} style={[styles.gridCell, { width: cellW }]} />;
                      }
                      const cellDate = new Date(viewedDate.getFullYear(), viewedDate.getMonth(), day);
                      const isToday = isSameDay(cellDate, today);
                      const isSelected = isSameDay(cellDate, viewedDate);
                      const hasEvents = dayHasEvents(cellDate);
                      return (
                        <TouchableOpacity
                          key={ci}
                          style={[styles.gridCell, { width: cellW }]}
                          onPress={() => {
                            setViewedDate(startOfDay(cellDate));
                            switchViewMode('day');
                          }}
                          activeOpacity={0.7}
                        >
                          {isToday && (
                            <View style={[styles.todayCircle, { backgroundColor: c.accent }]} />
                          )}
                          {isSelected && !isToday && (
                            <View style={styles.selectedCircle} />
                          )}
                          <Text
                            style={[
                              styles.gridDay,
                              {
                                color: isToday || isSelected
                                  ? c.textPrimary
                                  : `${c.textPrimary}D9`,
                              },
                            ]}
                          >
                            {day}
                          </Text>
                          {hasEvents && <View style={styles.eventDot} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>

              {/* Separator */}
              <View style={[styles.monthSeparator, { backgroundColor: c.separator, marginHorizontal: H_MARGIN }]} />

              {/* Event list for selected day */}
              {eventsForDay(viewedDate).length === 0 ? (
                <Text style={[styles.noEvents, { color: `${c.textPrimary}73` }]}>No events.</Text>
              ) : (
                <View style={{ paddingHorizontal: H_MARGIN }}>
                  {eventsForDay(viewedDate).map(event => (
                    <View key={event.id} style={styles.monthEventCard}>
                      <View style={[styles.calDot, { backgroundColor: event.calendarColor, marginTop: 2 }]} />
                      <View style={styles.eventTextBlock}>
                        <Text style={[styles.eventTitle, { color: `${c.textPrimary}E6` }]} numberOfLines={1}>
                          {event.title}
                        </Text>
                        <Text style={[styles.eventTime, { color: `${c.textPrimary}8C` }]}>
                          {formatTimeRange(event.startDate, event.endDate)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_MARGIN,
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
  addBtn: {
    flex: 1,
    alignItems: 'flex-end',
  },
  viewContainer: {
    flex: 1,
  },
  deniedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deniedText: {
    fontSize: 16,
  },
  openSettingsLink: {
    fontSize: 14,
  },

  // Day view
  dayView: {
    flex: 1,
  },
  dateDisplay: {
    paddingTop: SCREEN_H * 0.28 - 100, // ~28% from top, accounting for top bar
    paddingBottom: 32,
  },
  dateDayOfWeek: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 32,
    lineHeight: 38,
  },
  dateMonthDay: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 32,
    lineHeight: 38,
  },
  dateYear: {
    fontSize: 17,
    marginTop: 4,
  },
  timeline: {
    flex: 1,
  },
  trackLine: {
    position: 'absolute',
    top: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  hourLabel: {
    position: 'absolute',
    fontSize: 13,
    textAlign: 'right',
  },
  currentTimeLine: {
    position: 'absolute',
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  eventCard: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  calDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
    flexShrink: 0,
  },
  eventTextBlock: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  eventTime: {
    fontSize: 13,
    marginTop: 2,
  },

  // Month view
  monthScroll: {
    flex: 1,
  },
  monthHeader: {
    fontSize: 19,
    fontWeight: '600',
    paddingTop: 8,
    paddingBottom: 16,
  },
  dowRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dowCell: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
  },
  dowLabel: {
    fontSize: 13,
  },
  gridRow: {
    flexDirection: 'row',
  },
  gridCell: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  todayCircle: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  selectedCircle: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  gridDay: {
    fontSize: 15,
  },
  eventDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.50)',
  },
  monthSeparator: {
    height: 1,
    marginVertical: 16,
  },
  noEvents: {
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 20,
  },
  monthEventCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
  },
});
