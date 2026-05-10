import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Platform,
} from 'react-native';
import { Colors, Font, Radius, Space } from '../../constants/theme';
import { useSessionStore } from '../../store/useSessionStore';
import type { WorkoutSession } from '../../types';

const DAYS = ['S','M','T','W','T','F','S'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CalendarScreen() {
  const { sessions, loadSessions } = useSessionStore();
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => { loadSessions(); }, []);

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const startDay    = new Date(month.getFullYear(), month.getMonth(), 1).getDay();

  const sessionsByDate: Record<string, WorkoutSession[]> = {};
  sessions.forEach(s => {
    const key = s.date.split('T')[0];
    if (!sessionsByDate[key]) sessionsByDate[key] = [];
    sessionsByDate[key].push(s);
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const selSessions = selected ? (sessionsByDate[selected] ?? []) : (sessionsByDate[todayStr] ?? []);

  const prev = () => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1));
  const next = () => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1));

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>FormFix</Text>

      {/* Month header */}
      <View style={styles.monthRow}>
        <TouchableOpacity onPress={prev}><Text style={styles.arrow}>‹</Text></TouchableOpacity>
        <Text style={styles.monthTitle}>
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </Text>
        <TouchableOpacity onPress={next}><Text style={styles.arrow}>›</Text></TouchableOpacity>
      </View>

      {/* Day labels */}
      <View style={styles.grid}>
        {DAYS.map((d, i) => (
          <Text key={i} style={styles.dayLabel}>{d}</Text>
        ))}

        {/* Empty slots */}
        {Array.from({ length: startDay }).map((_, i) => <View key={`e${i}`} style={styles.cell} />)}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day  = i + 1;
          const key  = `${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const hasSessions = !!sessionsByDate[key];
          const isToday     = key === todayStr;
          const isSelected  = key === selected;

          return (
            <TouchableOpacity
              key={key}
              style={[styles.cell, isSelected && styles.cellSelected, isToday && styles.cellToday]}
              onPress={() => setSelected(s => s === key ? null : key)}
            >
              <Text style={[styles.dayNum, (isSelected || isToday) && { color: Colors.bg }]}>{day}</Text>
              {hasSessions && <View style={[styles.dot, isSelected && { backgroundColor: Colors.bg }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Session list */}
      <Text style={styles.section}>
        {selected
          ? new Date(selected).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })
          : 'Today'
        }
      </Text>

      {selSessions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No sessions recorded</Text>
        </View>
      ) : (
        selSessions.map(s => <SessionCard key={s.id} session={s} />)
      )}
    </ScrollView>
  );
}

function SessionCard({ session }: { session: WorkoutSession }) {
  const color = session.score >= 80 ? Colors.accent : session.score >= 60 ? Colors.warn : Colors.danger;
  const mins  = Math.floor(session.duration_s / 60);
  const secs  = Math.round(session.duration_s % 60);

  return (
    <View style={styles.sessionCard}>
      <View style={[styles.sessionBar, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.sessionEx}>{session.exercise.replace('_',' ')}</Text>
        <Text style={styles.sessionSub}>{session.reps} reps · {mins}m {secs}s</Text>
      </View>
      <Text style={[styles.sessionScore, { color }]}>{session.score}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingHorizontal: Space.md, paddingBottom: 120 },
  title:  { color: Colors.text, fontSize: Font.sizes.xl, fontWeight: Font.weight.bold, textAlign: 'center', marginBottom: Space.md },

  monthRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space.md },
  monthTitle: { color: Colors.text, fontSize: Font.sizes.lg, fontWeight: Font.weight.semi },
  arrow:      { color: Colors.text, fontSize: Font.sizes.xl, paddingHorizontal: Space.md },

  grid:      { flexDirection: 'row', flexWrap: 'wrap' },
  dayLabel:  { width: '14.28%', textAlign: 'center', color: Colors.textMuted, fontSize: Font.sizes.xs, fontWeight: Font.weight.semi, marginBottom: Space.xs },
  cell:      { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  cellToday: { backgroundColor: Colors.textDim },
  cellSelected: { backgroundColor: Colors.accent },
  dayNum:    { color: Colors.text, fontSize: Font.sizes.sm },
  dot:       { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.accent, marginTop: 2 },

  section:     { color: Colors.text, fontWeight: Font.weight.bold, fontSize: Font.sizes.lg, marginTop: Space.xl, marginBottom: Space.md },
  emptyCard:   { backgroundColor: Colors.card, borderRadius: Radius.md, padding: Space.xl, alignItems: 'center' },
  emptyText:   { color: Colors.textMuted, fontSize: Font.sizes.md },

  sessionCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.md, marginBottom: Space.sm, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  sessionBar:   { width: 4, alignSelf: 'stretch' },
  sessionEx:    { color: Colors.text, fontWeight: Font.weight.semi, fontSize: Font.sizes.md, paddingLeft: Space.md, paddingTop: Space.sm, textTransform: 'capitalize' },
  sessionSub:   { color: Colors.textMuted, fontSize: Font.sizes.sm, paddingLeft: Space.md, paddingBottom: Space.sm },
  sessionScore: { fontWeight: Font.weight.black, fontSize: Font.sizes.xl, paddingRight: Space.md },
});
