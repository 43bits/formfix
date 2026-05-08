import { useRef, useState, useEffect } from "react";
import { useVideoAnalysis } from "../hooks/useVideoAnalysis";
import { RepTimeline } from "./RepTimeline";

const EXERCISES = ["unknown", "squat", "deadlift", "bench_press"];

export function VideoUpload() {
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [exercise, setExercise] = useState("unknown");
  const [preview, setPreview] = useState<string | null>(null);
  const { analyse, autoDetect, loading, progress, result, error } = useVideoAnalysis();

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(url);
    // Auto-detect exercise from first frame
    autoDetect(file).then((ex) => { if (ex !== "unknown") setExercise(ex); });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("video/")) setFile(f);
  };

  const onSubmit = () => {
    if (file) analyse(file, exercise);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      {/* Drop zone */}
      <div
        ref={dropRef}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        style={{
          border: "2px dashed var(--color-border-secondary)",
          borderRadius: 12, padding: "32px 24px",
          textAlign: "center", cursor: "pointer",
          background: file ? "var(--color-background-secondary)" : "transparent",
          marginBottom: 20,
        }}
      >
        <input ref={inputRef} type="file" accept="video/*" style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
        {file
          ? <span style={{ fontWeight: 500 }}>{file.name} ({(file.size / 1e6).toFixed(1)} MB)</span>
          : <span style={{ color: "var(--color-text-secondary)" }}>Drop a workout video or click to browse</span>
        }
      </div>

      {preview && (
        <video src={preview} controls muted
          style={{ width: "100%", borderRadius: 10, marginBottom: 20, maxHeight: 320, objectFit: "contain" }} />
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <select
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, fontSize: 14,
            border: "1px solid var(--color-border-secondary)",
            background: "var(--color-background-secondary)",
            color: "var(--color-text-primary)" }}
        >
          {EXERCISES.map((ex) => (
            <option key={ex} value={ex}>{ex === "unknown" ? "Auto-detect" : ex.replace("_", " ")}</option>
          ))}
        </select>

        <button
          onClick={onSubmit}
          disabled={!file || loading}
          style={{
            padding: "8px 24px", borderRadius: 8, fontSize: 14, fontWeight: 500,
            background: loading ? "var(--color-border-secondary)" : "var(--color-text-primary)",
            color: loading ? "var(--color-text-secondary)" : "var(--color-background-primary)",
            border: "none", cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Analysing…" : "Analyse"}
        </button>

        {loading && (
          <div style={{ flex: 1, height: 6, background: "var(--color-border-tertiary)", borderRadius: 3 }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "#4ade80",
              borderRadius: 3, transition: "width 0.4s ease" }} />
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#991b1b",
          borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {result && <RepTimeline result={result} />}
    </div>
  );
}