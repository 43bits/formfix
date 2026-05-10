import { useCallback, useEffect, useRef, useState } from "react";

const WS_URL = "ws://localhost:8000/api/emotion/ws";

export interface EmotionData {
  dominant: string;
  scores: Record<string, number>;
  valence: number;
  face_detected: boolean;
  face_bbox: [number, number, number, number] | null;
  music: {
    genre: string;
    bpm: string;
    reason: string;
  } | null;
}

export function useEmotionStream() {
  const ws = useRef<WebSocket | null>(null);
  const [emotion, setEmotion] = useState<EmotionData | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    ws.current = new WebSocket(WS_URL);
    ws.current.onopen  = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);
    ws.current.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (!d.error) setEmotion(d);
    };
    return () => ws.current?.close();
  }, []);

  const sendFrame = useCallback(
    (canvas: HTMLCanvasElement, formScore: number, repNumber: number, exercise: string) => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
      const frame_b64 = canvas.toDataURL("image/jpeg", 0.5).split(",")[1];
      ws.current.send(JSON.stringify({ frame_b64, form_score: formScore, rep_number: repNumber, exercise }));
    },
    []
  );

  return { emotion, connected, sendFrame };
}