import { useState, useCallback } from "react";

export interface RepResult {
  rep_number: number;
  start_frame: number;
  end_frame: number;
  avg_score: number;
  errors: string[];
  worst_angles: Array<{ name: string; angle: number; status: string }>;
  frame_count: number;
}

export interface AnalysisSummary {
  exercise: string;
  total_reps: number;
  avg_score: number;
  duration_s: number;
  total_frames_analysed: number;
  reps: RepResult[];
  thumbnails: Array<{
    timestamp_s: number;
    frame_b64: string;
    rep_number: number | null;
    score: number;
  }>;
}

const API = "http://localhost:8000/api";

export function useVideoAnalysis() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyse = useCallback(async (file: File, exercise: string = "unknown") => {
    setLoading(true);
    setProgress(0);
    setError(null);
    setResult(null);

    const form = new FormData();
    form.append("file", file);
    form.append("exercise", exercise);

    // Simulate progress since fetch doesn't expose upload progress natively
    const ticker = setInterval(() => setProgress((p) => Math.min(p + 4, 85)), 600);

    try {
      const res = await fetch(`${API}/analyse-video`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: AnalysisSummary = await res.json();
      setResult(data);
      setProgress(100);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message ?? "Analysis failed");
    } finally {
      clearInterval(ticker);
      setLoading(false);
    }
  }, []);

  const autoDetect = useCallback(async (file: File): Promise<string> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const form = new FormData();
    // Extract first frame via canvas for detection
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    await new Promise((r) => (video.onloadeddata = r));
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, 320, 240);
    URL.revokeObjectURL(url);

    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.7));
    const f = new FormData();
    f.append("file", blob, "frame.jpg");

    try {
      const res = await fetch(`${API}/detect-exercise`, { method: "POST", body: f });
      const data = await res.json();
      return data.exercise ?? "unknown";
    } catch {
      return "unknown";
    }
  }, []);

  return { analyse, autoDetect, loading, progress, result, error };
}