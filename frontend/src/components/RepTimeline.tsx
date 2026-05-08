import { useState } from "react";
import type { AnalysisSummary, RepResult } from "../hooks/useVideoAnalysis";

interface Props { result: AnalysisSummary }

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "#16a34a" : score >= 55 ? "#d97706" : "#dc2626";
  const bg    = score >= 80 ? "#dcfce7" : score >= 55 ? "#fef9c3" : "#fee2e2";
  return (
    <span style={{ background: bg, color, padding: "2px 8px",
      borderRadius: 20, fontSize: 12, fontWeight: 500 }}>
      {Math.round(score)}
    </span>
  );
}

function RepCard({ rep, active, onClick }: { rep: RepResult; active: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      padding: 14, borderRadius: 10, cursor: "pointer",
      border: `1.5px solid ${active ? "var(--color-border-primary)" : "var(--color-border-tertiary)"}`,
      background: active ? "var(--color-background-secondary)" : "transparent",
      marginBottom: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontWeight: 500, fontSize: 14 }}>Rep {rep.rep_number}</span>
        <ScoreBadge score={rep.avg_score} />
      </div>
      {rep.errors.length === 0
        ? <div style={{ fontSize: 12, color: "#16a34a" }}>✓ Clean rep</div>
        : rep.errors.map((e, i) => (
          <div key={i} style={{ fontSize: 12, color: "#dc2626", marginTop: 2 }}>✕ {e}</div>
        ))
      }
    </div>
  );
}

export function RepTimeline({ result }: Props) {
  const [activeRep, setActiveRep] = useState<RepResult | null>(
    result.reps.length > 0 ? result.reps[0] : null
  );
  const [activeThumb, setActiveThumb] = useState(0);

  const thumbsForRep = activeRep
    ? result.thumbnails.filter((t) => t.rep_number === activeRep.rep_number || t.rep_number === null)
    : result.thumbnails;

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: "flex", gap: 24, padding: "14px 0", marginBottom: 20,
        borderBottom: "1px solid var(--color-border-tertiary)" }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 500 }}>{result.total_reps}</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Total reps</div>
        </div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 500 }}>{result.avg_score}</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Avg score</div>
        </div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 500 }}>{result.duration_s}s</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Duration</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, textTransform: "capitalize" }}>
            {result.exercise.replace("_", " ")}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Exercise</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        {/* Rep list */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10,
            color: "var(--color-text-secondary)" }}>Reps</div>
          {result.reps.length === 0
            ? <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>No reps detected</div>
            : result.reps.map((r) => (
              <RepCard key={r.rep_number} rep={r}
                active={activeRep?.rep_number === r.rep_number}
                onClick={() => setActiveRep(r)} />
            ))
          }
        </div>

        {/* Detail panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeRep && (
            <>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10,
                color: "var(--color-text-secondary)" }}>
                Rep {activeRep.rep_number} · joint angles at worst point
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {activeRep.worst_angles.map((a) => (
                  <div key={a.name} style={{
                    padding: "6px 12px", borderRadius: 8, fontSize: 13,
                    background: a.status === "good" ? "#dcfce7" : a.status === "warning" ? "#fef9c3" : "#fee2e2",
                    color: a.status === "good" ? "#15803d" : a.status === "warning" ? "#92400e" : "#991b1b",
                  }}>
                    {a.name.replace(/_/g, " ")}: {a.angle}°
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Thumbnail strip */}
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10,
            color: "var(--color-text-secondary)" }}>Frames</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {thumbsForRep.slice(0, 12).map((t, i) => (
              <div key={i} onClick={() => setActiveThumb(i)} style={{ cursor: "pointer", position: "relative" }}>
                <img
                  src={`data:image/jpeg;base64,${t.frame_b64}`}
                  alt={`frame at ${t.timestamp_s}s`}
                  style={{ width: 110, height: 70, objectFit: "cover", borderRadius: 6,
                    border: `2px solid ${activeThumb === i ? "var(--color-border-primary)" : "transparent"}` }}
                />
                <div style={{ position: "absolute", bottom: 4, left: 4, fontSize: 10,
                  background: "rgba(0,0,0,0.6)", color: "#fff", padding: "1px 4px", borderRadius: 3 }}>
                  {t.timestamp_s}s
                </div>
                <ScoreBadge score={t.score} />
              </div>
            ))}
          </div>

          {/* Enlarged selected frame */}
          {thumbsForRep[activeThumb] && (
            <img
              src={`data:image/jpeg;base64,${thumbsForRep[activeThumb].frame_b64}`}
              alt="selected frame"
              style={{ width: "100%", borderRadius: 10, marginTop: 14,
                maxHeight: 360, objectFit: "contain" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}