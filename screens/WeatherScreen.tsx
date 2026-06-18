import { useState, useEffect, useCallback, useRef } from 'react';
import type { ComponentType } from 'react';
import type { IconWeight } from 'phosphor-react-native';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  AppState, StatusBar, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import {
  CaretLeft,
  Sun, Moon, CloudSun, Cloud, CloudRain, Snowflake, CloudLightning, Wind,
} from 'phosphor-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './HomeScreen';
import {
  fetchWeather, conditionGradient,
  type WeatherCondition, type WeatherData,
} from '../utils/weather';

type WeatherNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Weather'>;

interface Props {
  navigation: WeatherNavigationProp;
}

type PhosphorIcon = ComponentType<{ size?: number; color?: string; weight?: IconWeight }>;

const CONDITION_ICONS: Record<WeatherCondition, { Icon: PhosphorIcon; weight: IconWeight }> = {
  clear_day:    { Icon: Sun,           weight: 'light' },
  clear_night:  { Icon: Moon,          weight: 'light' },
  partly_cloudy:{ Icon: CloudSun,      weight: 'light' },
  overcast:     { Icon: Cloud,         weight: 'light' },
  rain:         { Icon: CloudRain,     weight: 'light' },
  heavy_rain:   { Icon: CloudRain,     weight: 'fill'  },
  snow:         { Icon: Snowflake,     weight: 'light' },
  thunder:      { Icon: CloudLightning,weight: 'light' },
};

const LOADING_GRADIENT: readonly [string, string] = ['#0D0D10', '#1A1A22'];
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatDateLabel(): string {
  const now = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
}

function Skeleton({ width, height, radius = 4 }: { width: number; height: number; radius?: number }) {
  return (
    <View style={[styles.skeleton, { width, height, borderRadius: radius }]} />
  );
}

export default function WeatherScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error' | 'permission_denied'>('loading');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [cityName, setCityName] = useState('');
  const dateLabel = formatDateLabel();

  const latRef = useRef<number | null>(null);
  const lonRef = useRef<number | null>(null);

  const loadWeather = useCallback(async () => {
    try {
      let lat = latRef.current;
      let lon = lonRef.current;

      if (lat === null || lon === null) {
        const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
        if (permStatus !== 'granted') {
          setStatus('permission_denied');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
        latRef.current = lat;
        lonRef.current = lon;

        const geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        setCityName(geocode[0]?.city ?? geocode[0]?.subregion ?? '');
      }

      const data = await fetchWeather(lat, lon);
      setWeather(data);
      setStatus('loaded');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    loadWeather();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') loadWeather();
    });
    return () => sub.remove();
  }, [loadWeather]);

  const gradient = (status === 'loaded' && weather)
    ? conditionGradient(weather.current.condition)
    : LOADING_GRADIENT;

  const topBarTop = insets.top + 20;
  const bottomSectionBottom = insets.bottom;

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient colors={gradient as [string, string]} style={StyleSheet.absoluteFill} />

      {/* Top bar */}
      <View style={[styles.topBar, { top: topBarTop }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <CaretLeft size={20} color="rgba(255,255,255,1)" weight="light" />
          <Text style={styles.backLabel}>Weather</Text>
        </TouchableOpacity>
      </View>

      {status === 'loading' && (
        <View style={styles.contentArea}>
          <View style={[styles.tempBlock, { top: SCREEN_HEIGHT * 0.35 }]}>
            <Skeleton width={100} height={38} radius={6} />
            <View style={styles.gap8} />
            <Skeleton width={160} height={18} />
            <View style={styles.gap8} />
            <Skeleton width={140} height={14} />
          </View>
          <View style={[styles.bottomSection, { bottom: bottomSectionBottom }]}>
            <View style={styles.separator} />
            <View style={styles.metricsRow}>
              {[0, 1, 2].map(i => (
                <View key={i} style={styles.metricCol}>
                  <Skeleton width={48} height={13} />
                  <View style={styles.gap8} />
                  <Skeleton width={36} height={16} />
                </View>
              ))}
            </View>
            <View style={styles.separator} />
            <View style={styles.stripGap} />
            <View style={[styles.hourlyStrip, styles.hourlyStripSkeleton]}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={styles.hourCellSkeleton}>
                  <Skeleton width={28} height={13} />
                  <View style={styles.gap8} />
                  <Skeleton width={24} height={15} />
                  <View style={styles.gap8} />
                  <Skeleton width={18} height={18} radius={9} />
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {(status === 'error' || status === 'permission_denied') && (
        <View style={styles.centreMessage}>
          <Text style={styles.errorText}>
            {status === 'permission_denied'
              ? 'Location access needed to show weather.'
              : 'Unable to load weather.'}
          </Text>
        </View>
      )}

      {status === 'loaded' && weather && (
        <View style={styles.contentArea}>
          {/* Temperature block */}
          <View style={[styles.tempBlock, { top: SCREEN_HEIGHT * 0.35 }]}>
            <Text style={styles.temperature}>{weather.current.tempC}°</Text>
            <View style={styles.gap8} />
            <Text style={styles.conditionLabel}>{weather.current.conditionLabel}</Text>
            <View style={styles.gap8} />
            <Text style={styles.cityDate}>
              {cityName ? `${cityName} · ` : ''}{dateLabel}
            </Text>
          </View>

          {/* Bottom: metrics + hourly */}
          <View style={[styles.bottomSection, { bottom: bottomSectionBottom }]}>
            <View style={styles.separator} />
            <View style={styles.metricsRow}>
              <MetricCol label="UV Index" value={weather.current.uvLabel} />
              <MetricCol label="Wind" value={`${weather.current.windKmh} km/h`} />
              <MetricCol label="Humidity" value={`${weather.current.humidityPct}%`} />
            </View>
            <View style={styles.separator} />
            <View style={styles.stripGap} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.hourlyStrip}
              contentContainerStyle={styles.hourlyContent}
            >
              {weather.hourly.map((slot, i) => (
                <HourCell key={i} slot={slot} isNow={i === 0} />
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

function MetricCol({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCol}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function HourCell({ slot, isNow }: { slot: { label: string; tempC: number; condition: WeatherCondition }; isNow: boolean }) {
  const { Icon, weight } = CONDITION_ICONS[slot.condition];
  return (
    <View style={[styles.hourCell, isNow && styles.hourCellNow]}>
      <Text style={styles.hourLabel}>{slot.label}</Text>
      <Text style={styles.hourTemp}>{slot.tempC}°</Text>
      <Icon size={18} color="rgba(255,255,255,0.7)" weight={weight} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  contentArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  topBar: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backLabel: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '400',
  },

  tempBlock: {
    position: 'absolute',
    left: 24,
    right: 24,
  },
  temperature: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 32,
    color: '#FFFFFF',
  },
  conditionLabel: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.85)',
  },
  cityDate: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
  },

  bottomSection: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  separator: {
    height: 1,
    marginHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  metricsRow: {
    height: 64,
    flexDirection: 'row',
    paddingHorizontal: 24,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  metricLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.50)',
  },
  metricValue: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.90)',
  },
  stripGap: { height: 24 },
  hourlyStrip: {
    height: 88,
    marginHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
  },
  hourlyContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 0,
  },
  hourlyStripSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  hourCell: {
    minWidth: 52,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  hourCellNow: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
  },
  hourCellSkeleton: {
    minWidth: 52,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  hourLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.50)',
  },
  hourTemp: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.90)',
  },

  centreMessage: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.50)',
    textAlign: 'center',
  },

  skeleton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  gap8: { height: 8 },
});
