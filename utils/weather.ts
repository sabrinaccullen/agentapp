export type WeatherCondition =
  | 'clear_day'
  | 'clear_night'
  | 'partly_cloudy'
  | 'overcast'
  | 'rain'
  | 'heavy_rain'
  | 'snow'
  | 'thunder';

export interface CurrentWeather {
  tempC: number;
  condition: WeatherCondition;
  conditionLabel: string;
  windKmh: number;
  humidityPct: number;
  uvLabel: string;
}

export interface HourlySlot {
  label: string;
  tempC: number;
  condition: WeatherCondition;
}

export interface WeatherData {
  current: CurrentWeather;
  hourly: HourlySlot[];
}

const GRADIENTS: Record<WeatherCondition, readonly [string, string]> = {
  clear_day:    ['#1A0800', '#5C2005'],
  clear_night:  ['#080810', '#181030'],
  partly_cloudy:['#0F0D18', '#2A1F3A'],
  overcast:     ['#0D0D10', '#1A1A22'],
  rain:         ['#080F18', '#0D2030'],
  heavy_rain:   ['#060C14', '#0A1A26'],
  snow:         ['#0A0E18', '#151F30'],
  thunder:      ['#06080F', '#101022'],
};

export function conditionGradient(condition: WeatherCondition): readonly [string, string] {
  return GRADIENTS[condition];
}

function uvToLabel(index: number): string {
  if (index <= 2) return 'Low';
  if (index <= 5) return 'Moderate';
  if (index <= 7) return 'High';
  if (index <= 10) return 'Very High';
  return 'Extreme';
}

function wmoToCondition(
  code: number,
  isDay: boolean,
): { condition: WeatherCondition; label: string } {
  if (code === 0)
    return { condition: isDay ? 'clear_day' : 'clear_night', label: isDay ? 'Clear and sunny' : 'Clear' };
  if (code === 1)
    return { condition: isDay ? 'clear_day' : 'clear_night', label: 'Mainly clear' };
  if (code === 2)
    return { condition: 'partly_cloudy', label: 'Partly cloudy' };
  if (code === 3)
    return { condition: 'overcast', label: 'Overcast' };
  if (code === 45 || code === 48)
    return { condition: 'overcast', label: 'Foggy' };
  if (code >= 51 && code <= 57)
    return { condition: 'rain', label: code >= 55 ? 'Heavy drizzle' : 'Drizzle' };
  if (code === 61)
    return { condition: 'rain', label: 'Light rain' };
  if (code === 63)
    return { condition: 'rain', label: 'Rain' };
  if (code === 65)
    return { condition: 'heavy_rain', label: 'Heavy rain' };
  if (code === 66 || code === 67)
    return { condition: 'rain', label: 'Freezing rain' };
  if (code === 71)
    return { condition: 'snow', label: 'Light snow' };
  if (code === 73)
    return { condition: 'snow', label: 'Snow' };
  if (code === 75)
    return { condition: 'snow', label: 'Heavy snow' };
  if (code === 77)
    return { condition: 'snow', label: 'Snow grains' };
  if (code === 80)
    return { condition: 'rain', label: 'Light showers' };
  if (code === 81)
    return { condition: 'rain', label: 'Showers' };
  if (code === 82)
    return { condition: 'heavy_rain', label: 'Heavy showers' };
  if (code === 85 || code === 86)
    return { condition: 'snow', label: 'Snow showers' };
  if (code === 95)
    return { condition: 'thunder', label: 'Thunderstorm' };
  if (code === 96 || code === 99)
    return { condition: 'thunder', label: 'Thunderstorm with hail' };
  return { condition: isDay ? 'clear_day' : 'clear_night', label: 'Clear' };
}

function formatHourLabel(timeStr: string): string {
  const hour = parseInt(timeStr.split('T')[1].split(':')[0], 10);
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

interface OpenMeteoResponse {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    weather_code: number;
    is_day: number;
    uv_index: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    is_day: number[];
  };
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day,uv_index',
    hourly: 'temperature_2m,weather_code,is_day',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
    forecast_days: '2',
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data: OpenMeteoResponse = await res.json();

  const cur = data.current;
  const isDay = cur.is_day === 1;
  const { condition, label } = wmoToCondition(cur.weather_code, isDay);

  const current: CurrentWeather = {
    tempC: Math.round(cur.temperature_2m),
    condition,
    conditionLabel: label,
    windKmh: Math.round(cur.wind_speed_10m),
    humidityPct: Math.round(cur.relative_humidity_2m),
    uvLabel: uvToLabel(cur.uv_index),
  };

  // Find the hourly slot matching the current observation time.
  let startIdx = data.hourly.time.indexOf(cur.time);
  if (startIdx === -1) {
    const hourPrefix = cur.time.substring(0, 13);
    startIdx = data.hourly.time.findIndex(t => t.startsWith(hourPrefix));
  }
  if (startIdx === -1) startIdx = 0;

  const hourly: HourlySlot[] = data.hourly.time
    .slice(startIdx, startIdx + 12)
    .map((time, i) => {
      const idx = startIdx + i;
      const slotIsDay = data.hourly.is_day[idx] === 1;
      return {
        label: i === 0 ? 'NOW' : formatHourLabel(time),
        tempC: Math.round(data.hourly.temperature_2m[idx]),
        condition: wmoToCondition(data.hourly.weather_code[idx], slotIsDay).condition,
      };
    });

  return { current, hourly };
}
