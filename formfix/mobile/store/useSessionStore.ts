import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutSession, AnalysisSummary } from '../types';

const STORAGE_KEY = '@visionai_sessions_v1';
const KEY = 'visionai_sessions'; // ✅ this lin
interface SessionStore {
  sessions:     WorkoutSession[];
  pending:      AnalysisSummary | null;   // set before navigating to /analysis
  hydrated:     boolean;

  // actions
  setPending:   (s: AnalysisSummary | null) => void;
  addSession:   (s: WorkoutSession) => Promise<void>;
  loadSessions: () => Promise<void>;
  clearAll:     () => Promise<void>;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions:  [],
  pending:   null,
  hydrated:  false,

  setPending: (s) => set({ pending: s }),

//   addSession: async (session) => {
//     // prepend newest, keep last 300
//     const next = [session, ...get().sessions].slice(0, 300);
//     set({ sessions: next });
//     try {
//       await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
//     } catch (e) {
//       console.warn('[SessionStore] Failed to persist sessions', e);
//     }
//   },
addSession: async (session) => {
  const next = [session, ...get().sessions].slice(0, 200);
  set({ sessions: next });
  
  // ✅ strip base64 thumbnails before persisting
  const lean = next.map(s => ({
    ...s,
    summary: s.summary ? {
      ...s.summary,
      thumbnails: [],                          // remove base64 frames
      reps: s.summary.reps?.map(r => ({
        ...r,
        worst_angles: r.worst_angles?.slice(0, 3) ?? [], // trim angles
      })) ?? [],
    } : undefined,
  }));
  
  await AsyncStorage.setItem(KEY, JSON.stringify(lean));
},

//   loadSessions: async () => {
//     try {
//       const raw = await AsyncStorage.getItem(STORAGE_KEY);
//       if (raw) {
//         const parsed: WorkoutSession[] = JSON.parse(raw);
//         set({ sessions: parsed, hydrated: true });
//       } else {
//         set({ hydrated: true });
//       }
//     } catch (e) {
//       console.warn('[SessionStore] Failed to load sessions', e);
//       set({ hydrated: true });
//     }
//   },
loadSessions: async () => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) set({ sessions: JSON.parse(raw) });
  } catch (e) {
    console.warn('[SessionStore] Failed to load sessions', e);
    // clear corrupted data
    await AsyncStorage.removeItem(KEY);
  }
},

  clearAll: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({ sessions: [] });
  },
}));