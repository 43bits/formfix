import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Font, Radius, Space } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  type: 'good' | 'warn' | 'error';
  text: string;
  detail?: string;
}

const config = {
  good:  { icon: 'checkmark-circle' as const, color: Colors.accent  },
  warn:  { icon: 'warning'          as const, color: Colors.warn    },
  error: { icon: 'close-circle'     as const, color: Colors.danger  },
};

export default function FeedbackCard({ type, text, detail }: Props) {
  const { icon, color } = config[type];
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <Ionicons name={icon} size={20} color={color} style={styles.icon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>{text}</Text>
        {detail && <Text style={styles.detail}>{detail}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderLeftWidth: 3,
    padding: Space.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Space.sm,
  },
  icon:   { marginRight: Space.sm, marginTop: 1 },
  text:   { color: Colors.text, fontSize: Font.sizes.md, fontWeight: Font.weight.medium },
  detail: { color: Colors.textMuted, fontSize: Font.sizes.sm, marginTop: 2 },
});
