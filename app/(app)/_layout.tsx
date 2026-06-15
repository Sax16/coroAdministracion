import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/hooks';
import { PushTokenRegistrar } from '@/features/dispositivos/PushTokenRegistrar';
import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

/**
 * Layout del grupo de rutas (app).
 * Esta es la zona que requiere auth. Si el usuario no está autenticado,
 * redirigimos a /login.
 *
 * También monta `PushTokenRegistrar`, un componente invisible que
 * registra/limpia el push token del dispositivo según el estado de
 * auth (RF-085).
 */
export default function AppLayout() {
  const { user, hydrated } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    const inAppGroup = segments[0] === '(app)';
    if (!user && inAppGroup) {
      router.replace('/(auth)/login');
    }
  }, [user, hydrated, segments, router]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <PushTokenRegistrar />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#4f46e5' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      />
    </SafeAreaView>
  );
}
