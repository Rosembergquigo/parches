import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useMatchStream } from '../lib/useMatchStream';

export function WatchScreen({ matchId, hlsUrl }: { matchId: string; hlsUrl: string }) {
  const { score, isConnected } = useMatchStream(matchId);
  return (
    <View style={styles.container}>
      <View style={styles.scoreboard}>
        <Text style={styles.score}>{score.home} - {score.away}</Text>
        <Text style={styles.status}>{isConnected ? '🔴 EN VIVO' : 'Conectando...'}</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scoreboard: { padding: 16, alignItems: 'center' },
  score: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  status: { fontSize: 12, color: '#f44' },
});
