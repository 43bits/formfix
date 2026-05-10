import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormFeedback } from '../types';

// ⚠️  Change IP for physical device: e.g. ws://192.168.1.x:8000/...
// iOS sim = localhost | Android emu = 10.0.2.2
// const WS_URL = 'ws://localhost:8000/api/ws/stream';

import { WS_BASE } from '../constants/api';
const WS_URL = `${WS_BASE}/ws/stream`;
// remove the old hardcoded const WS_URL line

interface StreamMessage {
  feedback?: FormFeedback;
  annotated_frame?: string;
  detected_exercise?: string;
  error?: string;
}


export function useWorkoutStream(
  exercise: string,
  onAutoDetect?: (ex: string) => void
) {
  const ws       = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [feedback,          setFeedback         ] = useState<FormFeedback | null>(null);
  const [connected,         setConnected        ] = useState(false);
  const [detectedExercise,  setDetectedExercise ] = useState<string | null>(null);
  const [wsError,           setWsError          ] = useState<string | null>(null);
const [repCount, setRepCount] = useState(0);

  useEffect(() => {
    const connect = () => {
      const socket = new WebSocket(WS_URL);
      

      socket.onopen = () => { setConnected(true); setWsError(null); };

      socket.onclose = () => {
        setConnected(false);
        retryRef.current = setTimeout(connect, 2000);
      };

      socket.onerror = () => setWsError('WebSocket connection failed');

    //   socket.onmessage = (e) => {
    //     try {
    //       const data: StreamMessage = JSON.parse(e.data);
    //       if (data.error) return;
    //       if (data.feedback) {
    //         setFeedback({ ...data.feedback, annotated_frame: data.annotated_frame });
    //       }
    //       if (data.detected_exercise && data.detected_exercise !== 'unknown') {
    //         setDetectedExercise(data.detected_exercise);
    //         if (exercise === 'unknown' && onAutoDetect) onAutoDetect(data.detected_exercise);
    //       }
    //     } catch { /* malformed */ }
    //   };
    socket.onmessage = (e) => {
  try {
    const data: StreamMessage = JSON.parse(e.data);
    if (data.error) return;
    if (data.feedback) {
      setFeedback({ ...data.feedback, annotated_frame: data.annotated_frame });
      // ✅ only go up, never reset
      setRepCount(prev => Math.max(prev, data.feedback!.rep_count ?? 0));
    }
    if (data.detected_exercise && data.detected_exercise !== 'unknown') {
      setDetectedExercise(data.detected_exercise);
      if (exercise === 'unknown' && onAutoDetect) onAutoDetect(data.detected_exercise);
    }
  } catch { }
}; 
    
      ws.current = socket;
    };

    connect();
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      ws.current?.close();
    };
  }, []);


  /**
   * Call this with a base64 JPEG string from camera
   * (replace canvas logic — in RN use takePictureAsync base64)
   */
  const sendFrameB64 = useCallback(
    (frame_b64: string) => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
      ws.current.send(
        JSON.stringify({ frame_b64, exercise, timestamp_ms: Date.now() })
      );
    },
    [exercise]
  );
  useEffect(() => { setRepCount(0); }, [exercise]);
  return { feedback, connected, detectedExercise, wsError, sendFrameB64,repCount };
}
