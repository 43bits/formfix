import type { FormFeedback } from "../types";

function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? "#4ade80" : score >= 50 ? "#fbbf24" : "#f87171";
  const r = 28, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={72} height={72} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={36} cy={36} r={r} fill="none"
        stroke="var(--color-border-tertiary)" strokeWidth={5} />
      <circle cx={36} cy={36} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.4s" }} />
      <text x={36} y={36} textAnchor="middle" dominantBaseline="central"
        style={{ fill: color, fontSize: 15, fontWeight: 600,
          transform: "rotate(90deg)", transformOrigin: "36px 36px" }}>
        {Math.round(score)}
      </text>
    </svg>
  );
}

function AngleRow({ name, angle, status, min, max }: {
  name: string; angle: number; status: string; min: number; max: number
}) {
  const pct = Math.min(100, Math.max(0, ((angle - min) / Math.max(max - min, 1)) * 100));
  const color = status === "good" ? "#4ade80" : status === "warning" ? "#fbbf24" : "#f87171";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between",
        fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: "var(--color-text-secondary)" }}>
          {name.replace(/_/g, " ")}
        </span>
        <span style={{ color, fontWeight: 500 }}>{angle}°
          <span style={{ color: "var(--color-text-secondary)", fontWeight: 400 }}>
            {" "}({min}–{max})
          </span>
        </span>
      </div>
      <div style={{ position: "relative", height: 6,
        background: "var(--color-border-tertiary)", borderRadius: 3 }}>
        {/* target zone highlight */}
        <div style={{
          position: "absolute", left: 0, right: 0, height: "100%",
          background: "rgba(74,222,128,0.12)", borderRadius: 3,
        }} />
        {/* dot */}
        <div style={{
          position: "absolute", width: 10, height: 10,
          top: -2, left: `calc(${pct}% - 5px)`,
          background: color, borderRadius: "50%", border: "2px solid #fff",
          transition: "left 0.25s",
          boxShadow: `0 0 6px ${color}66`,
        }} />
      </div>
    </div>
  );
}

interface Props {
  feedback: FormFeedback | null;
  qualityScore?: number;
}

export function FeedbackOverlay({ feedback, qualityScore }: Props) {
  if (!feedback) {
    return (
      <div style={{
        padding: 24, borderRadius: 12, minWidth: 280,
        background: "var(--color-background-secondary)",
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 10, color: "var(--color-text-secondary)",
      }}>
        <span style={{ fontSize: 32 }}>🏋️</span>
        <div style={{ fontSize: 14 }}>Start moving to see feedback</div>
        <div style={{ fontSize: 12 }}>Select an exercise above or use Auto-detect</div>
      </div>
    );
  }

  const { errors, warnings, joint_angles, phase, score, exercise, rep_count } = feedback;

  return (
    <div style={{ padding: 16, borderRadius: 12, minWidth: 280,
      background: "var(--color-background-secondary)" }}>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <ScoreRing score={score} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: 15, textTransform: "capitalize",
            marginBottom: 2 }}>
            {exercise.replace(/_/g, " ")}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            Phase: <strong>{phase}</strong>
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            Reps: <strong>{rep_count}</strong>
          </div>
        </div>
      </div>

      {/* Model quality badge (shown when trained model is loaded) */}
      {qualityScore !== undefined && (
        <div style={{
          padding: "6px 10px", borderRadius: 8, marginBottom: 10, fontSize: 12,
          background: qualityScore > 0.6 ? "#dcfce7" : "#fee2e2",
          color: qualityScore > 0.6 ? "#15803d" : "#991b1b",
        }}>
          AI quality score: {(qualityScore * 100).toFixed(0)}%
        </div>
      )}

      {/* Errors */}
      {errors.map((e, i) => (
        <div key={i} style={{
          background: "#fee2e2", color: "#991b1b",
          padding: "8px 12px", borderRadius: 8, marginBottom: 6,
          fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start",
        }}>
          <span style={{ flexShrink: 0 }}>✕</span>
          <span>{e}</span>
        </div>
      ))}

      {/* Warnings */}
      {warnings.map((w, i) => (
        <div key={i} style={{
          background: "#fef9c3", color: "#854d0e",
          padding: "8px 12px", borderRadius: 8, marginBottom: 6,
          fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start",
        }}>
          <span style={{ flexShrink: 0 }}>⚠</span>
          <span>{w}</span>
        </div>
      ))}

      {errors.length === 0 && warnings.length === 0 && (
        <div style={{
          padding: "8px 12px", borderRadius: 8, marginBottom: 10,
          background: "#dcfce7", color: "#15803d", fontSize: 13,
        }}>
          ✓ Good form — keep it up
        </div>
      )}

      {/* Joint angles */}
      {joint_angles.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12,
          borderTop: "1px solid var(--color-border-tertiary)" }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10,
            color: "var(--color-text-secondary)" }}>
            Joint angles
          </div>
          {joint_angles.map((ja) => (
            <AngleRow key={ja.name} name={ja.name} angle={ja.angle}
              status={ja.status} min={ja.target_min} max={ja.target_max} />
          ))}
        </div>
      )}
    </div>
  );
}