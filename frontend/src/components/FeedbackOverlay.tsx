import type { FormFeedback } from "../types";

export function FeedbackOverlay({ feedback }: { feedback: FormFeedback | null }) {
  if (!feedback) return null;
  const { errors, warnings, joint_angles, phase, score } = feedback;

  return (
    <div style={{ padding: 16, background: "var(--color-background-secondary)",
      borderRadius: 12, minWidth: 280 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontWeight: 500 }}>Phase: {phase}</span>
        <span style={{ fontWeight: 500, color: score > 80 ? "#4ade80" : score > 50 ? "#fbbf24" : "#f87171" }}>
          {Math.round(score)}/100
        </span>
      </div>

      {errors.map((e, i) => (
        <div key={i} style={{ background: "#fee2e2", color: "#991b1b",
          padding: "6px 10px", borderRadius: 6, marginBottom: 6, fontSize: 13 }}>
          ✕ {e}
        </div>
      ))}
      {warnings.map((w, i) => (
        <div key={i} style={{ background: "#fef9c3", color: "#854d0e",
          padding: "6px 10px", borderRadius: 6, marginBottom: 6, fontSize: 13 }}>
          ⚠ {w}
        </div>
      ))}

      <div style={{ marginTop: 10 }}>
        {joint_angles.map((ja) => (
          <div key={ja.name} style={{ display: "flex", justifyContent: "space-between",
            padding: "4px 0", fontSize: 12, borderBottom: "1px solid var(--color-border-tertiary)" }}>
            <span>{ja.name.replace(/_/g, " ")}</span>
            <span style={{ color: ja.status === "good" ? "#16a34a" : ja.status === "warning" ? "#d97706" : "#dc2626" }}>
              {ja.angle}°
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}