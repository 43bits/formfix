
import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Colors, Font, Radius, Space } from '../constants/theme';
import { useSessionStore } from '../store/useSessionStore';
import ScoreRing from '../components/feedback/ScoreRing';
import FeedbackCard from '../components/feedback/FeedbackCard';
import SnapHeader from '../components/ui/SnapHeader';
import type { WorkoutSession } from '../types';

export default function AnalysisScreen() {
  const { pending, setPending, addSession } = useSessionStore();
     const summary = pending;
  if (!summary) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.textMuted }}>No analysis data</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: Colors.accent }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!pending) {
    return (
      <View style={styles.center}>
        <Text style={styles.noData}>No analysis data</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: Colors.accent }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { exercise, total_reps, avg_score, duration_s, reps } = pending;
  const mins = Math.floor(duration_s / 60);
  const secs = Math.round(duration_s % 60);

  const handleSave = async () => {
    const session: WorkoutSession = {
      id:       Date.now().toString(),
      date:     new Date().toISOString(),
      exercise,
      score:    Math.round(avg_score),
      reps:     total_reps,
      duration_s,
      summary:  pending,
    };
    await addSession(session);
    setPending(null);
    router.replace('/calendar');
  };

  // Collect top errors
  const allErrors = reps.flatMap(r => r.errors);
  const errorCounts: Record<string, number> = {};
  allErrors.forEach(e => { errorCounts[e] = (errorCounts[e] ?? 0) + 1; });
  const topErrors = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <View style={styles.root}>
      <SnapHeader title="Session Analysis" showBack />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero score */}
        <View style={styles.heroRow}>
          <ScoreRing score={Math.round(avg_score)} size={140} />
          <View style={styles.heroStats}>
            <StatLine label="Exercise"  value={exercise.replace('_', ' ')} />
            <StatLine label="Reps"      value={String(total_reps)} />
            <StatLine label="Duration"  value={`${mins}m ${secs}s`} />
            <StatLine label="Analysed"  value={`${pending.total_frames_analysed} frames`} />
          </View>
        </View>

        {/* Key Feedback */}
        <Text style={styles.sectionTitle}>Key Feedback</Text>
        {avg_score >= 75 && <FeedbackCard type="good" text="Solid overall form" detail={`Avg score ${Math.round(avg_score)}/100`} />}
        {topErrors.map(([err, count], i) => (
          <FeedbackCard
            key={i}
            type={count >= 3 ? 'error' : 'warn'}
            text={err}
            detail={`Occurred in ${count} rep${count > 1 ? 's' : ''}`}
          />
        ))}

        {/* Rep breakdown */}
        <Text style={styles.sectionTitle}>Rep Breakdown</Text>
        {reps.map((rep) => (
          <View key={rep.rep_number} style={styles.repCard}>
            <View style={styles.repHeader}>
              <Text style={styles.repTitle}>Rep {rep.rep_number}</Text>
              <Text style={[
                styles.repScore,
                { color: rep.avg_score >= 80 ? Colors.accent : rep.avg_score >= 60 ? Colors.warn : Colors.danger }
              ]}>
                {Math.round(rep.avg_score)}%
              </Text>
            </View>
            {rep.errors.slice(0, 2).map((e, i) => (
              <Text key={i} style={styles.repError}>• {e}</Text>
            ))}
          </View>
        ))}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>💾  Save to History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setPending(null); router.back(); }}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: Space.xs }}>
      <Text style={{ color: Colors.textMuted, fontSize: Font.sizes.xs }}>{label}</Text>
      <Text style={{ color: Colors.text, fontSize: Font.sizes.md, fontWeight: Font.weight.semi, textTransform: 'capitalize' }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  noData: { color: Colors.textMuted, fontSize: Font.sizes.md, marginBottom: Space.md },
  scroll: { paddingTop: 110, paddingBottom: 80, paddingHorizontal: Space.md },

  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xl,
    marginBottom: Space.xl,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Space.lg,
  },
  heroStats: { flex: 1, gap: Space.sm },

  sectionTitle: {
    color: Colors.text,
    fontSize: Font.sizes.lg,
    fontWeight: Font.weight.bold,
    marginBottom: Space.sm,
    marginTop: Space.md,
  },

  repCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Space.md,
    marginBottom: Space.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  repHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Space.xs },
  repTitle:  { color: Colors.text, fontWeight: Font.weight.semi, fontSize: Font.sizes.md },
  repScore:  { fontWeight: Font.weight.bold, fontSize: Font.sizes.md },
  repError:  { color: Colors.textMuted, fontSize: Font.sizes.sm },

  actions:     { gap: Space.sm, marginTop: Space.xl },
  saveBtn:     { backgroundColor: Colors.text, borderRadius: Radius.md, padding: Space.md, alignItems: 'center' },
  saveBtnText: { color: Colors.bg, fontWeight: Font.weight.bold, fontSize: Font.sizes.md },
  retryBtn:    { backgroundColor: Colors.card, borderRadius: Radius.md, padding: Space.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  retryBtnText:{ color: Colors.text, fontWeight: Font.weight.medium, fontSize: Font.sizes.md },
});
