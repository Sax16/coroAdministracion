import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useEliminarGrupo, useMisGrupos } from '@/features/grupos/hooks';
import { supabase } from '@/lib/supabase';
import { useGrupoActivoStore } from '@/stores/grupoActivo';

/**
 * Pantalla "Eliminar grupo" (RF-012).
 *
 * Soft delete vía la SECURITY DEFINER `eliminar_grupo(grupo_id)`. La
 * DB hace `grupos.deleted_at = now()` + `usuarios_grupos.estado = 'inactivo'`
 * para todos en una transacción.
 *
 * **Lo que se conserva:** servicios, ensayos, comunicados, asignaciones,
 * historial. **Lo que desaparece:** visibilidad del grupo para los
 * miembros (queda en estado inactivo, `usuario_grupos_activos` devuelve 0).
 *
 * Decisiones de UX:
 * - Resumen explícito de qué se va a borrar (RNF-014: doble confirmación
 *   destructiva con resumen).
 * - Tipeo de "ELIMINAR" como segunda barrera (mismo patrón que eliminar
 *   cuenta, para consistencia).
 * - Si el grupo eliminado era el activo, limpiamos el store para que la
 *   app no quede apuntando a un grupo "fantasma".
 */
export default function EliminarGrupoScreen() {
  const router = useRouter();
  const { id: grupoId } = useLocalSearchParams<{ id: string }>();
  const eliminarGrupo = useEliminarGrupo();
  const grupoActivo = useGrupoActivoStore((s) => s.grupo);
  const setGrupo = useGrupoActivoStore((s) => s.setGrupo);

  const { data: misGrupos } = useMisGrupos();
  const grupoActual = misGrupos?.find((g) => g.id === grupoId);
  const nombre = grupoActual?.nombre ?? null;
  const descripcion = grupoActual?.descripcion ?? null;

  const [miembrosCount, setMiembrosCount] = useState<number | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [confirmText, setConfirmText] = useState('');

  const puedeConfirmar = confirmText.trim().toUpperCase() === 'ELIMINAR';

  // Traemos el count de miembros activos para mostrarlo en el resumen.
  useEffect(() => {
    if (!grupoId) return;
    let cancelado = false;
    (async () => {
      const { count } = await supabase
        .from('usuarios_grupos')
        .select('id', { count: 'exact', head: true })
        .eq('grupo_id', grupoId)
        .eq('estado', 'activo');
      if (!cancelado) {
        setMiembrosCount(count ?? 0);
        setLoadingInfo(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [grupoId]);

  const onConfirmar = useCallback(() => {
    if (!puedeConfirmar || !grupoId) return;
    Alert.alert(
      'Última confirmación',
      `Vas a eliminar el grupo "${nombre ?? ''}" de forma permanente. Esta acción no se puede deshacer.\n\n¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarGrupo.mutateAsync(grupoId);
              if (grupoActivo?.id === grupoId) setGrupo(null);
              router.replace('/(app)/grupos');
            } catch {
              // Error mostrado vía eliminarGrupo.error.
            }
          },
        },
      ],
    );
  }, [puedeConfirmar, grupoId, eliminarGrupo, router, nombre, grupoActivo, setGrupo]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Eliminar grupo',
          headerBackTitle: 'Volver',
        }}
      />

      <ScrollView
        contentContainerClassName="p-4 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        {loadingInfo ? (
          <View className="items-center py-4">
            <ActivityIndicator color="#4f46e5" />
          </View>
        ) : (
          <>
            {/* Resumen del grupo */}
            <View className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
              <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Vas a eliminar
              </Text>
              <Text className="mt-1 text-lg font-bold text-slate-900">
                {nombre ?? 'Grupo'}
              </Text>
              {descripcion ? (
                <Text className="mt-1 text-sm text-slate-600">
                  {descripcion}
                </Text>
              ) : null}
              {miembrosCount !== null ? (
                <View className="mt-3 flex-row gap-4">
                  <View className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                    <Text className="text-[10px] uppercase tracking-wide text-slate-500">
                      Miembros activos
                    </Text>
                    <Text className="text-base font-bold text-slate-900">
                      {miembrosCount}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            {/* Lo que se conserva y lo que no */}
            <View className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <Text className="text-sm font-semibold text-amber-900">
                ¿Qué pasa con los datos?
              </Text>
              <View className="mt-2 gap-1.5">
                <Consecuencia
                  emoji="✅"
                  texto="Se conservan los servicios, ensayos, comunicados y asignaciones en el historial."
                />
                <Consecuencia
                  emoji="❌"
                  texto="El grupo deja de ser visible para todos los miembros."
                />
                <Consecuencia
                  emoji="❌"
                  texto="Los miembros quedan inactivos en este grupo (no se borran sus perfiles)."
                />
                <Consecuencia
                  emoji="⚠️"
                  texto="La acción es IRREVERSIBLE: no hay forma de restaurar un grupo eliminado."
                />
              </View>
            </View>

            {/* Confirmación tipeada */}
            <View className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
              <Text className="text-sm font-semibold text-slate-900">
                Para confirmar, escribí{' '}
                <Text className="font-mono text-red-600">ELIMINAR</Text>
              </Text>
              <TextInput
                value={confirmText}
                onChangeText={(t) => {
                  eliminarGrupo.reset();
                  setConfirmText(t);
                }}
                editable={!eliminarGrupo.isPending}
                placeholder="ELIMINAR"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
                autoCorrect={false}
                className="mt-3 h-12 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900"
              />
              {eliminarGrupo.error ? (
                <Text className="mt-2 text-sm text-red-600">{eliminarGrupo.error.message}</Text>
              ) : null}
            </View>

            <Pressable
              onPress={onConfirmar}
              disabled={!puedeConfirmar || eliminarGrupo.isPending}
              className={`h-12 items-center justify-center rounded-lg ${
                puedeConfirmar && !eliminarGrupo.isPending
                  ? 'bg-red-600 active:bg-red-700'
                  : 'bg-slate-300'
              }`}
            >
              {eliminarGrupo.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text
                  className={`text-base font-semibold ${
                    puedeConfirmar ? 'text-white' : 'text-slate-500'
                  }`}
                >
                  Eliminar grupo definitivamente
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              disabled={eliminarGrupo.isPending}
              className="mt-3 h-11 items-center justify-center rounded-lg border border-slate-300 bg-white active:bg-slate-50"
            >
              <Text className="text-sm font-semibold text-slate-700">
                Cancelar
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Consecuencia({ emoji, texto }: { emoji: string; texto: string }) {
  return (
    <View className="flex-row gap-2">
      <Text className="text-amber-900">{emoji}</Text>
      <Text className="flex-1 text-xs text-amber-900">{texto}</Text>
    </View>
  );
}
