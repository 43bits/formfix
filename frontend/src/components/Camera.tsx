import { useEffect, useRef } from "react";
import type { Exercise } from "../types";
import { useWorkoutStream } from "../hooks/useWebSocket";

interface Props {
  exercise: Exercise;
}

export function Camera({ exercise }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLImageElement>(null);
  const { feedback, connected, sendFrame } = useWorkoutStream(exercise);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } }).then((stream) => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      sendFrame(canvas);
    }, 100); // 10fps send rate — backend processes faster
    return () => clearInterval(interval);
  }, [sendFrame]);

  // Show annotated frame from backend
  useEffect(() => {
    if (feedback?.annotated_frame && overlayRef.current) {
      overlayRef.current.src = `data:image/jpeg;base64,${feedback.annotated_frame}`;
    }
  }, [feedback?.annotated_frame]);

  return (
    <div style={{ position: "relative", width: 640 }}>
      <video ref={videoRef} autoPlay muted width={640} height={480} style={{ display: "none" }} />
      <canvas ref={canvasRef} width={640} height={480} style={{ display: "none" }} />
      <img ref={overlayRef} width={640} height={480} alt="pose overlay"
        style={{ borderRadius: 12, background: "#111", display: "block" }} />
      <div style={{ position: "absolute", top: 8, left: 8, fontSize: 12,
        color: connected ? "#4ade80" : "#f87171", fontWeight: 500 }}>
        ● {connected ? "Live" : "Disconnected"}
      </div>
      {feedback && (
        <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)",
          color: "#fff", padding: "4px 10px", borderRadius: 8, fontSize: 13 }}>
          Reps: {feedback.rep_count} · Score: {Math.round(feedback.score)}
        </div>
      )}
    </div>
  );
}