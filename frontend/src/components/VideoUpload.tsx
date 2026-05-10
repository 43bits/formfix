import { useRef, useState, useEffect } from "react";
import { useVideoAnalysis } from "../hooks/useVideoAnalysis";
import { RepTimeline } from "./RepTimeline";

interface Sport { key: string; label: string }

export function VideoUpload() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dropRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile]         = useState<File | null>(null);
  const [exercise, setExercise] = useState("unknown");
  const [preview, setPreview]   = useState<string | null>(null);
  const [sports, setSports]     = useState<Sport[]>([]);

  const { analyse, autoDetect, loading, progress, result, error } = useVideoAnalysis();

  // Load sport list from backend
  useEffect(() => {
    fetch("http://localhost:8000/api/sports/")
      .then((r) => r.json())
      .then((d: Sport[]) => setSports(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(url);
    autoDetect(file).then((ex) => { if (ex && ex !== "unknown") setExercise(ex); });
    return () => URL.revokeObjectURL(url);
  }, [file, autoDetect]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("video/")) { setFile(f); }
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>

      {/* Drop zone */}
      {!file ? (
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          style={{
            border: "2px dashed var(--color-border-secondary)",
            borderRadius: 14, padding: "48px 24px",
            textAlign: "center", cursor: "pointer",
            marginBottom: 20,
            transition: "border-color 0.2s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = "var(--color-border-primary)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = "var(--color-border-secondary)")
          }
        >
          <input ref={inputRef} type="file" accept="video/*"
            style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎬</div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>Drop a workout video here</div>
          <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            or click to browse · MP4, MOV, AVI · up to 500 MB
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {/* Preview + controls row */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <video src={preview ?? ""} controls muted
              style={{
                flex: "0 0 auto", width: 320, height: 200,
                borderRadius: 10, background: "#111", objectFit: "contain",
              }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontWeight: 500 }}>{file.name}</div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                {(file.size / 1e6).toFixed(1)} MB
              </div>

              {/* Exercise selector */}
              <select
                value={exercise}
                onChange={(e) => setExercise(e.target.value)}
                style={{
                  padding: "8px 12px", borderRadius: 8, fontSize: 13,
                  border: "1px solid var(--color-border-secondary)",
                  background: "var(--color-background-secondary)",
                  color: "var(--color-text-primary)",
                }}
              >
                <option value="unknown">Auto-detect exercise</option>
                {sports.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => analyse(file, exercise)}
                  disabled={loading}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 14,
                    fontWeight: 500, cursor: loading ? "default" : "pointer",
                    border: "none",
                    background: loading
                      ? "var(--color-border-secondary)"
                      : "var(--color-text-primary)",
                    color: loading
                      ? "var(--color-text-secondary)"
                      : "var(--color-background-primary)",
                  }}
                >
                  {loading ? "Analysing…" : "Analyse video"}
                </button>
                <button
                  onClick={() => { setFile(null); setPreview(null); }}
                  disabled={loading}
                  style={{
                    padding: "10px 14px", borderRadius: 8, fontSize: 14,
                    cursor: "pointer", border: "1px solid var(--color-border-secondary)",
                    background: "transparent", color: "var(--color-text-primary)",
                  }}
                >
                  Change
                </button>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {loading && (
            <div style={{ height: 6, background: "var(--color-border-tertiary)",
              borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                width: `${progress}%`, height: "100%",
                background: "var(--color-text-info)",
                borderRadius: 3, transition: "width 0.5s ease",
              }} />
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: "10px 14px", background: "#fee2e2", color: "#991b1b",
          borderRadius: 8, marginBottom: 16, fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && !loading && <RepTimeline result={result} />}
    </div>
  );
}