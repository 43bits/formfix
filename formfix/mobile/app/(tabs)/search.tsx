// import React, { useState } from 'react';
// import {
//   View, Text, TextInput, FlatList,
//   TouchableOpacity, StyleSheet, Platform,
// } from 'react-native';
// import { Colors, Font, Radius, Space } from '../../constants/theme';
// import { EXERCISES } from '../../constants/exercises';
// import { Ionicons } from '@expo/vector-icons';

// const GUIDES = [
//   { id: 'g1', title: 'Knee Stability Pro',   sub: '12 Lenses · AI Guided',   icon: '🦵' },
//   { id: 'g2', title: 'Spinal Alignment',      sub: '8 Lenses · Dynamic',      icon: '🦴' },
//   { id: 'g3', title: 'Rotator Cuff Health',   sub: '15 Lenses · Real-time',   icon: '💪' },
//   { id: 'g4', title: 'Hip Flexor Release',    sub: '6 Lenses · Mobility',     icon: '🏃' },
// ];

// export default function SearchScreen() {
//   const [query, setQuery] = useState('');

//   const filtered = EXERCISES.filter(e =>
//     e.label.toLowerCase().includes(query.toLowerCase())
//   );

//   return (
//     <View style={styles.root}>
//       <View style={styles.header}>
//         <Text style={styles.title}>formfix</Text>
//         <View style={styles.searchBar}>
//           <Ionicons name="search" size={16} color={Colors.textMuted} />
//           <TextInput
//             style={styles.input}
//             placeholder="Exercises, Guides, or Friends..."
//             placeholderTextColor={Colors.textMuted}
//             value={query}
//             onChangeText={setQuery}
//           />
//           <Ionicons name="options" size={16} color={Colors.textMuted} />
//         </View>
//       </View>

//       <FlatList
//         data={filtered}
//         keyExtractor={i => i.id}
//         contentContainerStyle={styles.list}
//         ListHeaderComponent={() => (
//           <>
//             <Text style={styles.section}>Injury Prevention Basics</Text>
//             {GUIDES.map(g => (
//               <TouchableOpacity key={g.id} style={styles.guideCard}>
//                 <View style={styles.guideIcon}><Text style={{ fontSize: 24 }}>{g.icon}</Text></View>
//                 <View style={{ flex: 1 }}>
//                   <Text style={styles.guideTitle}>{g.title}</Text>
//                   <Text style={styles.guideSub}>{g.sub}</Text>
//                 </View>
//                 <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
//               </TouchableOpacity>
//             ))}
//             <Text style={styles.section}>Exercises</Text>
//           </>
//         )}
//         renderItem={({ item }) => (
//           <TouchableOpacity style={styles.exChip}>
//             <Text style={styles.exIcon}>{item.icon}</Text>
//             <Text style={styles.exLabel}>{item.label}</Text>
//           </TouchableOpacity>
//         )}
//         numColumns={2}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   root:   { flex: 1, backgroundColor: Colors.bg },
//   header: { paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingHorizontal: Space.md, paddingBottom: Space.md },
//   title:  { color: Colors.text, fontSize: Font.sizes.xl, fontWeight: Font.weight.bold, textAlign: 'center', marginBottom: Space.md },

//   searchBar: {
//     flexDirection: 'row', alignItems: 'center',
//     backgroundColor: Colors.card,
//     borderRadius: Radius.full,
//     paddingHorizontal: Space.md,
//     paddingVertical: Space.sm,
//     gap: Space.sm,
//     borderWidth: 1, borderColor: Colors.border,
//   },
//   input: { flex: 1, color: Colors.text, fontSize: Font.sizes.sm },

//   list:    { paddingHorizontal: Space.md, paddingBottom: 100 },
//   section: { color: Colors.textMuted, fontSize: Font.sizes.xs, fontWeight: Font.weight.semi, textTransform: 'uppercase', letterSpacing: 1, marginVertical: Space.md },

//   guideCard: {
//     flexDirection: 'row', alignItems: 'center',
//     backgroundColor: Colors.card,
//     borderRadius: Radius.md,
//     padding: Space.md,
//     marginBottom: Space.sm,
//     gap: Space.md,
//     borderWidth: 1, borderColor: Colors.border,
//   },
//   guideIcon:  { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
//   guideTitle: { color: Colors.text, fontWeight: Font.weight.semi, fontSize: Font.sizes.md },
//   guideSub:   { color: Colors.textMuted, fontSize: Font.sizes.sm, marginTop: 2 },

//   exChip: {
//     flex: 1, margin: Space.xs,
//     backgroundColor: Colors.card,
//     borderRadius: Radius.md,
//     padding: Space.md,
//     alignItems: 'center',
//     gap: Space.xs,
//     borderWidth: 1, borderColor: Colors.border,
//   },
//   exIcon:  { fontSize: 28 },
//   exLabel: { color: Colors.text, fontSize: Font.sizes.sm, fontWeight: Font.weight.medium },
// });

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Font, Radius, Space } from '../../constants/theme';
import { EXERCISES } from '../../constants/exercises';
import { useVideoAnalysis } from '../../hooks/useVideoAnalysis';
import { useSessionStore } from '../../store/useSessionStore';

const GUIDES = [
  { id: 'g1', title: 'Knee Stability',     sub: 'Joint protection basics', icon: '🦵', ex: 'squat' },
  { id: 'g2', title: 'Spinal Alignment',   sub: 'Protect your lower back', icon: '🦴', ex: 'deadlift' },
  { id: 'g3', title: 'Shoulder Health',    sub: 'Rotator cuff safety',    icon: '💪', ex: 'shoulder_press' },
  { id: 'g4', title: 'Hip Mechanics',      sub: 'Hip hinge mastery',      icon: '🏃', ex: 'romanian_deadlift' },
];

type ViewMode = 'browse' | 'exercise';

export default function SearchScreen() {
  const [query,       setQuery      ] = useState('');
  const [viewMode,    setViewMode   ] = useState<ViewMode>('browse');
  const [selectedEx,  setSelectedEx ] = useState<typeof EXERCISES[0] | null>(null);

  const { analyse, loading } = useVideoAnalysis();
  const { setPending }       = useSessionStore();

  const filtered = EXERCISES.filter(e =>
    e.label.toLowerCase().includes(query.toLowerCase())
  );

  // ── Upload video for selected exercise ───────────────────────────────
  const uploadForExercise = useCallback(async (exerciseId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const data = await analyse(res.assets[0].uri, exerciseId);
    if (data) {
      setPending(data);
      setTimeout(() => router.push('/analysis'), 50);
    }
  }, [analyse, setPending]);

  // ── Go to camera with exercise pre-selected ──────────────────────────
  const openCameraFor = useCallback((exerciseId: string) => {
    // Navigate to camera tab — pass exercise via query param or global store
    router.push({ pathname: '/(tabs)', params: { exercise: exerciseId } });
  }, []);

  // ── Exercise detail view ─────────────────────────────────────────────
  if (viewMode === 'exercise' && selectedEx) {
    return (
      <View style={s.root}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => { setViewMode('browse'); setSelectedEx(null); }}>
            <Ionicons name="chevron-back" size={20} color={Colors.text} />
            <Text style={s.backTxt}>Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.detailScroll}>
          {/* Exercise hero */}
          <View style={s.detailHero}>
            <Text style={s.detailIcon}>{selectedEx.icon}</Text>
            <Text style={s.detailTitle}>{selectedEx.label}</Text>
            <Text style={s.detailSub}>AI-powered form analysis</Text>
          </View>

          {/* Action cards */}
          <Text style={s.section}>Analyse Your Form</Text>

          <TouchableOpacity
            style={s.actionCard}
            onPress={() => uploadForExercise(selectedEx.id)}
            disabled={loading}
          >
            <View style={[s.actionIcon, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
              {loading
                ? <ActivityIndicator color={Colors.accent} size="small" />
                : <Ionicons name="cloud-upload-outline" size={24} color={Colors.accent} />
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.actionTitle}>Upload Video</Text>
              <Text style={s.actionSub}>
                {loading ? 'Analysing…' : 'Pick from gallery · Full rep breakdown'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionCard}
            onPress={() => openCameraFor(selectedEx.id)}
          >
            <View style={[s.actionIcon, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
              <Ionicons name="videocam-outline" size={24} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.actionTitle}>Live Camera</Text>
              <Text style={s.actionSub}>Real-time feedback · Pre-set to {selectedEx.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* Tips placeholder */}
          <Text style={s.section}>Common Errors</Text>
          <View style={s.tipsCard}>
            <TipRow icon="⚠️" text="Back rounding — keep spine neutral" />
            <TipRow icon="⚠️" text="Knees caving inward at bottom" />
            <TipRow icon="⚠️" text="Partial range of motion" />
            <TipRow icon="✅" text="Chest up, core braced throughout" />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Browse view ──────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Explore</Text>
        <View style={s.searchBar}>
          <Ionicons name="search" size={16} color={Colors.textMuted} />
          <TextInput
            style={s.input}
            placeholder="Search exercises…"
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={s.list}
        numColumns={2}
        ListHeaderComponent={() => (
          <>
            {/* Guides — only shown when not searching */}
            {query.length === 0 && (
              <>
                <Text style={s.section}>Injury Prevention</Text>
                {GUIDES.map(g => (
                  <TouchableOpacity
                    key={g.id}
                    style={s.guideCard}
                    onPress={() => {
                      const ex = EXERCISES.find(e => e.id === g.ex);
                      if (ex) { setSelectedEx(ex); setViewMode('exercise'); }
                    }}
                  >
                    <View style={s.guideIcon}>
                      <Text style={{ fontSize: 24 }}>{g.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.guideTitle}>{g.title}</Text>
                      <Text style={s.guideSub}>{g.sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </>
            )}
            <Text style={s.section}>
              {query.length > 0 ? `Results for "${query}"` : 'All Exercises'}
            </Text>
          </>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.exChip}
            onPress={() => { setSelectedEx(item); setViewMode('exercise'); }}
          >
            <Text style={s.exIcon}>{item.icon}</Text>
            <Text style={s.exLabel}>{item.label}</Text>
            {/* Upload shortcut */}
            <TouchableOpacity
              style={s.exUpload}
              onPress={() => uploadForExercise(item.id)}
              disabled={loading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="cloud-upload-outline" size={14} color={Colors.accent} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Text style={{ color: Colors.textMuted, fontSize: Font.sizes.md }}>No exercises found</Text>
          </View>
        )}
      />
    </View>
  );
}

function TipRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: Space.sm, marginBottom: Space.sm, alignItems: 'flex-start' }}>
      <Text style={{ fontSize: 14 }}>{icon}</Text>
      <Text style={{ color: Colors.textMuted, fontSize: Font.sizes.sm, flex: 1 }}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: Space.md,
    paddingBottom: Space.md,
  },
  title:  { color: Colors.text, fontSize: Font.sizes.xl, fontWeight: Font.weight.bold, textAlign: 'center', marginBottom: Space.md },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Space.md },
  backTxt: { color: Colors.text, fontSize: Font.sizes.md },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.full,
    paddingHorizontal: Space.md, paddingVertical: Space.sm,
    gap: Space.sm, borderWidth: 1, borderColor: Colors.border,
  },
  input: { flex: 1, color: Colors.text, fontSize: Font.sizes.sm },

  list:    { paddingHorizontal: Space.md, paddingBottom: 100 },
  section: {
    color: Colors.textMuted, fontSize: Font.sizes.xs,
    fontWeight: Font.weight.semi, textTransform: 'uppercase',
    letterSpacing: 1, marginTop: Space.lg, marginBottom: Space.sm,
  },

  guideCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Space.md, marginBottom: Space.sm,
    gap: Space.md, borderWidth: 1, borderColor: Colors.border,
  },
  guideIcon:  { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  guideTitle: { color: Colors.text, fontWeight: Font.weight.semi, fontSize: Font.sizes.md },
  guideSub:   { color: Colors.textMuted, fontSize: Font.sizes.sm, marginTop: 2 },

  exChip: {
    flex: 1, margin: Space.xs,
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Space.md, alignItems: 'center', gap: Space.xs,
    borderWidth: 1, borderColor: Colors.border,
    position: 'relative',
  },
  exIcon:   { fontSize: 28 },
  exLabel:  { color: Colors.text, fontSize: Font.sizes.sm, fontWeight: Font.weight.medium, textAlign: 'center' },
  exUpload: { position: 'absolute', top: 6, right: 6, padding: 4 },

  // Detail view
  detailScroll: { paddingHorizontal: Space.md, paddingBottom: 100 },
  detailHero:   { alignItems: 'center', paddingVertical: Space.xl },
  detailIcon:   { fontSize: 64, marginBottom: Space.md },
  detailTitle:  { color: Colors.text, fontSize: Font.sizes.xxl, fontWeight: Font.weight.black },
  detailSub:    { color: Colors.textMuted, fontSize: Font.sizes.sm, marginTop: 4 },

  actionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Space.md, marginBottom: Space.sm,
    gap: Space.md, borderWidth: 1, borderColor: Colors.border,
  },
  actionIcon:  { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { color: Colors.text, fontWeight: Font.weight.semi, fontSize: Font.sizes.md },
  actionSub:   { color: Colors.textMuted, fontSize: Font.sizes.sm, marginTop: 2 },

  tipsCard: {
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Space.md, borderWidth: 1, borderColor: Colors.border,
  },
});