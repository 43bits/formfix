import React from 'react';
import { ScrollView, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Colors, Font, Radius, Space } from '../../constants/theme';

interface Ex { id: string; label: string; icon: string; }

interface Props {
  exercises: Ex[];
  selected: string;
  onSelect: (id: string) => void;
  detectedLabel: string | null;
}

export default function ExerciseSelector({ exercises, selected, onSelect, detectedLabel }: Props) {
  return (
    <View style={styles.wrap}>
      {detectedLabel && (
        <Text style={styles.detected}>Auto-detected: {detectedLabel}</Text>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {exercises.map((ex) => (
          <TouchableOpacity
            key={ex.id}
            style={[styles.chip, selected === ex.id && styles.chipActive]}
            onPress={() => onSelect(ex.id)}
          >
            <Text style={styles.icon}>{ex.icon}</Text>
            <Text style={[styles.label, selected === ex.id && styles.labelActive]}>{ex.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:     { position: 'absolute', bottom: 200, left: 0, right: 0 },
  detected: { color: Colors.accent, fontSize: Font.sizes.xs, textAlign: 'center', marginBottom: Space.xs, opacity: 0.9 },
  row:      { paddingHorizontal: Space.md, gap: Space.sm },
  chip:     {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(20,20,20,0.85)',
    borderRadius: Radius.full,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: 'rgba(0,230,118,0.15)' },
  icon:   { fontSize: 14 },
  label:  { color: Colors.textMuted, fontSize: Font.sizes.xs, fontWeight: Font.weight.medium },
  labelActive: { color: Colors.accent },
});
