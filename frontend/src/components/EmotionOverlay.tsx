import type { EmotionData } from "../hooks/useEmotionStream";

const EMOJI: Record<string, string> = {
  happy: "😄", surprise: "😲", neutral: "😐",
  fear: "😨", sad: "😔", angry: "😠", disgust: "🤢",
};

const VALENCE_COLOR = (v: number) =>
  v >= 0.3 ? "#16a34a" : v >= -0.2 ? "#d97706" : "#dc2626";

interface Props { data: EmotionData | null }

export function EmotionOverlay({ data }: Props) {
  if (!data) return null;

  const sorted = Object.entries(data.scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div style={{ padding: 14, borderRadius: 12,
      background: "var(--color-background-secondary)", minWidth: 240 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 28 }}>{EMOJI[data.dominant] ?? "😐"}</span>
        <div>
          <div style={{ fontWeight: 500, fontSize: 15, textTransform: "capitalize" }}>
            {data.dominant}
          </div>
          <div style={{ fontSize: 12, color: VALENCE_COLOR(data.valence) }}>
            Valence {data.valence >= 0 ? "+" : ""}{data.valence.toFixed(2)}
          </div>
        </div>
        {!data.face_detected && (
          <span style={{ marginLeft: "auto", fontSize: 11,
            color: "var(--color-text-secondary)" }}>no face</span>
        )}
      </div>

      {/* Emotion bars */}
      {sorted.map(([em, score]) => (
        <div key={em} style={{ marginBottom: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between",
            fontSize: 12, marginBottom: 2 }}>
            <span style={{ textTransform: "capitalize" }}>{em}</span>
            <span>{(score * 100).toFixed(0)}%</span>
          </div>
          <div style={{ height: 4, background: "var(--color-border-tertiary)", borderRadius: 2 }}>
            <div style={{ width: `${score * 100}%`, height: "100%", borderRadius: 2,
              background: em === data.dominant ? "#818cf8" : "var(--color-border-secondary)" }} />
          </div>
        </div>
      ))}

      {/* Music recommendation */}
      {data.music && (
        <div style={{ marginTop: 12, padding: "8px 10px", borderRadius: 8,
          background: "var(--color-background-primary)",
          border: "1px solid var(--color-border-tertiary)" }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>
            🎵 {data.music.genre}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
            {data.music.bpm} BPM · {data.music.reason}
          </div>
        </div>
      )}
    </div>
  );
}