import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSignOut } from '@/features/auth/hooks';
import { useAuthStore } from '@/stores/auth';
import { supabase } from '@/lib/supabase';

/**
 * Pantalla de perfil del usuario.
 *
 * Concentra todas las acciones a nivel CUENTA (no grupo):
 * - Datos básicos: email, nombre, apellido. Nombre y apellido son
 *   editables desde "Editar perfil" (RF-005).
 * - Cerrar sesión (RF-003).
 * - Eliminar cuenta (RF-006) → navega al flujo destructivo.
 *
 * Decisiones de diseño:
 * - Single-source-of-truth para "quién soy": los datos se leen
 *   de `public.perfiles` (no de `auth.users`) porque esa es la fila
 *   que mantiene la app (trigger `handle_new_user` la crea al
 *   registrarse).
 * - `useFocusEffect` para re-fetchar al volver de la pantalla de
 *   edición. Si ya tenemos datos, el refetch es silencioso (sin
 *   flash de ActivityIndicator) — solo actualiza en background.
 * - El botón "Eliminar cuenta" está separado abajo, en zona roja,
 *   con confirmación obligatoria. NO es un click accidental.
 */
export default function PerfilScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { signOut, loading: signOutLoading } = useSignOut();

  const [nombre, setNombre] = useState<string | null>(null);
  const [apellido, setApellido] = useState<string | null>(null);
  // `loading` solo es true en el primer load. Los refetches en
  // background no muestran el spinner (evita un flash al volver del
  // editor).
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPerfil = useCallback(async () => {
    if (!user) return;
    const isFirstLoad = nombre === null && apellido === null;
    if (isFirstLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    const { data, error } = await supabase
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .maybeSingle();
    if (error) {
      // Silencioso en refetchs; en el primer load el "—" se muestra igual.
      console.warn('[perfil] fetch error:', error.message);
    } else if (data) {
      setNombre(data.nombre);
      setApellido(data.apellido);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user, nombre, apellido]);

  useFocusEffect(
    useCallback(() => {
      void fetchPerfil();
    }, [fetchPerfil]),
  );

  const onSignOut = async () => {
    await signOut();
    // El _layout del grupo (app) detecta user=null y redirige a login.
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Mi perfil',
          headerBackTitle: 'Volver',
        }}
      />

      <ScrollView contentContainerClassName="p-4">
        {/* Card de datos */}
        <View className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tu cuenta
            </Text>
            {refreshing ? (
              <ActivityIndicator color="#4f46e5" size="small" />
            ) : null}
          </View>
          {loading ? (
            <View className="py-2">
              <ActivityIndicator color="#4f46e5" />
            </View>
          ) : (
            <View className="gap-2">
              <DatoPerfil label="Email" valor={user?.email ?? '—'} />
              <DatoPerfil label="Nombre" valor={nombre ?? '—'} />
              <DatoPerfil label="Apellido" valor={apellido ?? '—'} />
            </View>
          )}
          <Pressable
            onPress={() => router.push('/(app)/perfil/editar')}
            className="mt-3 h-10 items-center justify-center rounded-md border border-primary-600 bg-white active:bg-primary-50"
          >
            <Text className="text-sm font-semibold text-primary-600">
              Editar perfil
            </Text>
          </Pressable>
        </View>

        {/* Acciones de sesión */}
        <View className="mb-4 rounded-lg border border-slate-200 bg-white">
          <AccionItem
            titulo="Cerrar sesión"
            subtitulo="Salir de la app en este dispositivo"
            emoji="🚪"
            onPress={onSignOut}
            loading={signOutLoading}
            loadingText="Saliendo…"
          />
        </View>

        {/* Zona peligrosa: eliminar cuenta */}
        <View className="rounded-lg border border-red-200 bg-red-50 p-4">
          <Text className="text-sm font-semibold text-red-900">
            Zona peligrosa
          </Text>
          <Text className="mt-1 text-xs text-red-700">
            Esta acción es destructiva y no se puede deshacer. Si sos admin
            de uno o más grupos, primero tendrás que transferir el rol o
            eliminarlos.
          </Text>
          <Pressable
            onPress={() => router.push('/(app)/perfil/eliminar')}
            className="mt-3 h-11 items-center justify-center rounded-md bg-red-600 active:bg-red-700"
          >
            <Text className="text-sm font-semibold text-white">
              Eliminar mi cuenta
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DatoPerfil({ label, valor }: { label: string; valor: string }) {
  return (
    <View className="flex-row items-baseline justify-between border-b border-slate-100 pb-2">
      <Text className="text-xs font-medium text-slate-500">{label}</Text>
      <Text className="text-sm font-medium text-slate-900">{valor}</Text>
    </View>
  );
}

interface AccionItemProps {
  titulo: string;
  subtitulo: string;
  emoji: string;
  onPress: () => void;
  loading?: boolean;
  loadingText?: string;
}

function AccionItem({
  titulo,
  subtitulo,
  emoji,
  onPress,
  loading,
  loadingText,
}: AccionItemProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      className="flex-row items-center gap-3 p-4 active:bg-slate-50"
    >
      <Text className="text-2xl">{emoji}</Text>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900">{titulo}</Text>
        <Text className="mt-0.5 text-xs text-slate-500">{subtitulo}</Text>
      </View>
      <Text className="text-sm text-slate-400">
        {loading ? (loadingText ?? '…') : '→'}
      </Text>
    </Pressable>
  );
}
