import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import CaptureScreen from './screens/CaptureScreen';
import QuickAddScreen from './screens/QuickAddScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';
import { setupNotificationHandler } from './utils/notifications';

const Tab = createBottomTabNavigator();

export default function App() {
  useEffect(() => { setupNotificationHandler(); }, []);

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#6B4EFF',
          tabBarInactiveTintColor: '#999',
          headerShown: true,
        }}
      >
        <Tab.Screen name="Capture" component={CaptureScreen} />
        <Tab.Screen name="Quick" component={QuickAddScreen} />
        <Tab.Screen name="History" component={HistoryScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
