import { useEffect, useRef, useState } from "react";
import { useWorkoutStream } from "../hooks/useWebSocket";

interface Props {
  exercise: string;
  onAutoDetect?: (ex: string) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

export function Camera({ exercise, onAutoDetect, onCanvasReady }: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const displayCanvas = useRef<HTMLCanvasElement>(null);  // visible canvas
  const captureCanvas = useRef<HTMLCanvasElement>(null);  // hidden, for sending frames
  const animFrameRef  = useRef<number>(0);
  const sendInterval  = useRef<ReturnType<typeof setInterval> | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [hasAnnotated, setHasAnnotated] = useState(false);

  const { feedback, connected, detectedExercise, wsError, sendFrame, modelConfidence } =
    useWorkoutStream(exercise, onAutoDetect);

  // Start webcam → draw raw feed to display canvas
  useEffect(() => {
    let stream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } })
      .then((s) => {
        stream = s;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = s;
        video.onloadedmetadata = () => {
          video.play();
          // eslint-disable-next-line react-hooks/immutability
          startRawLoop();
        };
      })
      .catch((e) => {
        setCamError(`Camera error: ${e.message}`);
      });

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose capture canvas to parent (for emotion stream)
  useEffect(() => {
    if (captureCanvas.current && onCanvasReady) {
      onCanvasReady(captureCanvas.current);
    }
  }, [onCanvasReady]);

  // Draw raw video to visible canvas continuously
  const startRawLoop = () => {
    const draw = () => {
      const video   = videoRef.current;
      const display = displayCanvas.current;
      const capture = captureCanvas.current;
      if (video && display && capture && video.readyState >= 2) {
        const dCtx = display.getContext("2d")!;
        const cCtx = capture.getContext("2d")!;
        // Only draw raw if we haven't received an annotated frame yet
        if (!hasAnnotated) {
          dCtx.drawImage(video, 0, 0, 640, 480);
        }
        cCtx.drawImage(video, 0, 0, 640, 480);
      }
      animFrameRef.current = requestAnimationFrame(draw);
    };
    animFrameRef.current = requestAnimationFrame(draw);
  };

  // Send frames to backend every 100ms
  useEffect(() => {
    sendInterval.current = setInterval(() => {
      if (captureCanvas.current) sendFrame(captureCanvas.current);
    }, 100);
    return () => { if (sendInterval.current) clearInterval(sendInterval.current); };
  }, [sendFrame]);

  // Draw annotated frame from backend onto display canvas
  useEffect(() => {
    if (!feedback?.annotated_frame || !displayCanvas.current) return;
    const img = new Image();
    img.onload = () => {
      const ctx = displayCanvas.current?.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, 640, 480);
        setHasAnnotated(true);
      }
    };
    img.src = `data:image/jpeg;base64,${feedback.annotated_frame}`;
  }, [feedback?.annotated_frame]);

  const scoreColor = !feedback ? "#888"
    : feedback.score >= 75 ? "#4ade80"
    : feedback.score >= 50 ? "#fbbf24"
    : "#f87171";

  if (camError) {
    return (
      <div style={{
        width: 640, height: 480, background: "#1a1a1a", borderRadius: 12,
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 12,
      }}>
        <span style={{ fontSize: 32 }}>📷</span>
        <div style={{ color: "#f87171", fontSize: 14, textAlign: "center", padding: "0 24px" }}>
          {camError}
        </div>
        <div style={{ color: "#888", fontSize: 12 }}>
          Allow camera access and refresh
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: 640, flexShrink: 0 }}>
      {/* Hidden elements */}
      <video ref={videoRef} muted playsInline
        style={{ display: "none" }} width={640} height={480} />
      <canvas ref={captureCanvas} width={640} height={480}
        style={{ display: "none" }} />

      {/* Visible canvas — shows raw feed or annotated frame */}
      <canvas
        ref={displayCanvas}
        width={640}
        height={480}
        style={{
          display: "block",
          borderRadius: 12,
          background: "#111",
          width: "100%",
          maxWidth: 640,
        }}
      />

      {/* Connection pill */}
      <div style={{
        position: "absolute", top: 10, left: 10,
        background: "rgba(0,0,0,0.65)", padding: "4px 10px",
        borderRadius: 20, display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ color: connected ? "#4ade80" : "#f87171", fontSize: 10 }}>●</span>
        <span style={{ color: "#fff", fontSize: 12 }}>
          {connected ? "Live" : wsError ? "Error — retrying" : "Connecting…"}
        </span>
      </div>

      {/* Auto-detected exercise */}
     // Replace the detection badge in Camera.tsx
{detectedExercise && exercise === "unknown" && (
  <div style={{
    position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
    background: "rgba(79,70,229,0.88)", color: "#fff",
    padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500,
    whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6,
  }}>
    <span>Detected: {detectedExercise.replace(/_/g, " ")}</span>
    {modelConfidence > 0 && (
      <span style={{
        background: "rgba(255,255,255,0.25)",
        padding: "1px 6px", borderRadius: 10, fontSize: 10,
      }}>
        {(modelConfidence * 100).toFixed(0)}%
      </span>
    )}
  </div>
)}

      {/* Rep + score HUD */}
      {feedback && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end",
        }}>
          <div style={{
            background: "rgba(0,0,0,0.65)", color: "#fff",
            padding: "4px 10px", borderRadius: 20, fontSize: 13, fontWeight: 500,
          }}>
            Rep {feedback.rep_count}
          </div>
          <div style={{
            background: "rgba(0,0,0,0.65)", color: scoreColor,
            padding: "4px 10px", borderRadius: 20, fontSize: 14, fontWeight: 500,
          }}>
            {Math.round(feedback.score)}/100
          </div>
          <div style={{
            background: "rgba(0,0,0,0.55)", color: "#94a3b8",
            padding: "3px 10px", borderRadius: 20, fontSize: 11,
          }}>
            {feedback.phase}
          </div>
        </div>
      )}

      {/* Error strip */}
      {feedback && feedback.errors.length > 0 && (
        <div style={{
          position: "absolute", bottom: 10, left: 10, right: 10,
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {feedback.errors.slice(0, 2).map((e, i) => (
            <div key={i} style={{
              background: "rgba(220,38,38,0.88)", color: "#fff",
              padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500,
            }}>
              ✕ {e}
            </div>
          ))}
        </div>
      )}

      {/* Good form strip */}
      {feedback && feedback.errors.length === 0 && feedback.warnings.length === 0 && (
        <div style={{
          position: "absolute", bottom: 10, left: 10,
          background: "rgba(22,163,74,0.85)", color: "#fff",
          padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500,
        }}>
          ✓ Good form
        </div>
      )}
    </div>
  );
}