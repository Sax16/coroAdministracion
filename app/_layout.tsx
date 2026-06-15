import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';

import { configureNotifications } from '@/lib/notifications';
import { useAuthStore } from '@/stores/auth';
import { useGrupoActivoStore } from '@/stores/grupoActivo';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateGrupo = useGrupoActivoStore((s) => s.hydrate);

  // Hidratar stores y configurar notificaciones UNA sola vez al montar la app.
  useEffect(() => {
    void hydrateAuth();
    void hydrateGrupo();
    configureNotifications();
  }, [hydrateAuth, hydrateGrupo]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
