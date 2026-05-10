// import { useState, useCallback, useRef } from 'react';
// import * as FileSystem from 'expo-file-system';
// import type { AnalysisSummary } from '../types';
// import { HTTP_BASE } from '../constants/api';

// export function useVideoAnalysis() {
//   const [loading,  setLoading ] = useState(false);
//   const [progress, setProgress] = useState(0);
//   const [result,   setResult  ] = useState<AnalysisSummary | null>(null);
//   const [error,    setError   ] = useState<string | null>(null);
//   const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

//   // ✅ FIX: returns the result so callers can await it
//   const analyse = useCallback(async (
//     fileUri: string,
//     exercise = 'unknown'
//   ): Promise<AnalysisSummary | null> => {
//     setLoading(true); setProgress(0); setError(null); setResult(null);
//     tickerRef.current = setInterval(() => setProgress(p => Math.min(p + 4, 85)), 600);

//     try {
//       const uploadResult = await FileSystem.uploadAsync(
//         `${HTTP_BASE}/analyse-video`,
//         fileUri,
//         {
//           httpMethod: 'POST',
//           uploadType: FileSystem.FileSystemUploadType.MULTIPART,
//           fieldName: 'file',
//           parameters: { exercise },
//         }
//       );
//       if (uploadResult.status !== 200) throw new Error(`Server error ${uploadResult.status}`);
//       const data: AnalysisSummary = JSON.parse(uploadResult.body);
//       setResult(data);
//       setProgress(100);
//       return data; // ✅ return so caller gets it
//     } catch (e: any) {
//       setError(e.message ?? 'Analysis failed');
//       return null;
//     } finally {
//       if (tickerRef.current) clearInterval(tickerRef.current);
//       setLoading(false);
//     }
//   }, []);

//   const autoDetect = useCallback(async (fileUri: string): Promise<string> => {
//     try {
//       const res = await FileSystem.uploadAsync(
//         `${HTTP_BASE}/detect-exercise`,
//         fileUri,
//         {
//           httpMethod: 'POST',
//           uploadType: FileSystem.FileSystemUploadType.MULTIPART,
//           fieldName: 'file',
//         }
//       );
//       const data = JSON.parse(res.body);
//       return data.exercise ?? 'unknown';
//     } catch {
//       return 'unknown';
//     }
//   }, []);

//   return { analyse, autoDetect, loading, progress, result, error };
// }


import { useState, useCallback, useRef } from 'react';
import type { AnalysisSummary } from '../types';
import { HTTP_BASE } from '../constants/api';

export function useVideoAnalysis() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const analyse = useCallback(
    async (
      fileUri: string,
      exercise = 'unknown'
    ): Promise<AnalysisSummary | null> => {
      setLoading(true);
      setProgress(0);
      setError(null);
      setResult(null);

      tickerRef.current = setInterval(() => {
        setProgress((p) => Math.min(p + 4, 85));
      }, 600);

      try {
        const formData = new FormData();

        formData.append('file', {
          uri: fileUri,
          name: 'video.mp4',
          type: 'video/mp4',
        } as any);

        formData.append('exercise', exercise);

        const response = await fetch(`${HTTP_BASE}/analyse-video`, {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (!response.ok) {
          throw new Error(`Server error ${response.status}`);
        }

        const data: AnalysisSummary = await response.json();

        setResult(data);
        setProgress(100);

        return data;
      } catch (e: any) {
        setError(e.message ?? 'Analysis failed');
        return null;
      } finally {
        if (tickerRef.current) {
          clearInterval(tickerRef.current);
        }
        setLoading(false);
      }
    },
    []
  );

  const autoDetect = useCallback(async (fileUri: string): Promise<string> => {
    try {
      const formData = new FormData();

      formData.append('file', {
        uri: fileUri,
        name: 'video.mp4',
        type: 'video/mp4',
      } as any);

      const response = await fetch(`${HTTP_BASE}/detect-exercise`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = await response.json();
      return data.exercise ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }, []);

  return {
    analyse,
    autoDetect,
    loading,
    progress,
    result,
    error,
  };
}