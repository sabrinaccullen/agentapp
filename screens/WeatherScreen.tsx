import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

export default function WeatherScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const c = theme.colors;
  return (
    <View style={styles.root}>
      <LinearGradient colors={[c.bgStart, c.bgEnd]} style={StyleSheet.absoluteFill} />
      <View style={[styles.centre, { paddingTop: insets.top }]}>
        <Text style={[styles.label, { color: c.textSecondary }]}>Weather — coming soon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 16 },
});
