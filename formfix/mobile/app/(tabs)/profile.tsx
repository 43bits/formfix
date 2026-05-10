// import React from 'react';
// import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
// import { Colors, Font, Radius, Space } from '../../constants/theme';
// import { useSessionStore } from '../../store/useSessionStore';

// export default function ProfileScreen() {
//   const { sessions } = useSessionStore();
//   const avgScore = sessions.length
//     ? Math.round(sessions.reduce((a, s) => a + s.score, 0) / sessions.length)
//     : 0;
//   const totalReps = sessions.reduce((a, s) => a + s.reps, 0);

//   return (
//     <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
//       <Text style={styles.title}>formfix</Text>

//       {/* Avatar */}
//       <View style={styles.avatar}>
//         <Text style={{ fontSize: 40 }}>🏋️</Text>
//       </View>
//       <Text style={styles.name}>Athlete</Text>
//       <Text style={styles.sub}>{sessions.length} sessions logged</Text>

//       {/* Stats */}
//       <View style={styles.statsRow}>
//         <StatBox label="Avg Form" value={`${avgScore}%`} />
//         <StatBox label="Total Reps" value={String(totalReps)} />
//         <StatBox label="Sessions" value={String(sessions.length)} />
//       </View>

//       {/* Recent */}
//       <Text style={styles.section}>Recent Sessions</Text>
//       {sessions.slice(0, 5).map(s => (
//         <View key={s.id} style={styles.row}>
//           <Text style={styles.rowEx}>{s.exercise.replace('_',' ')}</Text>
//           <Text style={styles.rowDate}>{new Date(s.date).toLocaleDateString()}</Text>
//           <Text style={{ color: s.score >= 80 ? Colors.accent : Colors.warn, fontWeight: Font.weight.bold }}>
//             {s.score}%
//           </Text>
//         </View>
//       ))}
//     </ScrollView>
//   );
// }

// function StatBox({ label, value }: { label: string; value: string }) {
//   return (
//     <View style={styles.statBox}>
//       <Text style={styles.statVal}>{value}</Text>
//       <Text style={styles.statLabel}>{label}</Text>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   root:   { flex: 1, backgroundColor: Colors.bg },
//   scroll: { paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingHorizontal: Space.md, paddingBottom: 120, alignItems: 'center' },
//   title:  { color: Colors.text, fontSize: Font.sizes.xl, fontWeight: Font.weight.bold, marginBottom: Space.xl },

//   avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: Space.sm, borderWidth: 2, borderColor: Colors.accent },
//   name:   { color: Colors.text, fontSize: Font.sizes.lg, fontWeight: Font.weight.bold },
//   sub:    { color: Colors.textMuted, fontSize: Font.sizes.sm, marginBottom: Space.xl },

//   statsRow: { flexDirection: 'row', gap: Space.sm, marginBottom: Space.xl, width: '100%' },
//   statBox:  { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.md, padding: Space.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
//   statVal:  { color: Colors.accent, fontSize: Font.sizes.xl, fontWeight: Font.weight.black },
//   statLabel:{ color: Colors.textMuted, fontSize: Font.sizes.xs, marginTop: 4 },

//   section: { color: Colors.text, fontWeight: Font.weight.bold, fontSize: Font.sizes.lg, alignSelf: 'flex-start', marginBottom: Space.sm, width: '100%' },
//   row:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.md, padding: Space.md, width: '100%', marginBottom: Space.sm, borderWidth: 1, borderColor: Colors.border },
//   rowEx:   { color: Colors.text, fontWeight: Font.weight.medium, textTransform: 'capitalize', flex: 1 },
//   rowDate: { color: Colors.textMuted, fontSize: Font.sizes.sm, marginRight: Space.md },
// });


import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform,
  TouchableOpacity, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { Colors, Font, Radius, Space } from '../../constants/theme';
import { useSessionStore } from '../../store/useSessionStore';
import type { WorkoutSession } from '../../types';

type Tab = 'sessions' | 'stats';

export default function ProfileScreen() {
  const { sessions, setPending, clearAll } = useSessionStore();
  const [tab, setTab] = useState<Tab>('sessions');

  const avgScore   = sessions.length
    ? Math.round(sessions.reduce((a, s) => a + s.score, 0) / sessions.length) : 0;
  const totalReps  = sessions.reduce((a, s) => a + s.reps, 0);
  const totalMins  = Math.round(sessions.reduce((a, s) => a + (s.duration_s ?? 0), 0) / 60);

  // Group by exercise for stats
  const byExercise: Record<string, { count: number; avgScore: number; totalReps: number }> = {};
  sessions.forEach(s => {
    if (!byExercise[s.exercise]) byExercise[s.exercise] = { count: 0, avgScore: 0, totalReps: 0 };
    byExercise[s.exercise].count++;
    byExercise[s.exercise].avgScore += s.score;
    byExercise[s.exercise].totalReps += s.reps;
  });
  const exStats = Object.entries(byExercise)
    .map(([ex, v]) => ({ ex, ...v, avgScore: Math.round(v.avgScore / v.count) }))
    .sort((a, b) => b.count - a.count);

  const openSession = (session: WorkoutSession) => {
    if (session.summary) {
      setPending(session.summary);
      setTimeout(() => router.push('/analysis'), 50);
    }
  };

  const scoreColor = (s: number) =>
    s >= 80 ? Colors.accent : s >= 60 ? Colors.warn : Colors.danger;

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Header */}
        <Text style={s.title}>Formfix</Text>

        {/* Avatar */}
        <View style={s.avatar}>
          <Text style={{ fontSize: 40 }}>🏋️</Text>
        </View>
        <Text style={s.name}>Athlete</Text>
        <Text style={s.sub}>{sessions.length} sessions logged</Text>

        {/* Stats row */}
        <View style={s.statsRow}>
          <StatBox label="Avg Form"   value={`${avgScore}%`}        color={scoreColor(avgScore)} />
          <StatBox label="Total Reps" value={String(totalReps)}     />
          <StatBox label="Mins"       value={String(totalMins)}     />
          <StatBox label="Sessions"   value={String(sessions.length)} />
        </View>

        {/* Tab toggle */}
        <View style={s.tabRow}>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'sessions' && s.tabActive]}
            onPress={() => setTab('sessions')}
          >
            <Text style={[s.tabTxt, tab === 'sessions' && s.tabTxtActive]}>Sessions</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'stats' && s.tabActive]}
            onPress={() => setTab('stats')}
          >
            <Text style={[s.tabTxt, tab === 'stats' && s.tabTxtActive]}>By Exercise</Text>
          </TouchableOpacity>
        </View>

        {/* Sessions tab */}
        {tab === 'sessions' && (
          <>
            {sessions.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>🎯</Text>
                <Text style={s.emptyTxt}>No sessions yet</Text>
                <Text style={s.emptySub}>Record or upload a workout to see your history</Text>
              </View>
            ) : (
              sessions.map(session => (
                <TouchableOpacity
                  key={session.id}
                  style={s.sessionCard}
                  onPress={() => openSession(session)}
                  activeOpacity={session.summary ? 0.7 : 1}
                >
                  <View style={s.sessionLeft}>
                    <Text style={s.sessionEx}>
                      {session.exercise.replace(/_/g, ' ')}
                    </Text>
                    <Text style={s.sessionMeta}>
                      {new Date(session.date).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                      {session.reps > 0 ? `  ·  ${session.reps} reps` : ''}
                      {session.duration_s > 0 ? `  ·  ${Math.round(session.duration_s)}s` : ''}
                    </Text>
                  </View>

                  <View style={s.sessionRight}>
                    <Text style={[s.sessionScore, { color: scoreColor(session.score) }]}>
                      {session.score}%
                    </Text>
                    {session.summary && (
                      <Text style={s.viewTxt}>View →</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* By Exercise tab */}
        {tab === 'stats' && (
          <>
            {exStats.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>📊</Text>
                <Text style={s.emptyTxt}>No data yet</Text>
              </View>
            ) : (
              exStats.map(({ ex, count, avgScore: avg, totalReps: reps }) => (
                <View key={ex} style={s.exStatCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.exStatName}>{ex.replace(/_/g, ' ')}</Text>
                    <Text style={s.exStatMeta}>{count} session{count > 1 ? 's' : ''}  ·  {reps} reps</Text>

                    {/* Score bar */}
                    <View style={s.barBg}>
                      <View style={[s.barFill, {
                        width: `${avg}%` as any,
                        backgroundColor: scoreColor(avg),
                      }]} />
                    </View>
                  </View>
                  <Text style={[s.exStatScore, { color: scoreColor(avg) }]}>{avg}%</Text>
                </View>
              ))
            )}
          </>
        )}

        {sessions.length > 0 && (
          <TouchableOpacity style={s.clearBtn} onPress={clearAll}>
            <Text style={s.clearTxt}>Clear all sessions</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.statBox}>
      <Text style={[s.statVal, color ? { color } : {}]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  scroll: {
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: Space.md,
    paddingBottom: 120,
    alignItems: 'center',
  },
  title:  { color: Colors.text, fontSize: Font.sizes.xl, fontWeight: Font.weight.bold, marginBottom: Space.xl },

  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.card,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Space.sm,
    borderWidth: 2, borderColor: Colors.accent,
  },
  name: { color: Colors.text, fontSize: Font.sizes.lg, fontWeight: Font.weight.bold },
  sub:  { color: Colors.textMuted, fontSize: Font.sizes.sm, marginBottom: Space.xl },

  statsRow: { flexDirection: 'row', gap: Space.xs, marginBottom: Space.xl, width: '100%' },
  statBox:  {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Space.sm, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  statVal:   { color: Colors.accent, fontSize: Font.sizes.lg, fontWeight: Font.weight.black },
  statLabel: { color: Colors.textMuted, fontSize: 10, marginTop: 2, textAlign: 'center' },

  tabRow: {
    flexDirection: 'row', width: '100%',
    backgroundColor: Colors.card,
    borderRadius: Radius.md, padding: 4,
    marginBottom: Space.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabBtn:      { flex: 1, paddingVertical: Space.sm, alignItems: 'center', borderRadius: Radius.sm },
  tabActive:   { backgroundColor: Colors.surface },
  tabTxt:      { color: Colors.textMuted, fontWeight: Font.weight.medium, fontSize: Font.sizes.sm },
  tabTxtActive:{ color: Colors.text, fontWeight: Font.weight.bold },

  sessionCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Space.md, width: '100%', marginBottom: Space.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  sessionLeft:  { flex: 1 },
  sessionEx:    { color: Colors.text, fontWeight: Font.weight.semi, fontSize: Font.sizes.md, textTransform: 'capitalize', marginBottom: 2 },
  sessionMeta:  { color: Colors.textMuted, fontSize: Font.sizes.xs },
  sessionRight: { alignItems: 'flex-end', gap: 2 },
  sessionScore: { fontWeight: Font.weight.black, fontSize: Font.sizes.lg },
  viewTxt:      { color: Colors.accent, fontSize: Font.sizes.xs },

  exStatCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Space.md, width: '100%', marginBottom: Space.sm,
    borderWidth: 1, borderColor: Colors.border, gap: Space.md,
  },
  exStatName:  { color: Colors.text, fontWeight: Font.weight.semi, textTransform: 'capitalize', marginBottom: 2 },
  exStatMeta:  { color: Colors.textMuted, fontSize: Font.sizes.xs, marginBottom: Space.xs },
  barBg:       { height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  barFill:     { height: 4, borderRadius: 2 },
  exStatScore: { fontWeight: Font.weight.black, fontSize: Font.sizes.lg, width: 44, textAlign: 'right' },

  empty:    { alignItems: 'center', paddingVertical: Space.xl * 2 },
  emptyIcon:{ fontSize: 48, marginBottom: Space.md },
  emptyTxt: { color: Colors.text, fontSize: Font.sizes.lg, fontWeight: Font.weight.bold },
  emptySub: { color: Colors.textMuted, fontSize: Font.sizes.sm, textAlign: 'center', marginTop: Space.sm, paddingHorizontal: Space.xl },

  clearBtn: { marginTop: Space.xl, padding: Space.sm },
  clearTxt: { color: Colors.danger, fontSize: Font.sizes.sm },
});