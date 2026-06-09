import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity } from 'react-native';
import { getAllCaptures, deleteCapture, Capture } from '../utils/database';

export default function HistoryScreen() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [error, setError] = useState('');

  const load = () => {
    getAllCaptures()
      .then(setCaptures)
      .catch(e => setError(String(e)));
  };

  useEffect(() => { load(); }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'red' }}>{error}</Text>
      </View>
    );
  }

  if (captures.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No captures yet.</Text>
        <TouchableOpacity style={styles.btn} onPress={load}>
          <Text style={styles.btnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <TouchableOpacity style={[styles.btn, { margin: 16 }]} onPress={load}>
        <Text style={styles.btnText}>Refresh</Text>
      </TouchableOpacity>
      <FlatList
        data={captures}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardText}>{item.text}</Text>
            <View style={styles.row}>
              <Text style={styles.date}>
                {new Date(item.createdAt).toLocaleString()}
              </Text>
              <TouchableOpacity onPress={async () => {
                await deleteCapture(item.id);
                load();
              }}>
                <Text style={{ color: '#E53935', fontSize: 12 }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  empty: { fontSize: 16, color: '#999', marginBottom: 16 },
  btn: { backgroundColor: '#6B4EFF', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  btnText: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#F9F9F9', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#eee', marginBottom: 12 },
  cardText: { fontSize: 15, color: '#333', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  date: { fontSize: 12, color: '#999' },
});
