import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Colors, Font, Space } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface Props {
  title: string;
  subtitle?: string;
  subtitleColor?: string;
  onFlip?: () => void;
  showBack?: boolean;
}

export default function SnapHeader({ title, subtitle, subtitleColor, onFlip, showBack }: Props) {
  return (
    <View style={styles.header}>
      {showBack ? (
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="person-circle-outline" size={26} color={Colors.text} />
        </TouchableOpacity>
      )}

      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={[styles.sub, subtitleColor ? { color: subtitleColor } : {}]}>{subtitle}</Text>}
      </View>

      {onFlip ? (
        <TouchableOpacity style={styles.iconBtn} onPress={onFlip}>
          <Ionicons name="settings-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
      ) : <View style={styles.iconBtn} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: Space.md,
    paddingBottom: Space.sm,
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center:  { alignItems: 'center' },
  title:   { color: Colors.text, fontSize: Font.sizes.lg, fontWeight: Font.weight.bold, letterSpacing: 0.5 },
  sub:     { color: Colors.accent, fontSize: Font.sizes.xs, fontWeight: Font.weight.medium, marginTop: 2 },
});
