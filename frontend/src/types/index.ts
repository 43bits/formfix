// Exercise is now a plain string — driven by backend catalogue
export type Exercise = string;

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
  annotated_frame?: string;
}

export interface Sport {
  key: string;
  label: string;
  cues: string[];
}

export interface DetectedExercise {
  exercise: Exercise;
  exercise_confidence: number;
  quality_score: number;
}