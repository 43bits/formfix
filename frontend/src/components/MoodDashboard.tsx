import { useEffect, useState } from "react";

interface TimelinePoint { t: number; valence: number; form: number; emotion: string }
interface SessionData {
  status: string;
  duration_s: number;
  mood_form_correlation: number;
  correlation_label: string;
  mood_trend: string;
  emotion_performance: Record<string, { avg_form_score: number; sample_count: number }>;
  insight: string;
  timeline: TimelinePoint[];
  best_mood_moment: { emotion: string; form_score: number; timestamp: number };
  worst_mood_moment: { emotion: string; form_score: number; timestamp: number };
}

const TREND_ICON: Record<string, string> = {
  improving: "↗", declining: "↘", stable: "→"
};

export function MoodDashboard() {
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/emotion/session-analysis");
      const d = await res.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  };

  const resetSession = async () => {
    await fetch("http://localhost:8000/api/emotion/session-reset", { method: "POST" });
    setData(null);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchAnalysis(); }, []);

  if (loading) return <div style={{ padding: 16, color: "var(--color-text-secondary)" }}>Loading analysis…</div>;
  if (!data || data.status === "insufficient_data")
    return (
      <div style={{ padding: 16, color: "var(--color-text-secondary)", fontSize: 14 }}>
        Start a session to see mood × performance analysis.
        <button onClick={fetchAnalysis} style={{ marginLeft: 12, fontSize: 12,
          padding: "4px 10px", borderRadius: 6, cursor: "pointer",
          border: "1px solid var(--color-border-secondary)",
          background: "transparent", color: "var(--color-text-primary)" }}>
          Refresh
        </button>
      </div>
    );

  const maxT = Math.max(...data.timeline.map((p) => p.t), 1);

  return (
    <div style={{ padding: 16, maxWidth: 700 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 4 }}>Session mood analysis</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            {data.duration_s}s · {TREND_ICON[data.mood_trend]} {data.mood_trend} mood
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={fetchAnalysis} style={{ fontSize: 12, padding: "5px 12px",
            borderRadius: 6, cursor: "pointer", border: "1px solid var(--color-border-secondary)",
            background: "transparent", color: "var(--color-text-primary)" }}>Refresh</button>
          <button onClick={resetSession} style={{ fontSize: 12, padding: "5px 12px",
            borderRadius: 6, cursor: "pointer", border: "1px solid var(--color-border-secondary)",
            background: "transparent", color: "#dc2626" }}>Reset</button>
        </div>
      </div>

      {/* Insight */}
      <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 20, fontSize: 13,
        background: "var(--color-background-secondary)",
        borderLeft: "3px solid #818cf8" }}>
        {data.insight}
      </div>

      {/* Timeline chart (pure CSS/SVG) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Mood & form over session</div>
        <svg width="100%" viewBox={`0 0 600 100`} style={{ overflow: "visible" }}>
          {/* Valence line */}
          <polyline
            fill="none" stroke="#818cf8" strokeWidth="1.5"
            points={data.timeline.map((p) =>
              `${(p.t / maxT) * 580 + 10},${50 - p.valence * 40}`
            ).join(" ")}
          />
          {/* Form score line */}
          <polyline
            fill="none" stroke="#4ade80" strokeWidth="1.5" strokeDasharray="4 2"
            points={data.timeline.map((p) =>
              `${(p.t / maxT) * 580 + 10},${90 - (p.form / 100) * 80}`
            ).join(" ")}
          />
          {/* Zero line */}
          <line x1="10" y1="50" x2="590" y2="50" stroke="var(--color-border-tertiary)" strokeWidth="0.5" strokeDasharray="2 3"/>
        </svg>
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--color-text-secondary)" }}>
          <span><span style={{ color: "#818cf8" }}>—</span> Mood valence</span>
          <span><span style={{ color: "#4ade80" }}>– –</span> Form score</span>
        </div>
      </div>

      {/* Correlation */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 140, padding: "12px 16px", borderRadius: 10,
          background: "var(--color-background-secondary)" }}>
          <div style={{ fontSize: 24, fontWeight: 500 }}>
            {data.mood_form_correlation >= 0 ? "+" : ""}{data.mood_form_correlation.toFixed(2)}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Mood-form correlation</div>
          <div style={{ fontSize: 11, marginTop: 4, color: "var(--color-text-secondary)" }}>
            {data.correlation_label}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 140, padding: "12px 16px", borderRadius: 10,
          background: "var(--color-background-secondary)" }}>
          <div style={{ fontSize: 18, fontWeight: 500, textTransform: "capitalize" }}>
            {data.best_mood_moment.emotion} 😄
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Best mood</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            Form score: {data.best_mood_moment.form_score} at {data.best_mood_moment.timestamp}s
          </div>
        </div>
      </div>

      {/* Per-emotion performance */}
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Form score by emotion</div>
      {Object.entries(data.emotion_performance)
        .sort(([, a], [, b]) => b.avg_form_score - a.avg_form_score)
        .map(([em, stats]) => (
          <div key={em} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ width: 80, fontSize: 12, textTransform: "capitalize" }}>{em}</span>
            <div style={{ flex: 1, height: 8, background: "var(--color-border-tertiary)", borderRadius: 4 }}>
              <div style={{ width: `${stats.avg_form_score}%`, height: "100%", borderRadius: 4,
                background: stats.avg_form_score >= 75 ? "#4ade80" :
                            stats.avg_form_score >= 50 ? "#fbbf24" : "#f87171" }} />
            </div>
            <span style={{ fontSize: 12, width: 36, textAlign: "right" }}>{stats.avg_form_score}</span>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)", width: 50 }}>
              n={stats.sample_count}
            </span>
          </div>
        ))
      }
    </div>
  );
}