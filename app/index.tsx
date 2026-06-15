import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/features/auth/hooks';
import { useGrupoActivoStore } from '@/stores/grupoActivo';

/**
 * Index de la app. Decide a dónde ir según el estado de auth y el
 * grupo activo:
 * - Si todavía no hidratamos la sesión: splash.
 * - Si no hay usuario: redirige a /login.
 * - Si hay grupo activo persistido: redirige a "Mi semana" de ese grupo
 *   (RF-054: la pantalla principal del usuario).
 * - Si no hay grupo activo: redirige a la lista de grupos para que
 *   elija uno.
 *
 * La pantalla de ping que estaba antes se movió al smoke test del
 * cliente Supabase; esta ruta ya no la necesitamos en producción.
 */
export default function Index() {
  const { user, hydrated } = useAuth();
  const grupo = useGrupoActivoStore((s) => s.grupo);
  const grupoHydrated = useGrupoActivoStore((s) => s.hydrated);

  if (!hydrated || !grupoHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (grupo) {
    return <Redirect href={`/(app)/grupos/${grupo.id}/mi-semana`} />;
  }

  return <Redirect href="/(app)/grupos" />;
}
