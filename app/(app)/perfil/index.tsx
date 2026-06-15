import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
 * - Datos básicos: email, nombre, apellido (RF-005 los expone editables
 *   en una iteración futura; acá son read-only por ahora).
 * - Cerrar sesión (RF-003).
 * - Eliminar cuenta (RF-006) → navega al flujo destructivo.
 *
 * Decisiones de diseño:
 * - Single-source-of-truth para "quién soy": los datos se leen
 *   de `public.perfiles` (no de `auth.users`) porque esa es la fila
 *   que mantiene la app (trigger `handle_new_user` la crea al
 *   registrarse).
 * - El email puede tardar un instante en llegar del join; por eso
 *   mostramos skeleton mientras `loading`.
 * - El botón "Eliminar cuenta" está separado abajo, en zona roja,
 *   con confirmación obligatoria. NO es un click accidental.
 */
export default function PerfilScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { signOut, loading: signOutLoading } = useSignOut();

  const [nombre, setNombre] = useState<string | null>(null);
  const [apellido, setApellido] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase
        .from('perfiles')
        .select('nombre, apellido')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelado) return;
      if (!error && data) {
        setNombre(data.nombre);
        setApellido(data.apellido);
      }
      setLoading(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [user]);

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
          <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tu cuenta
          </Text>
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
          <Text className="mt-3 text-xs text-slate-400">
            La edición de estos datos llega en una próxima iteración
            (RF-005).
          </Text>
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
