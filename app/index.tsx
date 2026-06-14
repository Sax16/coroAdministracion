import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/features/auth/hooks';

/**
 * Index de la app. Decide a dónde ir según el estado de auth:
 * - Si todavía no hidratamos la sesión: splash.
 * - Si no hay usuario: redirige a /login.
 * - Si hay usuario: redirige a la lista de grupos.
 *
 * La pantalla de ping que estaba antes se movió al smoke test del
 * cliente Supabase; esta ruta ya no la necesitamos en producción.
 */
export default function Index() {
  const { user, hydrated } = useAuth();

  if (!hydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(app)/grupos" />;
}
