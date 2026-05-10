"""
Dual-head model:
  Head 1 → exercise classification (9 classes)
  Head 2 → form quality binary score (good / bad)

Architecture: CNN feature extractor over time axis → Bidirectional LSTM → heads
"""

import tensorflow as tf
from tensorflow.keras import layers, Model

SEQUENCE_LENGTH = 60
FEATURE_DIM     = 48   # 12 joints × 4 features
# NUM_EXERCISE_CLASSES = 9
# Change this one line — default num_exercises from 9 to 22
NUM_EXERCISE_CLASSES = 22


def build_model(
    sequence_len: int = SEQUENCE_LENGTH,
    feature_dim:  int = FEATURE_DIM,
    num_exercises: int = NUM_EXERCISE_CLASSES,
    dropout: float = 0.3,
) -> Model:
    inputs = tf.keras.Input(shape=(sequence_len, feature_dim), name="pose_sequence")

    # ── Temporal CNN block ───────────────────────────────────────────────────
    x = layers.Conv1D(64, kernel_size=3, padding="same", activation="relu")(inputs)
    x = layers.BatchNormalization()(x)
    x = layers.Conv1D(128, kernel_size=3, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling1D(pool_size=2)(x)       # (30, 128)
    x = layers.Dropout(dropout)(x)

    # ── Bidirectional LSTM ────────────────────────────────────────────────────
    x = layers.Bidirectional(layers.LSTM(128, return_sequences=True))(x)
    x = layers.Dropout(dropout)(x)
    x = layers.Bidirectional(layers.LSTM(64))(x)  # (batch, 128)

    # ── Shared dense ─────────────────────────────────────────────────────────
    shared = layers.Dense(128, activation="relu")(x)
    shared = layers.Dropout(dropout)(shared)

    # ── Head 1: exercise classifier ──────────────────────────────────────────
    ex_head = layers.Dense(64, activation="relu")(shared)
    ex_out  = layers.Dense(num_exercises, activation="softmax", name="exercise")(ex_head)

    # ── Head 2: form quality (0=bad, 1=good) ─────────────────────────────────
    q_head  = layers.Dense(32, activation="relu")(shared)
    q_out   = layers.Dense(1, activation="sigmoid", name="quality")(q_head)

    model = Model(inputs=inputs, outputs={"exercise": ex_out, "quality": q_out})
    return model


def compile_model(model: Model, learning_rate: float = 1e-3) -> Model:
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate),
        loss={
            "exercise": "sparse_categorical_crossentropy",
            "quality":  "binary_crossentropy",
        },
        loss_weights={"exercise": 1.0, "quality": 0.6},
        metrics={
            "exercise": ["accuracy"],
            "quality":  ["accuracy"],
        },
    )
    return model