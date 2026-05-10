export interface FormFeedback {
  score: number;                    // 0-100
  errors: string[];
  suggestions: string[];
  rep_count: number;
  annotated_frame?: string;         // base64 jpeg
  angles?: Record<string, number>;
}

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

export interface WorkoutSession {
  id: string;
  date: string;                     // ISO
  exercise: string;
  score: number;
  reps: number;
  duration_s: number;
  summary?: AnalysisSummary;
}