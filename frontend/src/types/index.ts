export type Exercise = "deadlift" | "squat" | "bench_press" | "unknown";

export interface JointAngle {
  name: string;
  angle: number;
  status: "good" | "warning" | "error";
  target_min: number;
  target_max: number;
}

export interface FormFeedback {
  exercise: Exercise;
  rep_count: number;
  phase: string;
  joint_angles: JointAngle[];
  errors: string[];
  warnings: string[];
  score: number;
  annotated_frame?: string; // base64 jpeg
}