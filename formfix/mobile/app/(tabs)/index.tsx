import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, ScrollView,
} from 'react-native';
// import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions
} from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Colors, Font, Radius, Space } from '../../constants/theme';
import { EXERCISES } from '../../constants/exercises';
import { useWorkoutStream } from '../../hooks/useWorkoutStream';
import { useVideoAnalysis } from '../../hooks/useVideoAnalysis';
import { useSessionStore } from '../../store/useSessionStore';
import ExerciseSelector from '../../components/camera/ExerciseSelector';
import LiveOverlay from '../../components/camera/LiveOverlay';

// Mode drives what the screen renders
type Mode = 'idle' | 'streaming' | 'recording' | 'analysing' | 'preview';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  // const [permission, requestPermission] = useCameraPermissions();
const [micPermission, requestMicPermission] =
  useMicrophonePermissions();
  


  const [exercise,       setExercise      ] = useState('unknown');
  const [facing,         setFacing        ] = useState<'front' | 'back'>('back');
  const [mode,           setMode          ] = useState<Mode>('idle');
  const [cameraMode,     setCameraMode    ] = useState<'picture' | 'video'>('picture');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [saving,         setSaving        ] = useState(false);

  const cameraRef   = useRef<CameraView>(null);
  const wsLoopRef   = useRef(false);
  const wsTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // const { feedback, connected, wsError, sendFrameB64, detectedExercise, repCount } =
    // useWorkoutStream(exercise, (ex) => setExercise(ex));

  const { feedback, connected, wsError, sendFrameB64,
        detectedExercise, repCount, modelConfidence } =
  useWorkoutStream(exercise, (ex) => setExercise(ex));

  const { analyse, loading: analysing } = useVideoAnalysis();
  const { setPending, addSession }      = useSessionStore();

  // ── WS frame loop: only runs in 'streaming' mode (picture camera) ────
  const startWsLoop = useCallback(() => {
    wsLoopRef.current = true;
    const loop = async () => {
      if (!wsLoopRef.current || !cameraRef.current) return;
      try {
        const p = await cameraRef.current.takePictureAsync({
          quality: 0.15,
          base64: true,
          skipProcessing: true,
          exif: false,
        });
        if (p?.base64) sendFrameB64(p.base64);
      } catch { /* camera busy, skip */ }
      if (wsLoopRef.current) wsTimerRef.current = setTimeout(loop, 500);
    };
    loop();
  }, [sendFrameB64]);

  const stopWsLoop = useCallback(() => {
    wsLoopRef.current = false;
    if (wsTimerRef.current) { clearTimeout(wsTimerRef.current); wsTimerRef.current = null; }
  }, []);

  useEffect(() => () => stopWsLoop(), [stopWsLoop]);

  // ── Stream toggle (live feedback, no recording) ───────────────────────
  const toggleStream = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (mode === 'streaming') {
      stopWsLoop();
      setMode('idle');
    } else {
      setCameraMode('picture'); // must be picture for takePictureAsync
      setMode('streaming');
      // small delay so camera re-mounts in picture mode
      setTimeout(() => startWsLoop(), 300);
    }
  }, [mode, startWsLoop, stopWsLoop]);

  // ── Record: switch to video mode, record, then analyse ───────────────
  const startRecording = useCallback(async () => {
    if (!cameraRef.current) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Stop WS loop first — cannot takePicture and record simultaneously
    stopWsLoop();
    setCameraMode('video');
    setMode('recording');

    // Give camera time to switch mode
    await new Promise(r => setTimeout(r, 400));

    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 120 });
      if (video?.uri) {
        setMode('analysing');
        const data = await analyse(video.uri, exercise);
        if (data) {
          setAnalysisResult(data);
          setMode('preview');
        } else {
          setCameraMode('picture');
          setMode('idle');
        }
      } else {
        setCameraMode('picture');
        setMode('idle');
      }
    } catch (e) {
      console.log('Record error:', e);
      setCameraMode('picture');
      setMode('idle');
    }
  }, [stopWsLoop, analyse, exercise]);

  const stopRecording = useCallback(async () => {
    if (!cameraRef.current) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cameraRef.current.stopRecording(); // triggers recordAsync to resolve
  }, []);

  // ── Upload video ──────────────────────────────────────────────────────
  const pickVideo = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });
    if (res.canceled || !res.assets?.[0]) return;
    stopWsLoop();
    setMode('analysing');
    const data = await analyse(res.assets[0].uri, exercise);
    if (data) {
      setPending(data);
      setTimeout(() => router.push('/analysis'), 50);
    }
    setCameraMode('picture');
    setMode('idle');
  }, [exercise, analyse, setPending, stopWsLoop]);

  // ── Save session ──────────────────────────────────────────────────────
  const saveSession = useCallback(async () => {
    if (!analysisResult) return;
    setSaving(true);
    await addSession({
      id: Date.now().toString(),
      date: new Date().toISOString(),
      exercise: analysisResult.exercise ?? exercise,
      score: Math.round(analysisResult.avg_score ?? 0),
      reps: analysisResult.total_reps ?? 0,
      duration_s: analysisResult.duration_s ?? 0,
      summary: analysisResult,
    });
    setSaving(false);
    setAnalysisResult(null);
    setCameraMode('picture');
    setMode('idle');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [analysisResult, exercise, addSession]);

  const discard = useCallback(() => {
    setAnalysisResult(null);
    setCameraMode('picture');
    setMode('idle');
  }, []);

  // ── Permission gate ───────────────────────────────────────────────────
  if (!permission) return <View style={s.center}><ActivityIndicator color={Colors.accent} /></View>;
  if (!permission.granted || !micPermission?.granted) {
    return (
      <View style={[s.center, { backgroundColor: Colors.bg }]}>
        <Text style={s.permText}>Camera access needed</Text>
        <TouchableOpacity
  style={s.permBtn}
  onPress={async () => {
    await requestPermission();
    await requestMicPermission();
  }}
>
          <Text style={s.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scoreColor = !feedback ? Colors.textMuted
    : feedback.score >= 80 ? Colors.accent
    : feedback.score >= 60 ? Colors.warn : Colors.danger;

  // ══════════════════════ ANALYSING ════════════════════════════════════
  if (mode === 'analysing') {
    return (
      <View style={[s.root, s.center, { backgroundColor: Colors.bg }]}>
        <ActivityIndicator color={Colors.accent} size="large" />
        <Text style={s.analysingText}>Analysing your session…</Text>
      </View>
    );
  }

  // ══════════════════════ PREVIEW PANEL ════════════════════════════════
  if (mode === 'preview' && analysisResult) {
    const score      = Math.round(analysisResult.avg_score ?? 0);
    const reps       = analysisResult.total_reps ?? 0;
    const ex         = (analysisResult.exercise ?? exercise).replace(/_/g, ' ');
    const dur        = Math.round(analysisResult.duration_s ?? 0);
    const finalColor = score >= 80 ? Colors.accent : score >= 60 ? Colors.warn : Colors.danger;

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.bg }}
        contentContainerStyle={s.previewScroll}
      >
        <Text style={s.previewTitle}>Session Complete</Text>

        {/* Score ring */}
        <View style={[s.scoreCircle, { borderColor: finalColor }]}>
          <Text style={[s.scoreBig, { color: finalColor }]}>{score}</Text>
          <Text style={s.scoreLabel}>FORM %</Text>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statVal}>{reps}</Text>
            <Text style={s.statLbl}>REPS</Text>
          </View>
          <View style={s.statItem}>
            <Text style={[s.statVal, { textTransform: 'capitalize', fontSize: Font.sizes.md }]}>{ex}</Text>
            <Text style={s.statLbl}>EXERCISE</Text>
          </View>
          <View style={s.statItem}>
            <Text style={s.statVal}>{dur}s</Text>
            <Text style={s.statLbl}>DURATION</Text>
          </View>
        </View>

        {/* Rep breakdown */}
        {analysisResult.reps?.length > 0 && (
          <View style={s.repList}>
            <Text style={s.repListTitle}>Rep Breakdown</Text>
            {analysisResult.reps.slice(0, 8).map((r: any) => {
              const rc = r.avg_score >= 80 ? Colors.accent : r.avg_score >= 60 ? Colors.warn : Colors.danger;
              return (
                <View key={r.rep_number} style={s.repRow}>
                  <Text style={s.repNum}>Rep {r.rep_number}</Text>
                  <Text style={[s.repScore, { color: rc }]}>{Math.round(r.avg_score)}%</Text>
                  {r.errors?.[0] && (
                    <Text style={s.repErr} numberOfLines={1}>⚠ {r.errors[0]}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Actions */}
        <View style={s.previewActions}>
          <TouchableOpacity style={s.discardBtn} onPress={discard}>
            <Text style={s.discardText}>✕  Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.saveBtn} onPress={saveSession} disabled={saving}>
            {saving
              ? <ActivityIndicator color={Colors.bg} size="small" />
              : <Text style={s.saveText}>✓  Save</Text>
            }
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={s.analyseBtn} onPress={() => {
          setPending(analysisResult);
          setTimeout(() => router.push('/analysis'), 50);
        }}>
          <Text style={s.analyseBtnText}>View Full Analysis →</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ══════════════════════ LIVE CAMERA ══════════════════════════════════
  const isRecording  = mode === 'recording';
  const isStreaming  = mode === 'streaming';

  return (
    <View style={s.root}>
      {/* Camera — mode switches between picture (WS) and video (recording) */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode={cameraMode}
      >
        {/* Skeleton overlay — only shows during streaming */}
        {isStreaming && <LiveOverlay feedback={feedback} />}
      </CameraView>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => !isRecording && setFacing(f => f === 'back' ? 'front' : 'back')}
        >
          <Text style={s.iconTxt}>⟳</Text>
        </TouchableOpacity>

        {/* <View style={s.headerCenter}>
          <Text style={s.headerTitle}>fofo</Text>
          <Text style={[s.headerSub, { color: connected ? Colors.accent : Colors.warn }]}>
            {isRecording ? '● REC' : isStreaming ? '● LIVE' : connected ? '○ Ready' : '✕ Offline'}
          </Text>
        </View> */}

        <View style={s.headerCenter}>
  <Text style={s.headerTitle}>Formfix</Text>

  <Text
    style={[
      s.headerSub,
      {
        color: isRecording
          ? Colors.danger
          : connected
          ? Colors.accent
          : Colors.warn,
      },
    ]}
  >
    {isRecording
      ? '● REC'
      : isStreaming
      ? connected
        ? modelConfidence === 0
          ? '○ Buffering...'
          : `● LIVE ${(modelConfidence * 100).toFixed(0)}%`
        : wsError
        ? '✕ Offline'
        : '○ Connecting'
      : connected
      ? '○ Ready'
      : wsError
      ? '✕ Offline'
      : '○ Connecting'}
  </Text>
</View>

        <View style={s.iconBtn} />
      </View>

      {/* Live stats — show during streaming or recording */}
      {(isStreaming || isRecording) && (
        <View style={s.liveStats}>
          <View style={s.badge}>
            <Text style={[s.badgeVal, { color: scoreColor }]}>
              {feedback ? `${feedback.score}%` : '--'}
            </Text>
            <Text style={s.badgeLbl}>FORM</Text>
          </View>
          {isRecording && (
            <View style={[s.badge, { borderColor: Colors.danger, borderWidth: 1 }]}>
              <Text style={{ color: Colors.danger, fontWeight: Font.weight.bold, fontSize: Font.sizes.sm }}>
                ● REC
              </Text>
            </View>
          )}
          <View style={s.badge}>
            <Text style={s.badgeVal}>{repCount}</Text>
            <Text style={s.badgeLbl}>REPS</Text>
          </View>
        </View>
      )}

      {/* Error bubbles */}
      {(isStreaming || isRecording) && feedback?.errors?.slice(0, 1).map((err, i) => (
        <View key={i} style={s.errorBubble}>
          <Text style={s.errorText}>⚠ {err}</Text>
        </View>
      ))}

      {/* Exercise selector — only when idle or streaming */}
      {!isRecording && (
        <ExerciseSelector
          exercises={EXERCISES}
          selected={exercise}
          onSelect={setExercise}
          detectedLabel={detectedExercise}
        />
      )}

      {/* Bottom controls */}
      <View style={s.controls}>

        {/* Left: Upload (idle only) or Stream toggle */}
        {!isRecording ? (
          <TouchableOpacity style={s.sideBtn} onPress={isStreaming ? toggleStream : pickVideo} disabled={analysing}>
            {analysing
              ? <ActivityIndicator color={Colors.text} size="small" />
              : <Text style={s.sideIcon}>{isStreaming ? '◼' : '↑'}</Text>
            }
            <Text style={s.sideLbl}>{isStreaming ? 'Stop' : 'Upload'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.sideBtn} />
        )}

        {/* Centre: Record button */}
        <TouchableOpacity
          style={[s.recBtn, isRecording && s.recBtnActive]}
          onPress={isRecording ? stopRecording : startRecording}
          // disabled={mode === 'analysing'}
          disabled={analysing}
        >
          <View style={[s.recInner, isRecording && s.recInnerActive]} />
        </TouchableOpacity>

        {/* Right: Live stream toggle (idle) or flip */}
        {!isRecording ? (
          <TouchableOpacity style={s.sideBtn} onPress={toggleStream}>
            <Text style={s.sideIcon}>{isStreaming ? '⊙' : '▶'}</Text>
            <Text style={s.sideLbl}>{isStreaming ? 'Live' : 'Live'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.sideBtn} />
        )}

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: Space.md, paddingBottom: Space.sm,
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
  },
  headerCenter: { alignItems: 'center' },
  headerTitle:  { color: Colors.text, fontSize: Font.sizes.lg, fontWeight: Font.weight.bold },
  headerSub:    { fontSize: Font.sizes.xs, fontWeight: Font.weight.medium, marginTop: 2 },
  iconBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  iconTxt:      { color: Colors.text, fontSize: 22 },

  liveStats: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 110 : 96,
    paddingHorizontal: Space.lg,
  },
  badge:    { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: Radius.md, paddingHorizontal: Space.md, paddingVertical: Space.xs },
  badgeVal: { color: Colors.text, fontSize: Font.sizes.xl, fontWeight: Font.weight.black },
  badgeLbl: { color: Colors.textMuted, fontSize: Font.sizes.xs },

  errorBubble: {
    alignSelf: 'center', marginTop: Space.sm,
    backgroundColor: 'rgba(255,23,68,0.85)',
    borderRadius: Radius.full, paddingHorizontal: Space.md, paddingVertical: Space.xs,
  },
  errorText: { color: Colors.text, fontSize: Font.sizes.sm, fontWeight: Font.weight.semi },

  // controls: {
  //   position: 'absolute', bottom: 100, left: 0, right: 0,
  //   flexDirection: 'row', alignItems: 'center',
  //   justifyContent: 'space-around', paddingHorizontal: Space.xl,
  // },
  controls: {
  position: 'absolute',
  bottom: Platform.OS === 'ios' ? 35 : 20, 
  left: 0,
  right: 0,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-around',
  paddingHorizontal: Space.xl,
  zIndex: 20,
  
  },
  
  
  recBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: Colors.text,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  recBtnActive:   { borderColor: Colors.danger },
  recInner:       { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.text },
  recInnerActive: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.danger },
  sideBtn:  { alignItems: 'center', gap: 4, width: 56 },
  sideIcon: { color: Colors.text, fontSize: 22 },
  sideLbl:  { color: Colors.textMuted, fontSize: Font.sizes.xs },

  analysingText: { color: Colors.textMuted, marginTop: Space.md, fontSize: Font.sizes.md },

  permText:    { color: Colors.text, fontSize: Font.sizes.lg, marginBottom: Space.md },
  permBtn:     { backgroundColor: Colors.accent, borderRadius: Radius.md, paddingHorizontal: Space.lg, paddingVertical: Space.sm },
  permBtnText: { color: Colors.bg, fontWeight: Font.weight.bold },

  // Preview
  previewScroll:  { alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 64 : 48, paddingBottom: 48, paddingHorizontal: Space.lg },
  previewTitle:   { color: Colors.text, fontSize: Font.sizes.xl, fontWeight: Font.weight.bold, marginBottom: Space.xl },
  scoreCircle:    { width: 140, height: 140, borderRadius: 70, borderWidth: 4, alignItems: 'center', justifyContent: 'center', marginBottom: Space.xl },
  scoreBig:       { fontSize: Font.sizes.xxl, fontWeight: Font.weight.black },
  scoreLabel:     { color: Colors.textMuted, fontSize: Font.sizes.xs },
  statsRow:       { flexDirection: 'row', gap: Space.xl, marginBottom: Space.xl },
  statItem:       { alignItems: 'center', minWidth: 70 },
  statVal:        { color: Colors.text, fontSize: Font.sizes.lg, fontWeight: Font.weight.bold, textAlign: 'center' },
  statLbl:        { color: Colors.textMuted, fontSize: Font.sizes.xs, marginTop: 2 },

  repList:        { width: '100%', marginBottom: Space.xl },
  repListTitle:   { color: Colors.textMuted, fontSize: Font.sizes.sm, fontWeight: Font.weight.semi, marginBottom: Space.sm },
  repRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.sm, padding: Space.sm, marginBottom: Space.xs, gap: Space.sm },
  repNum:         { color: Colors.text, fontWeight: Font.weight.medium, width: 52 },
  repScore:       { fontWeight: Font.weight.bold, width: 44 },
  repErr:         { color: Colors.textMuted, fontSize: Font.sizes.xs, flex: 1 },

  previewActions: { flexDirection: 'row', gap: Space.sm, width: '100%', marginBottom: Space.sm },
  discardBtn:     { flex: 1, padding: Space.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  discardText:    { color: Colors.textMuted, fontWeight: Font.weight.semi },
  saveBtn:        { flex: 2, padding: Space.md, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center' },
  saveText:       { color: Colors.bg, fontWeight: Font.weight.bold },
  analyseBtn:     { width: '100%', padding: Space.md, borderRadius: Radius.md, backgroundColor: Colors.card, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  analyseBtnText: { color: Colors.text, fontWeight: Font.weight.semi },
});