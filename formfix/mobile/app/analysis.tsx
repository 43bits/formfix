
// import React, { useEffect } from 'react';
// import {
//   View, Text, ScrollView, StyleSheet,
//   TouchableOpacity, Dimensions,
// } from 'react-native';
// import { router } from 'expo-router';
// import { Colors, Font, Radius, Space } from '../constants/theme';
// import { useSessionStore } from '../store/useSessionStore';
// import ScoreRing from '../components/feedback/ScoreRing';
// import FeedbackCard from '../components/feedback/FeedbackCard';
// import SnapHeader from '../components/ui/SnapHeader';
// import type { WorkoutSession } from '../types';

// export default function AnalysisScreen() {
//   const { pending, setPending, addSession } = useSessionStore();
//      const summary = pending;
//   if (!summary) {
//     return (
//       <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
//         <Text style={{ color: Colors.textMuted }}>No analysis data</Text>
//         <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
//           <Text style={{ color: Colors.accent }}>← Go back</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }
//   if (!pending) {
//     return (
//       <View style={styles.center}>
//         <Text style={styles.noData}>No analysis data</Text>
//         <TouchableOpacity onPress={() => router.back()}>
//           <Text style={{ color: Colors.accent }}>Go back</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   const { exercise, total_reps, avg_score, duration_s, reps } = pending;
//   const mins = Math.floor(duration_s / 60);
//   const secs = Math.round(duration_s % 60);

//   const handleSave = async () => {
//     const session: WorkoutSession = {
//       id:       Date.now().toString(),
//       date:     new Date().toISOString(),
//       exercise,
//       score:    Math.round(avg_score),
//       reps:     total_reps,
//       duration_s,
//       summary:  pending,
//     };
//     await addSession(session);
//     setPending(null);
//     router.replace('/calendar');
//   };

//   // Collect top errors
//   const allErrors = reps.flatMap(r => r.errors);
//   const errorCounts: Record<string, number> = {};
//   allErrors.forEach(e => { errorCounts[e] = (errorCounts[e] ?? 0) + 1; });
//   const topErrors = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

//   return (
//     <View style={styles.root}>
//       <SnapHeader title="Session Analysis" showBack />

//       <ScrollView contentContainerStyle={styles.scroll}>
//         {/* Hero score */}
//         <View style={styles.heroRow}>
//           <ScoreRing score={Math.round(avg_score)} size={140} />
//           <View style={styles.heroStats}>
//             <StatLine label="Exercise"  value={exercise.replace('_', ' ')} />
//             <StatLine label="Reps"      value={String(total_reps)} />
//             <StatLine label="Duration"  value={`${mins}m ${secs}s`} />
//             <StatLine label="Analysed"  value={`${pending.total_frames_analysed} frames`} />
//           </View>
//         </View>

//         {/* Key Feedback */}
//         <Text style={styles.sectionTitle}>Key Feedback</Text>
//         {avg_score >= 75 && <FeedbackCard type="good" text="Solid overall form" detail={`Avg score ${Math.round(avg_score)}/100`} />}
//         {topErrors.map(([err, count], i) => (
//           <FeedbackCard
//             key={i}
//             type={count >= 3 ? 'error' : 'warn'}
//             text={err}
//             detail={`Occurred in ${count} rep${count > 1 ? 's' : ''}`}
//           />
//         ))}

//         {/* Rep breakdown */}
//         <Text style={styles.sectionTitle}>Rep Breakdown</Text>
//         {reps.map((rep) => (
//           <View key={rep.rep_number} style={styles.repCard}>
//             <View style={styles.repHeader}>
//               <Text style={styles.repTitle}>Rep {rep.rep_number}</Text>
//               <Text style={[
//                 styles.repScore,
//                 { color: rep.avg_score >= 80 ? Colors.accent : rep.avg_score >= 60 ? Colors.warn : Colors.danger }
//               ]}>
//                 {Math.round(rep.avg_score)}%
//               </Text>
//             </View>
//             {rep.errors.slice(0, 2).map((e, i) => (
//               <Text key={i} style={styles.repError}>• {e}</Text>
//             ))}
//           </View>
//         ))}

//         {/* Actions */}
//         <View style={styles.actions}>
//           <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
//             <Text style={styles.saveBtnText}>💾  Save to History</Text>
//           </TouchableOpacity>
//           <TouchableOpacity style={styles.retryBtn} onPress={() => { setPending(null); router.back(); }}>
//             <Text style={styles.retryBtnText}>Try Again</Text>
//           </TouchableOpacity>
//         </View>
//       </ScrollView>
//     </View>
//   );
// }

// function StatLine({ label, value }: { label: string; value: string }) {
//   return (
//     <View style={{ marginBottom: Space.xs }}>
//       <Text style={{ color: Colors.textMuted, fontSize: Font.sizes.xs }}>{label}</Text>
//       <Text style={{ color: Colors.text, fontSize: Font.sizes.md, fontWeight: Font.weight.semi, textTransform: 'capitalize' }}>
//         {value}
//       </Text>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   root:   { flex: 1, backgroundColor: Colors.bg },
//   center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
//   noData: { color: Colors.textMuted, fontSize: Font.sizes.md, marginBottom: Space.md },
//   scroll: { paddingTop: 110, paddingBottom: 80, paddingHorizontal: Space.md },

//   heroRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: Space.xl,
//     marginBottom: Space.xl,
//     backgroundColor: Colors.card,
//     borderRadius: Radius.lg,
//     padding: Space.lg,
//   },
//   heroStats: { flex: 1, gap: Space.sm },

//   sectionTitle: {
//     color: Colors.text,
//     fontSize: Font.sizes.lg,
//     fontWeight: Font.weight.bold,
//     marginBottom: Space.sm,
//     marginTop: Space.md,
//   },

//   repCard: {
//     backgroundColor: Colors.card,
//     borderRadius: Radius.md,
//     padding: Space.md,
//     marginBottom: Space.sm,
//     borderWidth: 1,
//     borderColor: Colors.border,
//   },
//   repHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Space.xs },
//   repTitle:  { color: Colors.text, fontWeight: Font.weight.semi, fontSize: Font.sizes.md },
//   repScore:  { fontWeight: Font.weight.bold, fontSize: Font.sizes.md },
//   repError:  { color: Colors.textMuted, fontSize: Font.sizes.sm },

//   actions:     { gap: Space.sm, marginTop: Space.xl },
//   saveBtn:     { backgroundColor: Colors.text, borderRadius: Radius.md, padding: Space.md, alignItems: 'center' },
//   saveBtnText: { color: Colors.bg, fontWeight: Font.weight.bold, fontSize: Font.sizes.md },
//   retryBtn:    { backgroundColor: Colors.card, borderRadius: Radius.md, padding: Space.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
//   retryBtnText:{ color: Colors.text, fontWeight: Font.weight.medium, fontSize: Font.sizes.md },
// });




// part2

import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Dimensions, ActivityIndicator,
} from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText, Path, Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { Colors, Font, Radius, Space } from '../constants/theme';
import { useSessionStore } from '../store/useSessionStore';
import ScoreRing from '../components/feedback/ScoreRing';
import FeedbackCard from '../components/feedback/FeedbackCard';
import SnapHeader from '../components/ui/SnapHeader';
import type { WorkoutSession, RepResult } from '../types';

const { width: W } = Dimensions.get('window');
const CHART_W = W - Space.md * 2;
const CHART_H = 160;

// ── Rep score bar chart ───────────────────────────────────────────────────────
function RepScoreChart({ reps }: { reps: RepResult[] }) {
  if (!reps.length) return null;
  const barW    = Math.min(36, (CHART_W - 32) / reps.length - 6);
  const totalW  = reps.length * (barW + 6);
  const svgW    = Math.max(CHART_W, totalW + 32);

  return (
    <View style={styles.chartBox}>
      <Text style={styles.chartTitle}>Rep Score Breakdown</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={svgW} height={CHART_H + 40}>
          {/* Grid lines */}
          {[25, 50, 75, 100].map(v => {
            const y = CHART_H - (v / 100) * CHART_H + 10;
            return (
              <React.Fragment key={v}>
                <Line x1={16} y1={y} x2={svgW - 16} y2={y} stroke={Colors.border} strokeWidth={0.5} strokeDasharray="4,4" />
                <SvgText x={8} y={y + 4} fontSize={9} fill={Colors.textMuted} textAnchor="middle">{v}</SvgText>
              </React.Fragment>
            );
          })}

          {reps.map((rep, i) => {
            const score  = Math.round(rep.avg_score);
            const barH   = Math.max(4, (score / 100) * CHART_H);
            const x      = 24 + i * (barW + 6);
            const y      = CHART_H - barH + 10;
            const color  = score >= 80 ? Colors.accent : score >= 60 ? Colors.warn : Colors.danger;
            return (
              <React.Fragment key={rep.rep_number}>
                <Rect x={x} y={y} width={barW} height={barH} rx={4} fill={color} opacity={0.85} />
                <SvgText x={x + barW / 2} y={CHART_H + 24} fontSize={10} fill={Colors.textMuted} textAnchor="middle">
                  R{rep.rep_number}
                </SvgText>
                <SvgText x={x + barW / 2} y={y - 4} fontSize={9} fill={color} textAnchor="middle">
                  {score}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}

// ── Score trend line chart ────────────────────────────────────────────────────
function ScoreTrendChart({ reps }: { reps: RepResult[] }) {
  if (reps.length < 2) return null;
  const pad = 20;
  const w   = CHART_W - pad * 2;
  const h   = 80;

  const scores  = reps.map(r => r.avg_score);
  const minS    = Math.min(...scores);
  const maxS    = Math.max(...scores);
  const range   = Math.max(maxS - minS, 10);

  const points  = reps.map((r, i) => {
    const x = pad + (i / (reps.length - 1)) * w;
    const y = pad + h - ((r.avg_score - minS) / range) * h;
    return { x, y, score: Math.round(r.avg_score) };
  });

  const polyPoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const trend      = scores[scores.length - 1] - scores[0];

  return (
    <View style={styles.chartBox}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Space.sm }}>
        <Text style={styles.chartTitle}>Score Trend</Text>
        <Text style={[styles.trendBadge, {
          color: trend >= 0 ? Colors.accent : Colors.danger,
          backgroundColor: trend >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
        }]}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(Math.round(trend))}% {trend >= 0 ? 'improving' : 'declining'}
        </Text>
      </View>
      <Svg width={CHART_W} height={h + pad * 2}>
        {/* Area fill */}
        <Path
          d={`M ${points[0].x} ${h + pad} ${points.map(p => `L ${p.x} ${p.y}`).join(' ')} L ${points[points.length - 1].x} ${h + pad} Z`}
          fill={Colors.accent}
          opacity={0.08}
        />
        {/* Line */}
        <Polyline points={polyPoints} fill="none" stroke={Colors.accent} strokeWidth={2} strokeLinejoin="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <React.Fragment key={i}>
            <Circle cx={p.x} cy={p.y} r={4} fill={Colors.accent} />
            <Circle cx={p.x} cy={p.y} r={2} fill={Colors.bg} />
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

// ── Ideal vs Actual pose comparison ─────────────────────────────────────────
// Stick figure based on key joint positions
// Ideal = textbook form, Actual = derived from worst angles in analysis

interface StickFigureProps {
  label: string;
  color: string;
  kneeAngle?: number;
  hipAngle?: number;
  elbowAngle?: number;
}

function StickFigure({
  label,
  color,
  kneeAngle = 170,
  hipAngle = 170,
  elbowAngle = 90,
}: StickFigureProps) {
  const cx = 60;

  // ----------------------------
  // Calculate body positions
  // ----------------------------
  const head = { x: cx, y: 20 };

  // Shoulders
  const lShoulder = { x: cx - 18, y: 40 };
  const rShoulder = { x: cx + 18, y: 40 };

  // Hip bend logic
  const hipBend = Math.max(
    0,
    Math.min(30, (180 - hipAngle) * 0.5)
  );

  const lHip = {
    x: cx - 12,
    y: 80 + hipBend,
  };

  const rHip = {
    x: cx + 12,
    y: 80 + hipBend,
  };

  // Knee bend logic
  const kneeBend = Math.max(
    0,
    Math.min(40, (180 - kneeAngle) * 0.4)
  );

  const lKnee = {
    x: cx - 12 - kneeBend * 0.3,
    y: 110 + kneeBend * 0.5,
  };

  const rKnee = {
    x: cx + 12 + kneeBend * 0.3,
    y: 110 + kneeBend * 0.5,
  };

  // Ankles
  const lAnkle = { x: cx - 12, y: 145 };
  const rAnkle = { x: cx + 12, y: 145 };

  // Elbow bend logic
  const elbowBend = Math.max(
    0,
    Math.min(30, (180 - elbowAngle) * 0.3)
  );

  const lElbow = {
    x: cx - 28 - elbowBend,
    y: 55 + elbowBend,
  };

  const rElbow = {
    x: cx + 28 + elbowBend,
    y: 55 + elbowBend,
  };

  // Wrists
  const lWrist = { x: cx - 24, y: 72 };
  const rWrist = { x: cx + 24, y: 72 };

  // ----------------------------
  // SVG helpers
  // ----------------------------
  const renderJoint = (
    point: { x: number; y: number },
    key: string,
    radius = 3
  ) => (
    <Circle
      key={key}
      cx={point.x}
      cy={point.y}
      r={radius}
      fill={color}
      opacity={0.9}
    />
  );

  const renderLimb = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    key: string
  ) => (
    <Line
      key={key}
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
    />
  );

  const limbs = [
    renderLimb(
      { x: cx, y: 30 },
      { x: cx, y: 80 },
      "spine"
    ),

    renderLimb(
      lShoulder,
      rShoulder,
      "shoulders"
    ),

    renderLimb(
      lShoulder,
      lElbow,
      "left-upper-arm"
    ),

    renderLimb(
      lElbow,
      lWrist,
      "left-lower-arm"
    ),

    renderLimb(
      rShoulder,
      rElbow,
      "right-upper-arm"
    ),

    renderLimb(
      rElbow,
      rWrist,
      "right-lower-arm"
    ),

    renderLimb(
      lHip,
      rHip,
      "hips"
    ),

    renderLimb(
      lHip,
      lKnee,
      "left-thigh"
    ),

    renderLimb(
      lKnee,
      lAnkle,
      "left-leg"
    ),

    renderLimb(
      rHip,
      rKnee,
      "right-thigh"
    ),

    renderLimb(
      rKnee,
      rAnkle,
      "right-leg"
    ),
  ];

  const joints = [
    renderJoint(lShoulder, "lShoulder"),
    renderJoint(rShoulder, "rShoulder"),
    renderJoint(lElbow, "lElbow"),
    renderJoint(rElbow, "rElbow"),
    renderJoint(lHip, "lHip"),
    renderJoint(rHip, "rHip"),
    renderJoint(lKnee, "lKnee"),
    renderJoint(rKnee, "rKnee"),
    renderJoint(lAnkle, "lAnkle"),
    renderJoint(rAnkle, "rAnkle"),
  ];

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={120} height={170}>
        {/* Head */}
        <Circle
          cx={head.x}
          cy={head.y}
          r={10}
          stroke={color}
          strokeWidth={2.5}
          fill="transparent"
        />

        {/* Body limbs */}
        {limbs}

        {/* Joints */}
        {joints}
      </Svg>

      {/* Label */}
      <Text
        style={{
          color,
          fontSize: Font.sizes.sm,
          fontWeight: Font.weight.bold,
          marginTop: 6,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function FormComparison({ reps, exercise }: { reps: RepResult[]; exercise: string }) {
  // Find the worst rep for actual form
  const worstRep  = reps.length
    ? reps.reduce((a, b) => a.avg_score < b.avg_score ? a : b)
    : null;

  // Extract angles from worst rep — map angle names to our joints
  const angles    = worstRep?.worst_angles ?? [];
  const getAngle  = (name: string) =>
    angles.find(a => a.name.toLowerCase().includes(name))?.angle;

  const actualKnee  = getAngle('knee')  ?? 170;
  const actualHip   = getAngle('hip')   ?? 170;
  const actualElbow = getAngle('elbow') ?? 90;

  // Ideal angles by exercise type
  const ideals: Record<string, { knee: number; hip: number; elbow: number }> = {
    squat:              { knee: 90,  hip: 90,  elbow: 120 },
    deadlift:           { knee: 140, hip: 70,  elbow: 170 },
    romanian_deadlift:  { knee: 160, hip: 60,  elbow: 170 },
    bench_press:        { knee: 170, hip: 170, elbow: 90  },
    shoulder_press:     { knee: 170, hip: 170, elbow: 90  },
    push_up:            { knee: 170, hip: 170, elbow: 90  },
    pull_up:            { knee: 170, hip: 170, elbow: 90  },
    hip_thrust:         { knee: 90,  hip: 170, elbow: 170 },
  };

  const ideal = ideals[exercise] ?? { knee: 90, hip: 90, elbow: 90 };

  // Score the actual vs ideal
  const kneeErr  = Math.abs(actualKnee  - ideal.knee);
  const hipErr   = Math.abs(actualHip   - ideal.hip);
  const elbowErr = Math.abs(actualElbow - ideal.elbow);

  const hasData = worstRep && angles.length > 0;

  return (
    <View style={styles.chartBox}>
      <Text style={styles.chartTitle}>Form Comparison</Text>
      <Text style={styles.chartSub}>
        {hasData
          ? `Worst rep (Rep ${worstRep.rep_number}) vs ideal ${exercise.replace(/_/g, ' ')} form`
          : `Ideal ${exercise.replace(/_/g, ' ')} form reference`
        }
      </Text>

      <View style={styles.figureRow}>
        <StickFigure
          label="Ideal"
          color={Colors.accent}
          kneeAngle={ideal.knee}
          hipAngle={ideal.hip}
          elbowAngle={ideal.elbow}
        />

        <View style={styles.vsBox}>
          <Text style={styles.vsText}>VS</Text>
          {hasData && (
            <>
              <AngleDiff label="Knee"  diff={kneeErr}  />
              <AngleDiff label="Hip"   diff={hipErr}   />
              <AngleDiff label="Elbow" diff={elbowErr} />
            </>
          )}
        </View>

        <StickFigure
          label={hasData ? 'Your Form' : '---'}
          color={hasData
            ? (worstRep!.avg_score >= 75 ? Colors.accent : worstRep!.avg_score >= 55 ? Colors.warn : Colors.danger)
            : Colors.textMuted
          }
          kneeAngle={hasData ? actualKnee  : ideal.knee}
          hipAngle={hasData  ? actualHip   : ideal.hip}
          elbowAngle={hasData ? actualElbow : ideal.elbow}
        />
      </View>

      {!hasData && (
        <Text style={styles.noAngleNote}>
          Upload a video to see your actual form vs ideal
        </Text>
      )}
    </View>
  );
}

function AngleDiff({ label, diff }: { label: string; diff: number }) {
  const ok    = diff < 15;
  const close = diff < 30;
  const color = ok ? Colors.accent : close ? Colors.warn : Colors.danger;
  return (
    <View style={{ alignItems: 'center', marginVertical: 2 }}>
      <Text style={{ color, fontSize: 9, fontWeight: Font.weight.bold }}>
        {label}: {ok ? '✓' : `${Math.round(diff)}°`}
      </Text>
    </View>
  );
}

// ── Main analysis screen ──────────────────────────────────────────────────────
export default function AnalysisScreen() {
  const { pending, setPending, addSession } = useSessionStore();
  const [saving, setSaving] = useState(false);

  const summary = pending;
  

  if (!summary) {
    
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.textMuted, fontSize: Font.sizes.md }}>No analysis data</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: Colors.accent }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { exercise, total_reps, avg_score, duration_s, reps } = summary;
  const mins = Math.floor(duration_s / 60);
  const secs = Math.round(duration_s % 60);

  const handleSave = async () => {
    setSaving(true);
    const session: WorkoutSession = {
      id:        Date.now().toString(),
      date:      new Date().toISOString(),
      exercise,
      score:     Math.round(avg_score),
      reps:      total_reps,
      duration_s,
      summary:   pending!,
    };
    await addSession(session);
    setPending(null);
    setSaving(false);
    router.replace('/(tabs)/profile');
  };

  // Top errors
  const allErrors    = reps.flatMap(r => r.errors);
  const errorCounts: Record<string, number> = {};
  allErrors.forEach(e => { errorCounts[e] = (errorCounts[e] ?? 0) + 1; });
  const topErrors    = Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 3);

  const scoreColor   = avg_score >= 80 ? Colors.accent : avg_score >= 60 ? Colors.warn : Colors.danger;

  return (
    <View style={styles.root}>
      <SnapHeader title="Session Analysis" showBack />

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Hero */}
        <View style={styles.heroRow}>
          <ScoreRing score={Math.round(avg_score)} size={130} />
          <View style={styles.heroStats}>
            <StatLine label="Exercise" value={exercise.replace(/_/g, ' ')} />
            <StatLine label="Reps"     value={String(total_reps)} />
            <StatLine label="Duration" value={`${mins}m ${secs}s`} />
            <StatLine label="Frames"   value={String(summary.total_frames_analysed)} />
          </View>
        </View>

        {/* Key Feedback */}
        <Text style={styles.sectionTitle}>Key Feedback</Text>
        {avg_score >= 75 && (
          <FeedbackCard type="good" text="Solid overall form" detail={`Avg score ${Math.round(avg_score)}/100`} />
        )}
        {topErrors.map(([err, count], i) => (
          <FeedbackCard
            key={i}
            type={count >= 3 ? 'error' : 'warn'}
            text={err}
            detail={`Occurred in ${count} rep${count > 1 ? 's' : ''}`}
          />
        ))}

        {/* Form comparison — ideal vs actual stick figures */}
        <Text style={styles.sectionTitle}>Form Comparison</Text>
        <FormComparison reps={reps} exercise={exercise} />

        {/* Rep score bar chart */}
        <Text style={styles.sectionTitle}>Rep Analysis</Text>
        <RepScoreChart reps={reps} />

        {/* Score trend */}
        <ScoreTrendChart reps={reps} />

        {/* Rep breakdown list */}
        {reps.map(rep => (
          <View key={rep.rep_number} style={styles.repCard}>
            <View style={styles.repHeader}>
              <Text style={styles.repTitle}>Rep {rep.rep_number}</Text>
              <Text style={[styles.repScore, {
                color: rep.avg_score >= 80 ? Colors.accent : rep.avg_score >= 60 ? Colors.warn : Colors.danger,
              }]}>
                {Math.round(rep.avg_score)}%
              </Text>
            </View>
            {rep.errors.slice(0, 2).map((e, i) => (
              <Text key={i} style={styles.repError}>• {e}</Text>
            ))}
            {rep.worst_angles?.slice(0, 2).map((a, i) => (
              <Text key={i} style={[styles.repAngle, {
                color: a.status === 'good' ? Colors.accent : Colors.warn,
              }]}>
                {a.name}: {Math.round(a.angle)}° — {a.status}
              </Text>
            ))}
          </View>
        ))}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color={Colors.bg} size="small" />
              : <Text style={styles.saveBtnText}>💾  Save to History</Text>
            }
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
  scroll: { paddingTop: 110, paddingBottom: 80, paddingHorizontal: Space.md },

  heroRow: {
    flexDirection: 'row', alignItems: 'center', gap: Space.xl,
    marginBottom: Space.xl, backgroundColor: Colors.card,
    borderRadius: Radius.lg, padding: Space.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  heroStats: { flex: 1, gap: Space.sm },

  sectionTitle: {
    color: Colors.text, fontSize: Font.sizes.lg,
    fontWeight: Font.weight.bold,
    marginBottom: Space.sm, marginTop: Space.lg,
  },

  chartBox: {
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Space.md, marginBottom: Space.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  chartTitle: { color: Colors.text, fontWeight: Font.weight.semi, fontSize: Font.sizes.md, marginBottom: Space.xs },
  chartSub:   { color: Colors.textMuted, fontSize: Font.sizes.xs, marginBottom: Space.md },
  trendBadge: { fontSize: Font.sizes.xs, fontWeight: Font.weight.bold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },

  figureRow:  { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: Space.sm },
  vsBox:      { alignItems: 'center', gap: 2 },
  vsText:     { color: Colors.textMuted, fontWeight: Font.weight.black, fontSize: Font.sizes.lg },
  noAngleNote:{ color: Colors.textMuted, fontSize: Font.sizes.xs, textAlign: 'center', marginTop: Space.sm },

  repCard: {
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Space.md, marginBottom: Space.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  repHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Space.xs },
  repTitle:  { color: Colors.text, fontWeight: Font.weight.semi, fontSize: Font.sizes.md },
  repScore:  { fontWeight: Font.weight.bold, fontSize: Font.sizes.md },
  repError:  { color: Colors.textMuted, fontSize: Font.sizes.sm, marginTop: 2 },
  repAngle:  { fontSize: Font.sizes.xs, marginTop: 2 },

  actions:     { gap: Space.sm, marginTop: Space.xl },
  saveBtn:     { backgroundColor: Colors.accent, borderRadius: Radius.md, padding: Space.md, alignItems: 'center' },
  saveBtnText: { color: Colors.bg, fontWeight: Font.weight.bold, fontSize: Font.sizes.md },
  retryBtn:    { backgroundColor: Colors.card, borderRadius: Radius.md, padding: Space.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  retryBtnText:{ color: Colors.text, fontWeight: Font.weight.medium, fontSize: Font.sizes.md },
});