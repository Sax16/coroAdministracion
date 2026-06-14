import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/hooks';
import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

/**
 * Layout del grupo de rutas (app).
 * Esta es la zona que requiere auth. Si el usuario no está autenticado,
 * redirigimos a /login.
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
