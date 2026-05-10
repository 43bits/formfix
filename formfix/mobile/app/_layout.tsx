// import { Stack } from 'expo-router';
// import { StatusBar } from 'expo-status-bar';
// import { GestureHandlerRootView } from 'react-native-gesture-handler';

// export default function RootLayout() {
//   return (
//     <GestureHandlerRootView style={{ flex: 1 }}>
//       <StatusBar style="light" />
//       <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' } }}>
//         <Stack.Screen name="(tabs)" />
//         <Stack.Screen name="analysis" options={{ presentation: 'modal' }} />
//       </Stack>
//     </GestureHandlerRootView>
//   );
// }

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSessionStore } from '../store/useSessionStore';

export default function RootLayout() {
  const loadSessions = useSessionStore(s => s.loadSessions);
  useEffect(() => { loadSessions(); }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="analysis" options={{ presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}