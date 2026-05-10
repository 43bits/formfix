# """
# Exports a trained .keras model to:
#   1. TFLite (for mobile / embedded)
#   2. ONNX  (for cross-framework serving)

# Usage:
#   python export_model.py \
#     --model ml/models/form_classifier.keras \
#     --output_dir ml/models
# """

# import argparse
# import os
# import numpy as np
# import tensorflow as tf


# def to_tflite(model, output_path: str, quantize: bool = True):
#     converter = tf.lite.TFLiteConverter.from_keras_model(model)
#     if quantize:
#         converter.optimizations = [tf.lite.Optimize.DEFAULT]
#         # Representative dataset for int8 calibration
#         def representative_gen():
#             for _ in range(100):
#                 sample = np.random.randn(1, 60, 48).astype(np.float32)
#                 yield [sample]
#         converter.representative_dataset = representative_gen
#         converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
#         converter.inference_input_type  = tf.float32
#         converter.inference_output_type = tf.float32

#     tflite_model = converter.convert()
#     with open(output_path, "wb") as f:
#         f.write(tflite_model)
#     size_kb = os.path.getsize(output_path) / 1024
#     print(f"TFLite saved → {output_path}  ({size_kb:.1f} KB)")


# def to_onnx(model, output_path: str):
#     try:
#         import tf2onnx
#         import onnx
#         spec = (tf.TensorSpec((None, 60, 48), tf.float32, name="pose_sequence"),)
#         _, _ = tf2onnx.convert.from_keras(model, input_signature=spec,
#                                           output_path=output_path)
#         print(f"ONNX saved → {output_path}")
#     except ImportError:
#         print("tf2onnx not installed — skipping ONNX export. pip install tf2onnx onnx")


# def export(model_path: str, output_dir: str):
#     print(f"Loading {model_path} …")
#     model = tf.keras.models.load_model(model_path)

#     stem = os.path.join(output_dir, "form_classifier")
#     to_tflite(model, stem + "_quant.tflite", quantize=True)
#     to_tflite(model, stem + "_fp32.tflite",  quantize=False)
#     to_onnx(model,   stem + ".onnx")


# if __name__ == "__main__":
#     parser = argparse.ArgumentParser()
#     parser.add_argument("--model",      required=True)
#     parser.add_argument("--output_dir", required=True)
#     args = parser.parse_args()
#     export(args.model, args.output_dir)

"""
Export trained Keras model → ONNX (for server) + TFLite (optional mobile).

Run with the TRAINING venv:
  venv_training\Scripts\activate
  python ml/training/export_model.py \
    --model ml/models/form_classifier.keras \
    --output_dir ml/models
"""

import argparse
import os
import numpy as np

SEQUENCE_LENGTH = 60
FEATURE_DIM     = 48


def to_onnx(model, output_path: str):
    """Primary export — used by the server's onnxruntime loader."""
    try:
        import tf2onnx
        import tensorflow as tf
        import onnx

        spec = (tf.TensorSpec((None, SEQUENCE_LENGTH, FEATURE_DIM),
                               tf.float32, name="pose_sequence"),)

        model_proto, _ = tf2onnx.convert.from_keras(
            model,
            input_signature=spec,
            output_path=output_path,
            opset=13,
        )
        size_kb = os.path.getsize(output_path) / 1024
        print(f"ONNX exported → {output_path}  ({size_kb:.0f} KB)")

        # Quick inference test
        import onnxruntime as ort
        sess = ort.InferenceSession(output_path,
                                    providers=["CPUExecutionProvider"])
        dummy = np.random.randn(1, SEQUENCE_LENGTH, FEATURE_DIM).astype(np.float32)
        out   = sess.run(None, {sess.get_inputs()[0].name: dummy})
        print(f"ONNX test inference OK — outputs: {[o.shape for o in out]}")

    except ImportError as e:
        print(f"Missing package for ONNX export: {e}")
        print("In training venv run: pip install tf2onnx onnx onnxruntime")
    except Exception as e:
        print(f"ONNX export failed: {e}")


def to_tflite(model, output_path: str):
    """Optional mobile export."""
    try:
        import tensorflow as tf
        converter = tf.lite.TFLiteConverter.from_keras_model(model)
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        tflite_model = converter.convert()
        with open(output_path, "wb") as f:
            f.write(tflite_model)
        size_kb = os.path.getsize(output_path) / 1024
        print(f"TFLite exported → {output_path}  ({size_kb:.0f} KB)")
    except Exception as e:
        print(f"TFLite export failed (non-critical): {e}")


def export(model_path: str, output_dir: str):
    import tensorflow as tf

    print(f"Loading {model_path} …")
    model = tf.keras.models.load_model(model_path)
    model.summary()

    os.makedirs(output_dir, exist_ok=True)
    stem = os.path.join(output_dir, "form_classifier")

    # ONNX is required for server
    to_onnx(model, stem + ".onnx")

    # TFLite optional (for mobile)
    to_tflite(model, stem + "_quant.tflite")

    print(f"\nDone. Copy {stem}.onnx to your server's ml/models/ directory.")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--model",      required=True)
    p.add_argument("--output_dir", required=True)
    args = p.parse_args()
    export(args.model, args.output_dir)