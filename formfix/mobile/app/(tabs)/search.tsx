import React, { useState } from 'react';
import {
  View, Text, TextInput, FlatList,
  TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { Colors, Font, Radius, Space } from '../../constants/theme';
import { EXERCISES } from '../../constants/exercises';
import { Ionicons } from '@expo/vector-icons';

const GUIDES = [
  { id: 'g1', title: 'Knee Stability Pro',   sub: '12 Lenses · AI Guided',   icon: '🦵' },
  { id: 'g2', title: 'Spinal Alignment',      sub: '8 Lenses · Dynamic',      icon: '🦴' },
  { id: 'g3', title: 'Rotator Cuff Health',   sub: '15 Lenses · Real-time',   icon: '💪' },
  { id: 'g4', title: 'Hip Flexor Release',    sub: '6 Lenses · Mobility',     icon: '🏃' },
];

export default function SearchScreen() {
  const [query, setQuery] = useState('');

  const filtered = EXERCISES.filter(e =>
    e.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>VisionAI</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="Exercises, Guides, or Friends..."
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
          <Ionicons name="options" size={16} color={Colors.textMuted} />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={() => (
          <>
            <Text style={styles.section}>Injury Prevention Basics</Text>
            {GUIDES.map(g => (
              <TouchableOpacity key={g.id} style={styles.guideCard}>
                <View style={styles.guideIcon}><Text style={{ fontSize: 24 }}>{g.icon}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideTitle}>{g.title}</Text>
                  <Text style={styles.guideSub}>{g.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
            <Text style={styles.section}>Exercises</Text>
          </>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.exChip}>
            <Text style={styles.exIcon}>{item.icon}</Text>
            <Text style={styles.exLabel}>{item.label}</Text>
          </TouchableOpacity>
        )}
        numColumns={2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  header: { paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingHorizontal: Space.md, paddingBottom: Space.md },
  title:  { color: Colors.text, fontSize: Font.sizes.xl, fontWeight: Font.weight.bold, textAlign: 'center', marginBottom: Space.md },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.full,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    gap: Space.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  input: { flex: 1, color: Colors.text, fontSize: Font.sizes.sm },

  list:    { paddingHorizontal: Space.md, paddingBottom: 100 },
  section: { color: Colors.textMuted, fontSize: Font.sizes.xs, fontWeight: Font.weight.semi, textTransform: 'uppercase', letterSpacing: 1, marginVertical: Space.md },

  guideCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Space.md,
    marginBottom: Space.sm,
    gap: Space.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  guideIcon:  { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  guideTitle: { color: Colors.text, fontWeight: Font.weight.semi, fontSize: Font.sizes.md },
  guideSub:   { color: Colors.textMuted, fontSize: Font.sizes.sm, marginTop: 2 },

  exChip: {
    flex: 1, margin: Space.xs,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Space.md,
    alignItems: 'center',
    gap: Space.xs,
    borderWidth: 1, borderColor: Colors.border,
  },
  exIcon:  { fontSize: 28 },
  exLabel: { color: Colors.text, fontSize: Font.sizes.sm, fontWeight: Font.weight.medium },
});
