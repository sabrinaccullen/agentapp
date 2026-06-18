import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  CormorantGaramond_400Regular,
  CormorantGaramond_400Regular_Italic,
  CormorantGaramond_600SemiBold,
} from '@expo-google-fonts/cormorant-garamond';
import { ThemeProvider } from './contexts/ThemeContext';
import HomeScreen from './screens/HomeScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';
import WeatherScreen from './screens/WeatherScreen';
import TasksRemindersScreen from './screens/TasksRemindersScreen';
import CalendarScreen from './screens/CalendarScreen';
import { setupNotificationHandler } from './utils/notifications';
import type { RootStackParamList } from './screens/HomeScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_400Regular_Italic,
    CormorantGaramond_600SemiBold,
  });

  useEffect(() => { setupNotificationHandler(); }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
              name="History"
              component={HistoryScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: true, title: 'Settings' }}
            />
            <Stack.Screen name="Weather" component={WeatherScreen} options={{ headerShown: false }} />
            <Stack.Screen name="TasksReminders" component={TasksRemindersScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Calendar" component={CalendarScreen} options={{ headerShown: false }} />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
