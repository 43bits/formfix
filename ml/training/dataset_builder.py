"""
Usage:
  python dataset_builder.py \
    --input_dir "C:/path/to/dataset" \
    --output_dir ml/data
"""

import argparse
import os
import pickle
import cv2
import numpy as np
import mediapipe as mp

mp_pose = mp.solutions.pose

SEQUENCE_LENGTH = 60
STEP_EVERY      = 3
FEATURES_PER_LM = 4

JOINT_INDICES = [
    mp_pose.PoseLandmark.LEFT_SHOULDER.value,
    mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
    mp_pose.PoseLandmark.LEFT_ELBOW.value,
    mp_pose.PoseLandmark.RIGHT_ELBOW.value,
    mp_pose.PoseLandmark.LEFT_WRIST.value,
    mp_pose.PoseLandmark.RIGHT_WRIST.value,
    mp_pose.PoseLandmark.LEFT_HIP.value,
    mp_pose.PoseLandmark.RIGHT_HIP.value,
    mp_pose.PoseLandmark.LEFT_KNEE.value,
    mp_pose.PoseLandmark.RIGHT_KNEE.value,
    mp_pose.PoseLandmark.LEFT_ANKLE.value,
    mp_pose.PoseLandmark.RIGHT_ANKLE.value,
]
FEATURE_DIM = len(JOINT_INDICES) * FEATURES_PER_LM  # 48

# Maps folder name (lowercase, stripped) → class index
EXERCISE_MAP = {
    "barbell biceps curl":  0,
    "bench press":          1,
    "chest fly machine":    2,
    "deadlift":             3,
    "decline bench press":  4,
    "hammer curl":          5,
    "hip thrust":           6,
    "incline bench press":  7,
    "lat pulldown":         8,
    "lateral raise":        9,
    "leg extension":        10,
    "leg raises":           11,
    "plank":                12,
    "pull up":              13,
    "push-up":              14,
    "romanian deadlift":    15,
    "russian twist":        16,
    "shoulder press":       17,
    "squat":                18,
    "t bar row":            19,
    "tricep dips":          20,
    "tricep pushdown":      21,
}
NUM_CLASSES = len(EXERCISE_MAP)
VIDEO_EXTS  = {".mp4", ".avi", ".mov", ".mkv"}


def extract_vectors(video_path: str, pose) -> list:
    cap = cv2.VideoCapture(video_path)
    vectors = []
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        # Resize for speed
        frame = cv2.resize(frame, (480, 270))
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        res = pose.process(rgb)
        if res.pose_landmarks:
            lms = res.pose_landmarks.landmark
            vec = []
            for idx in JOINT_INDICES:
                lm = lms[idx]
                vec.extend([lm.x, lm.y, lm.z, lm.visibility])
            vectors.append(np.array(vec, dtype=np.float32))
    cap.release()
    return vectors


def sliding_windows(vectors):
    windows = []
    for s in range(0, len(vectors) - SEQUENCE_LENGTH + 1, STEP_EVERY):
        windows.append(np.stack(vectors[s: s + SEQUENCE_LENGTH]))
    return windows


def build(input_dir: str, output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    X, y = [], []

    pose = mp_pose.Pose(
        static_image_mode=False, model_complexity=0,   # 0 = lite, fastest
        min_detection_confidence=0.4, min_tracking_confidence=0.4,
    )

    for folder in sorted(os.listdir(input_dir)):
        folder_path = os.path.join(input_dir, folder)
        if not os.path.isdir(folder_path):
            continue

        label_key = folder.lower().strip()
        label_idx = EXERCISE_MAP.get(label_key)
        if label_idx is None:
            print(f"  [skip] unknown folder: {folder}")
            continue

        videos = [f for f in os.listdir(folder_path)
                  if os.path.splitext(f)[1].lower() in VIDEO_EXTS]
        print(f"\n[{label_idx:02d}] {folder} — {len(videos)} videos")

        for vid in videos:
            path = os.path.join(folder_path, vid)
            try:
                vecs = extract_vectors(path, pose)
            except Exception as e:
                print(f"    error {vid}: {e}")
                continue

            if len(vecs) < SEQUENCE_LENGTH:
                print(f"    skip {vid} (only {len(vecs)} frames)")
                continue

            wins = sliding_windows(vecs)
            X.extend(wins)
            y.extend([label_idx] * len(wins))
            print(f"    {vid}: {len(wins)} windows")

    pose.close()

    X_arr = np.array(X, dtype=np.float32)
    y_arr = np.array(y, dtype=np.int32)

    out = os.path.join(output_dir, "dataset.pkl")
    with open(out, "wb") as f:
        pickle.dump({
            "X_exercise":     X_arr,
            "y_exercise":     y_arr,
            "X_quality":      X_arr,   # placeholder — add quality labels later
            "y_quality":      np.ones(len(y_arr), dtype=np.int32),
            "sequence_length": SEQUENCE_LENGTH,
            "feature_dim":    FEATURE_DIM,
            "exercise_labels": EXERCISE_MAP,
            "num_classes":    NUM_CLASSES,
        }, f)

    print(f"\nDone. {len(X_arr)} total windows → {out}")
    print(f"Class distribution:")
    for name, idx in EXERCISE_MAP.items():
        count = int((y_arr == idx).sum())
        print(f"  [{idx:02d}] {name}: {count}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--input_dir",  required=True)
    p.add_argument("--output_dir", required=True)
    args = p.parse_args()
    build(args.input_dir, args.output_dir)