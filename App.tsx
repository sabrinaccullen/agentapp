import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import CaptureScreen from './screens/CaptureScreen';
import QuickAddScreen from './screens/QuickAddScreen';
import HistoryScreen from './screens/HistoryScreen';
import ConversationScreen from './screens/ConversationScreen';
import SettingsScreen from './screens/SettingsScreen';
import { setupNotificationHandler } from './utils/notifications';

const Tab = createBottomTabNavigator();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, [IoniconsName, IoniconsName]> = {
  Capture:  ['mic',           'mic-outline'],
  Quick:    ['flash',         'flash-outline'],
  History:  ['time',          'time-outline'],
  Chat:     ['chatbubble',    'chatbubble-outline'],
  Settings: ['settings',      'settings-outline'],
};

export default function App() {
  useEffect(() => { setupNotificationHandler(); }, []);

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: '#6B4EFF',
          tabBarInactiveTintColor: '#999',
          headerShown: true,
          tabBarIcon: ({ focused, color, size }) => {
            const [active, inactive] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
            return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Capture" component={CaptureScreen} />
        <Tab.Screen name="Quick" component={QuickAddScreen} />
        <Tab.Screen name="History" component={HistoryScreen} />
        <Tab.Screen name="Chat" component={ConversationScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
