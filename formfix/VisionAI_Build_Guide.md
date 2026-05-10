# VisionAI — Expo App Build Guide

---

## PHASE 1 — Project Init & Dependencies

```bash
npx create-expo-app VisionAI --template tabs
cd VisionAI

# Core deps
npx expo install expo-camera
npx expo install expo-symbols
npx expo install expo-media-library
npx expo install @react-native-async-storage/async-storage
npx expo install expo-image
npx expo install expo-video
npx expo install expo-sharing
npx expo install expo-web-browser
npx expo install expo-av
npx expo install expo-file-system

# UI & state
npm install zustand
npm install react-native-reanimated
npm install react-native-gesture-handler
npm install @shopify/react-native-skia
npm install react-native-svg

# Already in Expo but ensure:
npx expo install expo-router
npx expo install expo-status-bar
npx expo install expo-haptics
```

**app.json** — add permissions:
```json
{
  "expo": {
    "name": "VisionAI",
    "slug": "visionai",
    "plugins": [
      [
        "expo-camera",
        { "cameraPermission": "VisionAI needs camera for real-time form analysis." }
      ],
      [
        "expo-media-library",
        { "photosPermission": "Save workout sessions to your library." }
      ]
    ]
  }
}
```

---

## PHASE 2 — Directory Structure

```
VisionAI/
├── app/
│   ├── _layout.tsx
│   ├── analysis.tsx           ← post-session results
│   └── (tabs)/
│       ├── _layout.tsx
│       ├── index.tsx          ← Camera / Live Analysis
│       ├── search.tsx         ← Exercise Search
│       ├── calendar.tsx       ← Workout Calendar
│       └── profile.tsx        ← Profile
├── components/
│   ├── camera/
│   │   ├── LiveOverlay.tsx
│   │   └── ExerciseSelector.tsx
│   ├── feedback/
│   │   ├── FeedbackCard.tsx
│   │   ├── ScoreRing.tsx
│   │   └── RepCard.tsx
│   └── ui/
│       ├── SnapHeader.tsx
│       └── StatBadge.tsx
├── hooks/
│   ├── useWorkoutStream.ts
│   ├── useEmotionStream.ts
│   └── useVideoAnalysis.ts
├── constants/
│   ├── theme.ts
│   └── exercises.ts
├── types/
│   └── index.ts
└── store/
    └── useSessionStore.ts
```

---

## PHASE 3 — Constants & Types

### `constants/theme.ts`
```ts
export const Colors = {
  bg:        '#0a0a0a',
  surface:   '#141414',
  card:      '#1c1c1c',
  border:    '#2a2a2a',
  accent:    '#00E676',       // green — form correct
  warn:      '#FFD600',       // yellow — caution
  danger:    '#FF1744',       // red — bad form
  snapYellow:'#FFFC00',
  text:      '#FFFFFF',
  textMuted: '#888888',
  textDim:   '#444444',
};

export const Font = {
  sizes: { xs: 11, sm: 13, md: 15, lg: 18, xl: 24, xxl: 36, hero: 56 },
  weight: { regular: '400', medium: '500', semi: '600', bold: '700', black: '900' } as const,
};

export const Radius = { sm: 8, md: 14, lg: 20, xl: 28, full: 999 };
export const Space  = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
```

### `constants/exercises.ts`
```ts
export const EXERCISES = [
  { id: 'squat',       label: 'Squat',          icon: '🦵' },
  { id: 'deadlift',    label: 'Deadlift',        icon: '🏋️' },
  { id: 'bench_press', label: 'Bench Press',     icon: '💪' },
  { id: 'shoulder_press', label: 'Shoulder Press', icon: '🤸' },
  { id: 'row',         label: 'Barbell Row',     icon: '🔄' },
  { id: 'lunge',       label: 'Lunge',           icon: '🚶' },
  { id: 'pullup',      label: 'Pull-up',         icon: '⬆️' },
  { id: 'pushup',      label: 'Push-up',         icon: '↗️' },
  { id: 'unknown',     label: 'Auto-Detect',     icon: '🔍' },
];
```

### `types/index.ts`
```ts
export interface FormFeedback {
  score: number;                    // 0-100
  errors: string[];
  suggestions: string[];
  rep_count: number;
  annotated_frame?: string;         // base64 jpeg
  angles?: Record<string, number>;
}

export interface RepResult {
  rep_number: number;
  start_frame: number;
  end_frame: number;
  avg_score: number;
  errors: string[];
  worst_angles: Array<{ name: string; angle: number; status: string }>;
  frame_count: number;
}

export interface AnalysisSummary {
  exercise: string;
  total_reps: number;
  avg_score: number;
  duration_s: number;
  total_frames_analysed: number;
  reps: RepResult[];
  thumbnails: Array<{
    timestamp_s: number;
    frame_b64: string;
    rep_number: number | null;
    score: number;
  }>;
}

export interface WorkoutSession {
  id: string;
  date: string;                     // ISO
  exercise: string;
  score: number;
  reps: number;
  duration_s: number;
  summary?: AnalysisSummary;
}
```

---

## PHASE 4 — Hooks (React Native adapted)

### `hooks/useWorkoutStream.ts`
```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormFeedback } from '../types';

// ⚠️  Change IP for physical device: e.g. ws://192.168.1.x:8000/...
// iOS sim = localhost | Android emu = 10.0.2.2
const WS_URL = 'ws://localhost:8000/api/ws/stream';

interface StreamMessage {
  feedback?: FormFeedback;
  annotated_frame?: string;
  detected_exercise?: string;
  error?: string;
}

export function useWorkoutStream(
  exercise: string,
  onAutoDetect?: (ex: string) => void
) {
  const ws       = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [feedback,          setFeedback         ] = useState<FormFeedback | null>(null);
  const [connected,         setConnected        ] = useState(false);
  const [detectedExercise,  setDetectedExercise ] = useState<string | null>(null);
  const [wsError,           setWsError          ] = useState<string | null>(null);

  useEffect(() => {
    const connect = () => {
      const socket = new WebSocket(WS_URL);

      socket.onopen = () => { setConnected(true); setWsError(null); };

      socket.onclose = () => {
        setConnected(false);
        retryRef.current = setTimeout(connect, 2000);
      };

      socket.onerror = () => setWsError('WebSocket connection failed');

      socket.onmessage = (e) => {
        try {
          const data: StreamMessage = JSON.parse(e.data);
          if (data.error) return;
          if (data.feedback) {
            setFeedback({ ...data.feedback, annotated_frame: data.annotated_frame });
          }
          if (data.detected_exercise && data.detected_exercise !== 'unknown') {
            setDetectedExercise(data.detected_exercise);
            if (exercise === 'unknown' && onAutoDetect) onAutoDetect(data.detected_exercise);
          }
        } catch { /* malformed */ }
      };

      ws.current = socket;
    };

    connect();
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      ws.current?.close();
    };
  }, []);

  /**
   * Call this with a base64 JPEG string from camera
   * (replace canvas logic — in RN use takePictureAsync base64)
   */
  const sendFrameB64 = useCallback(
    (frame_b64: string) => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
      ws.current.send(
        JSON.stringify({ frame_b64, exercise, timestamp_ms: Date.now() })
      );
    },
    [exercise]
  );

  return { feedback, connected, detectedExercise, wsError, sendFrameB64 };
}
```

### `hooks/useEmotionStream.ts`
```ts
import { useCallback, useEffect, useRef, useState } from 'react';

const WS_URL = 'ws://localhost:8000/api/emotion/ws';

export interface EmotionData {
  dominant: string;
  scores: Record<string, number>;
  valence: number;
  face_detected: boolean;
  face_bbox: [number, number, number, number] | null;
  music: { genre: string; bpm: string; reason: string } | null;
}

export function useEmotionStream() {
  const ws = useRef<WebSocket | null>(null);
  const [emotion,   setEmotion  ] = useState<EmotionData | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    ws.current = new WebSocket(WS_URL);
    ws.current.onopen    = () => setConnected(true);
    ws.current.onclose   = () => setConnected(false);
    ws.current.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (!d.error) setEmotion(d);
    };
    return () => ws.current?.close();
  }, []);

  const sendFrameB64 = useCallback(
    (frame_b64: string, formScore: number, repNumber: number, exercise: string) => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
      ws.current.send(JSON.stringify({ frame_b64, form_score: formScore, rep_number: repNumber, exercise }));
    },
    []
  );

  return { emotion, connected, sendFrameB64 };
}
```

### `hooks/useVideoAnalysis.ts`
```ts
import { useState, useCallback } from 'react';
import * as FileSystem from 'expo-file-system';
import type { AnalysisSummary } from '../types';

const API = 'http://localhost:8000/api';

export function useVideoAnalysis() {
  const [loading,  setLoading ] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result,   setResult  ] = useState<AnalysisSummary | null>(null);
  const [error,    setError   ] = useState<string | null>(null);

  const analyse = useCallback(async (fileUri: string, exercise = 'unknown') => {
    setLoading(true); setProgress(0); setError(null); setResult(null);

    const ticker = setInterval(() => setProgress((p) => Math.min(p + 4, 85)), 600);

    try {
      const uploadResult = await FileSystem.uploadAsync(
        `${API}/analyse-video`,
        fileUri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          parameters: { exercise },
        }
      );
      if (uploadResult.status !== 200) throw new Error(`Server error ${uploadResult.status}`);
      const data: AnalysisSummary = JSON.parse(uploadResult.body);
      setResult(data);
      setProgress(100);
    } catch (e: any) {
      setError(e.message ?? 'Analysis failed');
    } finally {
      clearInterval(ticker);
      setLoading(false);
    }
  }, []);

  const autoDetect = useCallback(async (fileUri: string): Promise<string> => {
    try {
      const res = await FileSystem.uploadAsync(
        `${API}/detect-exercise`,
        fileUri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
        }
      );
      const data = JSON.parse(res.body);
      return data.exercise ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }, []);

  return { analyse, autoDetect, loading, progress, result, error };
}
```

---

## PHASE 5 — Store

### `store/useSessionStore.ts`
```ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutSession, AnalysisSummary } from '../types';

interface SessionStore {
  sessions: WorkoutSession[];
  pending: AnalysisSummary | null;      // set before navigating to analysis screen
  setPending: (s: AnalysisSummary | null) => void;
  addSession: (s: WorkoutSession) => Promise<void>;
  loadSessions: () => Promise<void>;
}

const KEY = 'visionai_sessions';

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  pending: null,

  setPending: (s) => set({ pending: s }),

  addSession: async (session) => {
    const next = [session, ...get().sessions].slice(0, 200);
    set({ sessions: next });
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  },

  loadSessions: async () => {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) set({ sessions: JSON.parse(raw) });
  },
}));
```

---

## PHASE 6 — Navigation

### `app/_layout.tsx`
```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="analysis" options={{ presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
```

### `app/(tabs)/_layout.tsx`
```tsx
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

type Icon = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: Icon; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconActive]}>
      <Ionicons name={name} size={22} color={focused ? Colors.accent : Colors.textMuted} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.bar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="search"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="search" focused={focused} /> }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="calendar-outline" focused={focused} /> }}
      />
      {/* Centre — Camera (index) */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.centerBtn}>
              <View style={styles.centerInner} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon name="person-outline" focused={focused} /> }}
      />
      {/* Hidden extra */}
      <Tabs.Screen name="feed" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 0.5,
    height: 80,
    paddingBottom: 12,
  },
  iconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  iconActive: { backgroundColor: Colors.card },
  centerBtn: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  centerInner: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.bg,
  },
});
```

---

## PHASE 7 — Camera Screen (Live Analysis)

### `app/(tabs)/index.tsx`
```tsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Colors, Font, Radius, Space } from '../../constants/theme';
import { EXERCISES } from '../../constants/exercises';
import { useWorkoutStream } from '../../hooks/useWorkoutStream';
import { useVideoAnalysis } from '../../hooks/useVideoAnalysis';
import { useSessionStore } from '../../store/useSessionStore';
import ExerciseSelector from '../../components/camera/ExerciseSelector';
import LiveOverlay from '../../components/camera/LiveOverlay';
import StatBadge from '../../components/ui/StatBadge';
import SnapHeader from '../../components/ui/SnapHeader';
import * as ImagePicker from 'expo-image-picker';

const { width: W, height: H } = Dimensions.get('window');
const FPS = 5; // frames per second sent to backend

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [exercise,      setExercise      ] = useState('unknown');
  const [isRecording,   setIsRecording   ] = useState(false);
  const [showSelector,  setShowSelector  ] = useState(false);
  const [facing,        setFacing        ] = useState<'front' | 'back'>('back');
  const cameraRef = useRef<CameraView>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { feedback, connected, wsError, sendFrameB64, detectedExercise } =
    useWorkoutStream(exercise, (ex) => setExercise(ex));

  const { analyse, loading: analysing } = useVideoAnalysis();
  const { setPending }                  = useSessionStore();

  // ── Frame capture loop ──────────────────────────────────────────────
  const startCapture = useCallback(() => {
    intervalRef.current = setInterval(async () => {
      if (!cameraRef.current) return;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.4,
          base64: true,
          skipProcessing: true,
          exif: false,
        });
        if (photo?.base64) sendFrameB64(photo.base64);
      } catch { /* camera busy */ }
    }, 1000 / FPS);
  }, [sendFrameB64]);

  const stopCapture = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const toggleRecording = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isRecording) {
      stopCapture();
      setIsRecording(false);
    } else {
      startCapture();
      setIsRecording(true);
    }
  }, [isRecording, startCapture, stopCapture]);

  // ── Upload video ────────────────────────────────────────────────────
  const pickVideo = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = res.assets[0].uri;
    const result = await analyse(uri, exercise);
    if (result) {
      setPending(result as any);
      router.push('/analysis');
    }
  }, [exercise, analyse, setPending]);

  // ── Permission gate ─────────────────────────────────────────────────
  if (!permission) return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.bg }]}>
        <Text style={styles.permText}>Camera access needed</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scoreColor = !feedback ? Colors.textMuted
    : feedback.score >= 80 ? Colors.accent
    : feedback.score >= 60 ? Colors.warn
    : Colors.danger;

  return (
    <View style={styles.root}>
      {/* Camera */}
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing}>
        {/* Skeleton / annotated frame overlay */}
        <LiveOverlay feedback={feedback} />
      </CameraView>

      {/* Header */}
      <SnapHeader
        title="VisionAI"
        subtitle={connected ? '● LIVE' : wsError ? '✕ Offline' : '○ Connecting'}
        subtitleColor={connected ? Colors.accent : Colors.warn}
        onFlip={() => setFacing(f => f === 'back' ? 'front' : 'back')}
      />

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatBadge label="BPM" value={feedback ? '--' : '--'} />
        <StatBadge label="REPS" value={String(feedback?.rep_count ?? 0)} accent />
        <StatBadge label="FORM" value={feedback ? `${feedback.score}%` : '--'} color={scoreColor} />
      </View>

      {/* Errors */}
      {feedback?.errors?.slice(0, 2).map((err, i) => (
        <View key={i} style={styles.errorBubble}>
          <Text style={styles.errorText}>⚠ {err}</Text>
        </View>
      ))}

      {/* Exercise selector strip */}
      <ExerciseSelector
        exercises={EXERCISES}
        selected={exercise}
        onSelect={setExercise}
        detectedLabel={detectedExercise}
      />

      {/* Bottom controls */}
      <View style={styles.controls}>
        {/* Upload */}
        <TouchableOpacity style={styles.sideBtn} onPress={pickVideo} disabled={analysing}>
          {analysing
            ? <ActivityIndicator color={Colors.text} size="small" />
            : <Text style={styles.sideBtnIcon}>↑</Text>
          }
          <Text style={styles.sideBtnLabel}>Upload</Text>
        </TouchableOpacity>

        {/* Record */}
        <TouchableOpacity style={[styles.recBtn, isRecording && styles.recBtnActive]} onPress={toggleRecording}>
          <View style={[styles.recInner, isRecording && styles.recInnerActive]} />
        </TouchableOpacity>

        {/* Flip */}
        <TouchableOpacity style={styles.sideBtn} onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
          <Text style={styles.sideBtnIcon}>⟳</Text>
          <Text style={styles.sideBtnLabel}>Flip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Space.lg,
    paddingTop: 100,
  },

  errorBubble: {
    alignSelf: 'center',
    marginTop: Space.sm,
    backgroundColor: 'rgba(255,23,68,0.85)',
    borderRadius: Radius.full,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
  },
  errorText: { color: Colors.text, fontSize: Font.sizes.sm, fontWeight: Font.weight.semi },

  controls: {
    position: 'absolute',
    bottom: 100,
    left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: Space.xl,
  },

  recBtn: {
    width: 72, height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  recBtnActive: { borderColor: Colors.danger },
  recInner:     { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.text },
  recInnerActive: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.danger },

  sideBtn:      { alignItems: 'center', gap: 4 },
  sideBtnIcon:  { color: Colors.text, fontSize: 22 },
  sideBtnLabel: { color: Colors.textMuted, fontSize: Font.sizes.xs },

  permText:    { color: Colors.text, fontSize: Font.sizes.lg, marginBottom: Space.md },
  permBtn:     { backgroundColor: Colors.accent, borderRadius: Radius.md, paddingHorizontal: Space.lg, paddingVertical: Space.sm },
  permBtnText: { color: Colors.bg, fontWeight: Font.weight.bold },
});
```

---

## PHASE 8 — Components

### `components/camera/LiveOverlay.tsx`
```tsx
import React from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import type { FormFeedback } from '../../types';

const { width: W, height: H } = Dimensions.get('window');

export default function LiveOverlay({ feedback }: { feedback: FormFeedback | null }) {
  if (!feedback?.annotated_frame) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={{ uri: `data:image/jpeg;base64,${feedback.annotated_frame}` }}
        style={styles.overlay}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { width: W, height: H },
});
```

### `components/camera/ExerciseSelector.tsx`
```tsx
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
```

### `components/ui/SnapHeader.tsx`
```tsx
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
```

### `components/ui/StatBadge.tsx`
```tsx
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
```

### `components/feedback/ScoreRing.tsx`
```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Font } from '../../constants/theme';

interface Props { score: number; size?: number; }

export default function ScoreRing({ score, size = 120 }: Props) {
  const r    = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  const color = score >= 80 ? Colors.accent : score >= 60 ? Colors.warn : Colors.danger;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={Colors.card} strokeWidth={8} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={8} fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          rotation="-90" origin={`${size / 2},${size / 2}`}
        />
      </Svg>
      <Text style={[styles.score, { color }]}>{score}</Text>
      <Text style={styles.label}>/100</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  score: { fontSize: Font.sizes.xxl, fontWeight: Font.weight.black },
  label: { color: Colors.textMuted, fontSize: Font.sizes.xs, marginTop: -4 },
});
```

### `components/feedback/FeedbackCard.tsx`
```tsx
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
```

---

## PHASE 9 — Analysis Screen

### `app/analysis.tsx`
```tsx
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
```

---

## PHASE 10 — Search Screen

### `app/(tabs)/search.tsx`
```tsx
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
```

---

## PHASE 11 — Calendar Screen

### `app/(tabs)/calendar.tsx`
```tsx
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
      <Text style={styles.title}>VisionAI</Text>

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
```

---

## PHASE 12 — Profile Screen

### `app/(tabs)/profile.tsx`
```tsx
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
```

---

## PHASE 13 — Start & Device Config

### IP config for physical device
Create `constants/api.ts`:
```ts
import { Platform } from 'react-native';

// iOS sim: localhost | Android emu: 10.0.2.2 | Physical: your LAN IP
const HOST = __DEV__
  ? Platform.OS === 'android'
    ? '10.0.2.2'
    : 'localhost'
  : 'YOUR_PROD_HOST';

export const HTTP_BASE = `http://${HOST}:8000/api`;
export const WS_BASE   = `ws://${HOST}:8000/api`;
```

Then update hooks to import from here instead of hardcoded strings.

### Start
```bash
npx expo start
# Press 'i' for iOS sim, 'a' for Android emu
# Scan QR for physical device (update IP in constants/api.ts first)
```

---

## Quick Checklist

| Item | Status |
|------|--------|
| Backend running on :8000 | ✅ required |
| WS endpoints `/api/ws/stream` & `/api/emotion/ws` | ✅ required |
| POST `/api/analyse-video` | ✅ required |
| POST `/api/detect-exercise` | ✅ required |
| expo-camera permission granted | must accept on device |
| IP set for physical device | update `constants/api.ts` |
