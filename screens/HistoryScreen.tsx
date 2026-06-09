import { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList,
  TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllCaptures, deleteCapture, setQueued, Capture } from '../utils/database';
import { processQueue, ProcessedCapture, ProcessQueueResult } from '../utils/queue';
import { appendToQueue } from '../utils/vault';

export default function HistoryScreen() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ProcessQueueResult | null>(null);
  const [vaultStatus, setVaultStatus] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    getAllCaptures()
      .then(setCaptures)
      .catch(e => setError(String(e)));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const queued = captures.filter(c => c.queued);

  const handleToggleQueue = async (item: Capture) => {
    await setQueued(item.id, !item.queued);
    load();
  };

  const handleSendToVault = async (item: Capture) => {
    setVaultStatus(s => ({ ...s, [item.id]: 'sending…' }));
    try {
      await appendToQueue(item.text, item.type);
      setVaultStatus(s => ({ ...s, [item.id]: '✓ sent' }));
    } catch (e: any) {
      setVaultStatus(s => ({ ...s, [item.id]: `✗ ${e.message}` }));
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    setError('');
    setResults(null);
    try {
      const out = await processQueue();
      setResults(out);
      if (out.vaultError) setError(`Vault sync failed: ${out.vaultError}`);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  if (results) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.resultsHeader}>Queue processed — {results.captures.length} note{results.captures.length !== 1 ? 's' : ''}</Text>
        {results.vaultError && <Text style={styles.errorText}>⚠ Vault sync failed: {results.vaultError}</Text>}
        {results.captures.map(r => (
          <View key={r.id} style={styles.resultCard}>
            <Text style={styles.resultLabel}>Original</Text>
            <Text style={styles.resultOriginal}>{r.original}</Text>
            <Text style={styles.resultLabel}>Cleaned</Text>
            <Text style={styles.resultCleaned}>{r.cleaned}</Text>
            {r.actions.length > 0 && (
              <>
                <Text style={styles.resultLabel}>Actions</Text>
                {r.actions.map((a, i) => <Text key={i} style={styles.resultItem}>• {a}</Text>)}
              </>
            )}
            {r.tags.length > 0 && (
              <View style={styles.tagRow}>
                {r.tags.map(t => (
                  <View key={t} style={styles.tag}><Text style={styles.tagText}>#{t}</Text></View>
                ))}
              </View>
            )}
          </View>
        ))}
        <TouchableOpacity style={styles.btn} onPress={() => setResults(null)}>
          <Text style={styles.btnText}>Back to History</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Queue banner */}
      {queued.length > 0 && (
        <View style={styles.queueBanner}>
          <Text style={styles.queueCount}>{queued.length} in queue</Text>
          {processing
            ? <ActivityIndicator color="#fff" />
            : (
              <TouchableOpacity style={styles.processBtn} onPress={handleProcess}>
                <Text style={styles.processBtnText}>Process with Claude</Text>
              </TouchableOpacity>
            )
          }
        </View>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {captures.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No captures yet.</Text>
          <TouchableOpacity style={styles.btn} onPress={load}>
            <Text style={styles.btnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={captures}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={[styles.card, item.queued && styles.cardQueued]}>
              <Text style={styles.cardText}>{item.text}</Text>
              <View style={styles.row}>
                <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => handleSendToVault(item)}>
                    <Text style={styles.vaultText}>
                      {vaultStatus[item.id] ?? 'Vault'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleToggleQueue(item)} style={styles.queueToggle}>
                    <Text style={[styles.queueToggleText, item.queued && styles.queueToggleActive]}>
                      {item.queued ? 'Queued ✓' : 'Queue'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={async () => { await deleteCapture(item.id); load(); }}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  container: { padding: 16, backgroundColor: '#fff' },
  empty: { fontSize: 16, color: '#999', marginBottom: 16 },
  btn: { backgroundColor: '#6B4EFF', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  btnText: { color: '#fff', fontWeight: '600' },
  queueBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#6B4EFF', paddingHorizontal: 16, paddingVertical: 12,
  },
  queueCount: { color: '#fff', fontWeight: '600', fontSize: 14 },
  processBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  processBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  errorText: { color: '#E53935', padding: 12, textAlign: 'center', fontSize: 13 },
  card: {
    backgroundColor: '#F9F9F9', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#eee', marginBottom: 12,
  },
  cardQueued: { borderColor: '#6B4EFF', backgroundColor: '#F5F3FF' },
  cardText: { fontSize: 15, color: '#333', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 12, color: '#999', flex: 1 },
  actions: { flexDirection: 'row', gap: 12 },
  queueToggle: { paddingHorizontal: 4 },
  vaultText: { color: '#2196F3', fontSize: 12, fontWeight: '600' },
  queueToggleText: { color: '#6B4EFF', fontSize: 12, fontWeight: '600' },
  queueToggleActive: { color: '#4CAF50' },
  deleteText: { color: '#E53935', fontSize: 12 },
  // results view
  resultsHeader: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 16 },
  resultCard: {
    backgroundColor: '#F9F9F9', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#eee', marginBottom: 16,
  },
  resultLabel: { fontSize: 11, fontWeight: '700', color: '#9B8AFF', textTransform: 'uppercase', marginBottom: 4, marginTop: 8 },
  resultOriginal: { fontSize: 13, color: '#999', fontStyle: 'italic' },
  resultCleaned: { fontSize: 15, color: '#333', lineHeight: 22 },
  resultItem: { fontSize: 14, color: '#333', marginBottom: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { backgroundColor: '#EEE9FF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { color: '#6B4EFF', fontSize: 12, fontWeight: '600' },
});
