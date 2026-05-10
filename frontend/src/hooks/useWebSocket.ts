import { useCallback, useEffect, useRef, useState } from "react";
import type { FormFeedback } from "../types";

const WS_URL = "ws://localhost:8000/api/ws/stream";

// interface StreamMessage {
//   feedback?: FormFeedback;
//   annotated_frame?: string;
//   detected_exercise?: string;
//   error?: string;
// }

interface StreamMessage {
  feedback?: FormFeedback;
  annotated_frame?: string;
  detected_exercise?: string;
  model_confidence?: number;
  model_top?: Record<string, number>;
  error?: string;
}


export function useWorkoutStream(exercise: string, onAutoDetect?: (ex: string) => void) {
  const ws = useRef<WebSocket | null>(null);
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [connected, setConnected] = useState(false);
  const [detectedExercise, setDetectedExercise] = useState<string | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);
  const [modelConfidence, setModelConfidence] = useState(0);
  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      const socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        setConnected(true);
        setWsError(null);
      };

      socket.onclose = () => {
        setConnected(false);
        // Retry after 2s
        retryTimeout = setTimeout(connect, 2000);
      };

      socket.onerror = () => {
        setWsError("WebSocket connection failed");
      };

      socket.onmessage = (e) => {
        try {
          const data: StreamMessage = JSON.parse(e.data);
          if (data.model_confidence !== undefined) setModelConfidence(data.model_confidence);

          if (data.error) return;

          if (data.feedback) {
            setFeedback({
              ...data.feedback,
              annotated_frame: data.annotated_frame,
            });
          }

          if (data.detected_exercise && data.detected_exercise !== "unknown") {
            setDetectedExercise(data.detected_exercise);
            if (exercise === "unknown" && onAutoDetect) {
              onAutoDetect(data.detected_exercise);
            }
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.current = socket;
    };

    connect();
    return () => {
      clearTimeout(retryTimeout);
      ws.current?.close();
    };
  }, []);  // connect once, exercise changes are handled via sendFrame

  const sendFrame = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
      const frame_b64 = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
      ws.current.send(
        JSON.stringify({ frame_b64, exercise, timestamp_ms: Date.now() })
      );
    },
    [exercise]
  );

  // return { feedback, connected, detectedExercise, wsError, sendFrame };
  return { feedback, connected, detectedExercise, modelConfidence, wsError, sendFrame };
}