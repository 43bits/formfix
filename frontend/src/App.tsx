import { useState } from "react";
import { Camera } from "./components/Camera";
import { VideoUpload } from "./components/VideoUpload";
import { FeedbackOverlay } from "./components/FeedbackOverlay";
import { useWorkoutStream } from "./hooks/useWebSocket";
import type { Exercise } from "./types";

const EXERCISES: Exercise[] = ["squat", "deadlift", "bench_press", "unknown"];

function LiveTab() {
  const [exercise, setExercise] = useState<Exercise>("unknown");
  const { feedback } = useWorkoutStream(exercise);

  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      <div>
        <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
          {EXERCISES.filter((e) => e !== "unknown").map((ex) => (
            <button key={ex} onClick={() => setExercise(ex)}
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 13,
                border: "1px solid var(--color-border-secondary)", cursor: "pointer",
                background: exercise === ex ? "var(--color-text-primary)" : "transparent",
                color: exercise === ex ? "var(--color-background-primary)" : "var(--color-text-primary)",
              }}>
              {ex.replace("_", " ")}
            </button>
          ))}
          <button onClick={() => setExercise("unknown")}
            style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13,
              border: "1px solid var(--color-border-secondary)", cursor: "pointer",
              background: exercise === "unknown" ? "var(--color-text-primary)" : "transparent",
              color: exercise === "unknown" ? "var(--color-background-primary)" : "var(--color-text-primary)",
            }}>
            Auto
          </button>
        </div>
        <Camera exercise={exercise} />
      </div>
      <div style={{ flex: 1, minWidth: 260 }}>
        <FeedbackOverlay feedback={feedback} />
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<"live" | "upload">("live");

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>FitAI</h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          Real-time form correction & injury prevention
        </p>
        <div style={{ display: "flex", gap: 4 }}>
          {(["live", "upload"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: "8px 20px", borderRadius: 8, fontSize: 14, cursor: "pointer",
                border: "1px solid var(--color-border-secondary)",
                background: tab === t ? "var(--color-text-primary)" : "transparent",
                color: tab === t ? "var(--color-background-primary)" : "var(--color-text-primary)",
              }}>
              {t === "live" ? "Live camera" : "Upload video"}
            </button>
          ))}
        </div>
      </div>

      {tab === "live" ? <LiveTab /> : <VideoUpload />}
    </div>
  );
}