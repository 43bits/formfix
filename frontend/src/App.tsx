// /* eslint-disable @typescript-eslint/no-explicit-any */
// import { useCallback, useEffect, useRef, useState } from "react";
// import { Camera } from "./components/Camera";
// import { VideoUpload } from "./components/VideoUpload";
// import { FeedbackOverlay } from "./components/FeedbackOverlay";
// import { useWorkoutStream } from "./hooks/useWebSocket";
// import type { Exercise } from "./types";

// import { SportSelector } from "./components/SportSelector";
// import { EmotionOverlay } from "./components/EmotionOverlay";
// import { MoodDashboard } from "./components/MoodDashboard";
// import { useEmotionStream } from "./hooks/useEmotionStream";




// // eslint-disable-next-line @typescript-eslint/no-unused-vars
// const EXERCISES: Exercise[] = ["squat", "deadlift", "bench_press", "unknown"];

// function LiveTab() {
//   const [exercise, setExercise] = useState<string>("unknown");
//   const [activePanel, setActivePanel] = useState<"form" | "emotion" | "mood">("form");
//   const canvasRef = useRef<HTMLCanvasElement | null>(null);

//   const { feedback } = useWorkoutStream(exercise, (detected) => {
//     // Only auto-switch if still in auto mode
//     setExercise((prev) => prev === "unknown" ? detected : prev);
//   });

//   const { emotion, sendFrame: sendEmotion } = useEmotionStream();

//   const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
//     canvasRef.current = canvas;
//   }, []);

//   // Emotion frame pump — 2fps
//   useEffect(() => {
//     const interval = setInterval(() => {
//       if (canvasRef.current && feedback) {
//         sendEmotion(canvasRef.current, feedback.score, feedback.rep_count, exercise);
//       }
//     }, 500);
//     return () => clearInterval(interval);
//   }, [feedback, exercise, sendEmotion]);

//   return (
//     <div>
//       <SportSelector selected={exercise} onSelect={setExercise} />
//       <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
//         <Camera
//           exercise={exercise}
//           onAutoDetect={(ex) => setExercise(ex)}
//           onCanvasReady={handleCanvasReady}
//         />
//         <div style={{ flex: 1, minWidth: 280 }}>
//           <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
//             {(["form", "emotion", "mood"] as const).map((p) => (
//               <button key={p} onClick={() => setActivePanel(p)}
//                 style={{
//                   padding: "5px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
//                   border: "1px solid var(--color-border-secondary)",
//                   background: activePanel === p ? "var(--color-text-primary)" : "transparent",
//                   color: activePanel === p ? "var(--color-background-primary)" : "var(--color-text-primary)",
//                 }}>
//                 {p === "form" ? "Form" : p === "emotion" ? "Mood" : "Analysis"}
//               </button>
//             ))}
//           </div>
//           {activePanel === "form"    && <FeedbackOverlay feedback={feedback} />}
//           {activePanel === "emotion" && <EmotionOverlay data={emotion} />}
//           {activePanel === "mood"    && <MoodDashboard />}
//         </div>
//       </div>
//     </div>
//   );
// }

// export default function App() {
//   const [tab, setTab] = useState<"live" | "upload">("live");

//   return (
//     <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
//       <div style={{ marginBottom: 24 }}>
//         <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>FitAI</h1>
//         <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 16 }}>
//           Real-time form correction & injury prevention
//         </p>
//         <div style={{ display: "flex", gap: 4 }}>
//           {(["live", "upload"] as const).map((t) => (
//             <button key={t} onClick={() => setTab(t)}
//               style={{
//                 padding: "8px 20px", borderRadius: 8, fontSize: 14, cursor: "pointer",
//                 border: "1px solid var(--color-border-secondary)",
//                 background: tab === t ? "var(--color-text-primary)" : "transparent",
//                 color: tab === t ? "var(--color-background-primary)" : "var(--color-text-primary)",
//               }}>
//               {t === "live" ? "Live camera" : "Upload video"}
//             </button>
//           ))}
//         </div>
//       </div>

//       {tab === "live" ? <LiveTab /> : <VideoUpload />}
//     </div>
//   );
// }


import { useState, useRef, useEffect, useCallback } from "react";
import { Camera } from "./components/Camera";
import { VideoUpload } from "./components/VideoUpload";
import { FeedbackOverlay } from "./components/FeedbackOverlay";
import { SportSelector } from "./components/SportSelector";
import { EmotionOverlay } from "./components/EmotionOverlay";
import { MoodDashboard } from "./components/MoodDashboard";
import { useWorkoutStream } from "./hooks/useWebSocket";
import { useEmotionStream } from "./hooks/useEmotionStream";

type Tab = "live" | "upload";
type Panel = "form" | "emotion" | "mood";

function LiveTab() {
  const [exercise, setExercise] = useState("unknown");
  const [panel, setPanel]       = useState<Panel>("form");
  const canvasRef               = useRef<HTMLCanvasElement | null>(null);

  const { feedback } = useWorkoutStream(exercise, (detected) => {
    setExercise((prev) => prev === "unknown" ? detected : prev);
  });

  const { emotion, sendFrame: sendEmotion } = useEmotionStream();

  const handleCanvasReady = useCallback((c: HTMLCanvasElement) => {
    canvasRef.current = c;
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (canvasRef.current && feedback) {
        sendEmotion(canvasRef.current, feedback.score, feedback.rep_count, exercise);
      }
    }, 500);
    return () => clearInterval(id);
  }, [feedback, exercise, sendEmotion]);

  return (
    <div>
      <SportSelector selected={exercise} onSelect={setExercise} />
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Camera
          exercise={exercise}
          onAutoDetect={(ex) => setExercise(ex)}
          onCanvasReady={handleCanvasReady}
        />
        <div style={{ flex: 1, minWidth: 280 }}>
          {/* Panel tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {(["form", "emotion", "mood"] as Panel[]).map((p) => (
              <button key={p} onClick={() => setPanel(p)}
                style={{
                  padding: "6px 16px", borderRadius: 20, fontSize: 12,
                  cursor: "pointer", border: "1px solid var(--color-border-secondary)",
                  background: panel === p ? "var(--color-text-primary)" : "transparent",
                  color: panel === p ? "var(--color-background-primary)" : "var(--color-text-primary)",
                  textTransform: "capitalize",
                }}>
                {p === "form" ? "Form" : p === "emotion" ? "Mood" : "Analysis"}
              </button>
            ))}
          </div>
          {panel === "form"    && <FeedbackOverlay feedback={feedback} />}
          {panel === "emotion" && <EmotionOverlay data={emotion} />}
          {panel === "mood"    && <MoodDashboard />}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("live");

  return (
    <div style={{
      maxWidth: 1120, margin: "0 auto", padding: "20px 16px",
      fontFamily: "system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Formfix</h1>
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            Real-time form correction · injury prevention
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {(["live", "upload"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: "8px 20px", borderRadius: 10, fontSize: 14,
                cursor: "pointer",
                border: "1px solid var(--color-border-secondary)",
                background: tab === t ? "var(--color-text-primary)" : "transparent",
                color: tab === t ? "var(--color-background-primary)" : "var(--color-text-primary)",
                fontWeight: tab === t ? 500 : 400,
              }}>
              {t === "live" ? "Live camera" : "Upload video"}
            </button>
          ))}
        </div>
      </div>

      {tab === "live"   ? <LiveTab /> : <VideoUpload />}
    </div>
  );
}