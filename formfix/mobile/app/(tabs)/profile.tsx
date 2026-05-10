import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { Colors, Font, Radius, Space } from '../../constants/theme';
import { useSessionStore } from '../../store/useSessionStore';

export default function ProfileScreen() {
  const { sessions } = useSessionStore();
  const avgScore = sessions.length
    ? Math.round(sessions.reduce((a, s) => a + s.score, 0) / sessions.length)
    : 0;
  const totalReps = sessions.reduce((a, s) => a + s.reps, 0);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>VisionAI</Text>

      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={{ fontSize: 40 }}>🏋️</Text>
      </View>
      <Text style={styles.name}>Athlete</Text>
      <Text style={styles.sub}>{sessions.length} sessions logged</Text>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatBox label="Avg Form" value={`${avgScore}%`} />
        <StatBox label="Total Reps" value={String(totalReps)} />
        <StatBox label="Sessions" value={String(sessions.length)} />
      </View>

      {/* Recent */}
      <Text style={styles.section}>Recent Sessions</Text>
      {sessions.slice(0, 5).map(s => (
        <View key={s.id} style={styles.row}>
          <Text style={styles.rowEx}>{s.exercise.replace('_',' ')}</Text>
          <Text style={styles.rowDate}>{new Date(s.date).toLocaleDateString()}</Text>
          <Text style={{ color: s.score >= 80 ? Colors.accent : Colors.warn, fontWeight: Font.weight.bold }}>
            {s.score}%
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingHorizontal: Space.md, paddingBottom: 120, alignItems: 'center' },
  title:  { color: Colors.text, fontSize: Font.sizes.xl, fontWeight: Font.weight.bold, marginBottom: Space.xl },

  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: Space.sm, borderWidth: 2, borderColor: Colors.accent },
  name:   { color: Colors.text, fontSize: Font.sizes.lg, fontWeight: Font.weight.bold },
  sub:    { color: Colors.textMuted, fontSize: Font.sizes.sm, marginBottom: Space.xl },

  statsRow: { flexDirection: 'row', gap: Space.sm, marginBottom: Space.xl, width: '100%' },
  statBox:  { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.md, padding: Space.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statVal:  { color: Colors.accent, fontSize: Font.sizes.xl, fontWeight: Font.weight.black },
  statLabel:{ color: Colors.textMuted, fontSize: Font.sizes.xs, marginTop: 4 },

  section: { color: Colors.text, fontWeight: Font.weight.bold, fontSize: Font.sizes.lg, alignSelf: 'flex-start', marginBottom: Space.sm, width: '100%' },
  row:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.md, padding: Space.md, width: '100%', marginBottom: Space.sm, borderWidth: 1, borderColor: Colors.border },
  rowEx:   { color: Colors.text, fontWeight: Font.weight.medium, textTransform: 'capitalize', flex: 1 },
  rowDate: { color: Colors.textMuted, fontSize: Font.sizes.sm, marginRight: Space.md },
});
