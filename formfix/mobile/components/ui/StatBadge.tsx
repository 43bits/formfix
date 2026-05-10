import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Font, Radius, Space } from '../../constants/theme';

interface Props {
  label: string;
  value: string;
  accent?: boolean;
  color?: string;
}

export default function StatBadge({ label, value, accent, color }: Props) {
  return (
    <View style={styles.badge}>
      <Text style={[styles.value, { color: color ?? (accent ? Colors.accent : Colors.text) }]}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: 'rgba(20,20,20,0.75)',
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    alignItems: 'center',
    minWidth: 72,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  value: { fontSize: Font.sizes.xxl, fontWeight: Font.weight.black, letterSpacing: -1 },
  label: { color: Colors.textMuted, fontSize: Font.sizes.xs, fontWeight: Font.weight.medium, marginTop: 2 },
});
