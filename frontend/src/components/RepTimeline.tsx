import { useState } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { AnalysisSummary, RepResult } from "../hooks/useVideoAnalysis";

interface Props { result: AnalysisSummary }

function ScorePill({ score }: { score: number }) {
  const bg    = score >= 75 ? "#dcfce7" : score >= 50 ? "#fef9c3" : "#fee2e2";
  const color = score >= 75 ? "#15803d" : score >= 50 ? "#92400e" : "#991b1b";
  return (
    <span style={{ background: bg, color, padding: "2px 8px",
      borderRadius: 20, fontSize: 11, fontWeight: 500 }}>
      {Math.round(score ?? 0)}
    </span>
  );
}

export function RepTimeline({ result }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeThumb, setActiveThumb] = useState(0);

  const reps       = result.reps ?? [];
  const thumbnails = result.thumbnails ?? [];
  const activeRep  = reps[activeIdx] ?? null;

  const thumbsToShow = activeRep
    ? thumbnails.filter(
        (t) => t.rep_number === activeRep.rep_number || t.rep_number == null
      )
    : thumbnails;

  return (
    <div>
      {/* Summary bar */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 20,
        borderRadius: 12, overflow: "hidden",
        border: "1px solid var(--color-border-tertiary)",
      }}>
        {[
          { label: "Exercise",  value: (result.exercise ?? "—").replace(/_/g, " "), cap: true },
          { label: "Reps",      value: result.total_reps ?? 0 },
          { label: "Avg score", value: result.avg_score ?? 0 },
          { label: "Duration",  value: `${result.duration_s ?? 0}s` },
        ].map((item, i) => (
          <div key={i} style={{
            flex: 1, padding: "12px 14px",
            borderRight: i < 3 ? "1px solid var(--color-border-tertiary)" : "none",
            background: "var(--color-background-secondary)",
          }}>
            <div style={{
              fontSize: 18, fontWeight: 500,
              textTransform: item.cap ? "capitalize" : "none",
            }}>
              {item.value}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>

        {/* Left: rep list */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8,
            color: "var(--color-text-secondary)" }}>
            {reps.length > 0 ? `${reps.length} reps detected` : "No reps detected"}
          </div>
          {reps.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)",
              padding: "10px 0" }}>
              Try uploading a clearer video with full-body visibility.
            </div>
          )}
          {reps.map((rep, i) => (
            <div key={rep.rep_number} onClick={() => { setActiveIdx(i); setActiveThumb(0); }}
              style={{
                padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                marginBottom: 6,
                border: `1.5px solid ${activeIdx === i
                  ? "var(--color-border-primary)"
                  : "var(--color-border-tertiary)"}`,
                background: activeIdx === i
                  ? "var(--color-background-secondary)"
                  : "transparent",
              }}>
              <div style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>Rep {rep.rep_number}</span>
                <ScorePill score={rep.avg_score} />
              </div>
              {(rep.errors ?? []).length === 0
                ? <div style={{ fontSize: 11, color: "#16a34a" }}>✓ Clean</div>
                : (rep.errors ?? []).slice(0, 2).map((e, j) => (
                  <div key={j} style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>
                    ✕ {e}
                  </div>
                ))
              }
            </div>
          ))}
        </div>

        {/* Right: detail */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Joint angles for selected rep */}
          {activeRep && (activeRep.worst_angles ?? []).length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8,
                color: "var(--color-text-secondary)" }}>
                Rep {activeRep.rep_number} · worst point angles
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(activeRep.worst_angles ?? []).map((a) => {
                  const bg = a.status === "good" ? "#dcfce7"
                    : a.status === "warning" ? "#fef9c3" : "#fee2e2";
                  const c  = a.status === "good" ? "#15803d"
                    : a.status === "warning" ? "#92400e" : "#991b1b";
                  return (
                    <div key={a.name} style={{
                      padding: "5px 10px", borderRadius: 8,
                      fontSize: 12, background: bg, color: c,
                    }}>
                      {a.name.replace(/_/g, " ")}: {a.angle}°
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Thumbnail strip */}
          {thumbsToShow.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8,
                color: "var(--color-text-secondary)" }}>
                Frames
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {thumbsToShow.slice(0, 12).map((t, i) => (
                  <div key={i} onClick={() => setActiveThumb(i)}
                    style={{ cursor: "pointer", position: "relative", flexShrink: 0 }}>
                    <img
                      src={`data:image/jpeg;base64,${t.frame_b64}`}
                      alt={`frame ${t.timestamp_s}s`}
                      style={{
                        width: 100, height: 64, objectFit: "cover", borderRadius: 6,
                        border: `2px solid ${activeThumb === i
                          ? "var(--color-border-primary)"
                          : "transparent"}`,
                        display: "block",
                      }}
                    />
                    <div style={{
                      position: "absolute", bottom: 3, left: 3,
                      background: "rgba(0,0,0,0.65)", color: "#fff",
                      fontSize: 9, padding: "1px 4px", borderRadius: 3,
                    }}>
                      {t.timestamp_s}s
                    </div>
                    <div style={{ position: "absolute", top: 3, right: 3 }}>
                      <ScorePill score={t.score} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Large selected frame */}
              {thumbsToShow[activeThumb] && (
                <img
                  src={`data:image/jpeg;base64,${thumbsToShow[activeThumb].frame_b64}`}
                  alt="selected frame"
                  style={{
                    width: "100%", borderRadius: 10,
                    maxHeight: 340, objectFit: "contain",
                    background: "#111",
                    display: "block",
                  }}
                />
              )}
            </>
          )}

          {thumbsToShow.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", padding: "20px 0" }}>
              No frames captured — ensure person is fully visible in video.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}