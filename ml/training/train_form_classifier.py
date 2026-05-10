# """
# Usage:
#   python train_form_classifier.py \
#     --dataset /data/sequences/dataset.pkl \
#     --output_dir ml/models \
#     --epochs 60
# """

# import argparse
# import os
# import pickle
# import numpy as np
# import tensorflow as tf
# from sklearn.model_selection import train_test_split
# from pose_sequence_model import build_model, compile_model

# SEED = 42


# def augment_sequence(x: np.ndarray) -> np.ndarray:
#     """Light augmentation: add Gaussian noise + random time shift."""
#     noise = np.random.normal(0, 0.01, x.shape).astype(np.float32)
#     x = x + noise
#     shift = np.random.randint(-3, 3)
#     if shift > 0:
#         x = np.concatenate([x[shift:], np.zeros((shift, x.shape[1]), dtype=np.float32)])
#     elif shift < 0:
#         x = np.concatenate([np.zeros((-shift, x.shape[1]), dtype=np.float32), x[:shift]])
#     return x


# def make_dataset(X, y_ex, y_q, batch_size: int, augment: bool = False):
#     def gen():
#         for i in range(len(X)):
#             xb = augment_sequence(X[i]) if augment else X[i]
#             yield xb, {"exercise": y_ex[i], "quality": y_q[i].astype(np.float32)}

#     ds = tf.data.Dataset.from_generator(
#         gen,
#         output_signature=(
#             tf.TensorSpec(shape=X.shape[1:], dtype=tf.float32),
#             {
#                 "exercise": tf.TensorSpec(shape=(), dtype=tf.int32),
#                 "quality":  tf.TensorSpec(shape=(), dtype=tf.float32),
#             },
#         )
#     )
#     if augment:
#         ds = ds.shuffle(1000, seed=SEED)
#     return ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)


# def train(dataset_path: str, output_dir: str, epochs: int, batch_size: int = 32):
#     with open(dataset_path, "rb") as f:
#         data = pickle.load(f)

#     X  = data["X_exercise"]
#     ye = data["y_exercise"]
#     yq = data["y_quality"]

#     X_train, X_val, ye_train, ye_val, yq_train, yq_val = train_test_split(
#         X, ye, yq, test_size=0.15, random_state=SEED, stratify=ye
#     )

#     print(f"Train: {len(X_train)}  Val: {len(X_val)}")

#     train_ds = make_dataset(X_train, ye_train, yq_train, batch_size, augment=True)
#     val_ds   = make_dataset(X_val,   ye_val,   yq_val,   batch_size, augment=False)

#     # model = build_model(
#     #     sequence_len=data["sequence_length"],
#     #     feature_dim=data["feature_dim"],
#     #     num_exercises=len(data["exercise_labels"]),
#     # )
    
#     # Replace the build_model call in train_form_classifier.py
#     model = build_model(
#         sequence_len=data["sequence_length"],
#         feature_dim=data["feature_dim"],
#         num_exercises=data.get("num_classes", 22),   # ← reads from dataset
#     )
    
#     model = compile_model(model)
#     model.summary()

#     callbacks = [
#         tf.keras.callbacks.ModelCheckpoint(
#             os.path.join(output_dir, "best_model.keras"),
#             monitor="val_exercise_accuracy", save_best_only=True, verbose=1,
#         ),
#         tf.keras.callbacks.EarlyStopping(
#             monitor="val_exercise_accuracy", patience=10, restore_best_weights=True
#         ),
#         tf.keras.callbacks.ReduceLROnPlateau(
#             monitor="val_loss", factor=0.5, patience=5, min_lr=1e-6, verbose=1
#         ),
#         tf.keras.callbacks.TensorBoard(
#             log_dir=os.path.join(output_dir, "logs"), histogram_freq=1
#         ),
#     ]

#     history = model.fit(
#         train_ds, validation_data=val_ds,
#         epochs=epochs, callbacks=callbacks,
#     )

#     model.save(os.path.join(output_dir, "form_classifier.keras"))
#     print(f"\nModel saved → {output_dir}/form_classifier.keras")
#     return model


# if __name__ == "__main__":
#     parser = argparse.ArgumentParser()
#     parser.add_argument("--dataset",    required=True)
#     parser.add_argument("--output_dir", required=True)
#     parser.add_argument("--epochs",     type=int, default=60)
#     parser.add_argument("--batch_size", type=int, default=32)
#     args = parser.parse_args()
#     os.makedirs(args.output_dir, exist_ok=True)
#     train(args.dataset, args.output_dir, args.epochs, args.batch_size)


"""
Usage:
  python train_form_classifier.py \
    --dataset /data/sequences/dataset.pkl \
    --output_dir ml/models \
    --epochs 60
"""

import argparse
import os
import pickle
import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from pose_sequence_model import build_model, compile_model

SEED = 42


def augment_sequence(x: np.ndarray) -> np.ndarray:
    """Light augmentation: add Gaussian noise + random time shift."""
    noise = np.random.normal(0, 0.01, x.shape).astype(np.float32)
    x = x + noise

    shift = np.random.randint(-3, 3)

    if shift > 0:
        x = np.concatenate([
            x[shift:],
            np.zeros((shift, x.shape[1]), dtype=np.float32)
        ])

    elif shift < 0:
        x = np.concatenate([
            np.zeros((-shift, x.shape[1]), dtype=np.float32),
            x[:shift]
        ])

    return x


def make_dataset(X, y_ex, y_q, batch_size: int, augment: bool = False):
    def gen():
        for i in range(len(X)):
            xb = augment_sequence(X[i]) if augment else X[i]

            yield xb, {
                "exercise": y_ex[i],
                "quality": y_q[i].astype(np.float32)
            }

    ds = tf.data.Dataset.from_generator(
        gen,
        output_signature=(
            tf.TensorSpec(
                shape=X.shape[1:],
                dtype=tf.float32
            ),
            {
                "exercise": tf.TensorSpec(
                    shape=(),
                    dtype=tf.int32
                ),
                "quality": tf.TensorSpec(
                    shape=(),
                    dtype=tf.float32
                ),
            },
        )
    )

    if augment:
        ds = ds.shuffle(1000, seed=SEED).repeat()   # FIXED

    return ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)


def train(dataset_path: str, output_dir: str, epochs: int, batch_size: int = 32):
    with open(dataset_path, "rb") as f:
        data = pickle.load(f)

    X = data["X_exercise"]
    ye = data["y_exercise"]
    yq = data["y_quality"]

    X_train, X_val, ye_train, ye_val, yq_train, yq_val = train_test_split(
        X,
        ye,
        yq,
        test_size=0.15,
        random_state=SEED,
        stratify=ye
    )

    print(f"Train: {len(X_train)}  Val: {len(X_val)}")

    train_ds = make_dataset(
        X_train,
        ye_train,
        yq_train,
        batch_size,
        augment=True
    )

    val_ds = make_dataset(
        X_val,
        ye_val,
        yq_val,
        batch_size,
        augment=False
    )

    model = build_model(
        sequence_len=data["sequence_length"],
        feature_dim=data["feature_dim"],
        num_exercises=data.get("num_classes", 22),
    )

    model = compile_model(model)
    model.summary()

    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(
            os.path.join(output_dir, "best_model.h5"),   # .h5 for TF 2.13
            monitor="val_exercise_accuracy",
            save_best_only=True, verbose=1,
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor="val_exercise_accuracy", patience=10, restore_best_weights=True
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.5, patience=5, min_lr=1e-6, verbose=1
        ),
        tf.keras.callbacks.TensorBoard(
            log_dir=os.path.join(output_dir, "logs"), histogram_freq=1
        ),
    ]

    history = model.fit(
         train_ds, validation_data=val_ds,
        epochs=epochs, callbacks=callbacks,
        steps_per_epoch=len(X_train) // batch_size,      # FIXED
        validation_steps=len(X_val) // batch_size        # FIXED
    )

    # model.save(
        # os.path.join(output_dir, "form_classifier.keras")
    # )
    model.save(os.path.join(output_dir, "form_classifier.h5"))
    print(f"Model saved → {output_dir}/form_classifier.h5")
    print(
        f"\nModel saved → {output_dir}/form_classifier.keras"
    )

    return model


if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--dataset",
        required=True
    )

    parser.add_argument(
        "--output_dir",
        required=True
    )

    parser.add_argument(
        "--epochs",
        type=int,
        default=60
    )

    parser.add_argument(
        "--batch_size",
        type=int,
        default=32
    )

    args = parser.parse_args()

    os.makedirs(
        args.output_dir,
        exist_ok=True
    )
    
    train(
        args.dataset,
        args.output_dir,
        args.epochs,
        args.batch_size
    )