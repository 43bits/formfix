import { useCallback, useEffect, useRef, useState } from "react";
import type { Exercise, FormFeedback } from "../types";

const WS_URL = "ws://localhost:8000/ws/stream";

export function useWorkoutStream(exercise: Exercise) {
  const ws = useRef<WebSocket | null>(null);
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    ws.current = new WebSocket(WS_URL);
    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);
    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.feedback) setFeedback({ ...data.feedback, annotated_frame: data.annotated_frame });
    };
    return () => ws.current?.close();
  }, []);

  const sendFrame = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
      const frame_b64 = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
      ws.current.send(JSON.stringify({ frame_b64, exercise, timestamp_ms: Date.now() }));
    },
    [exercise]
  );

  return { feedback, connected, sendFrame };
}