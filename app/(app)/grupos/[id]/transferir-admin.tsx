import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listarMiembrosActivos } from '@/features/asignaciones/api';
import { MiembroGrupo } from '@/features/asignaciones/types';
import { listarMisGrupos } from '@/features/grupos/api';
import { useAccionesGrupo } from '@/features/grupos/hooks';
import { useAuthStore } from '@/stores/auth';

/**
 * Pantalla "Transferir admin" (RF-013).
 *
 * Muestra la lista de miembros activos del grupo (excluyendo al admin
 * actual) y permite elegir uno. Al confirmar, llama a la SECURITY
 * DEFINER `transferir_admin(grupo_id, nuevo_admin_usuario_grupo_id)`.
 *
 * **Doble confirmación** (RNF-014): después de elegir al nuevo admin,
 *   un Alert pide confirmación explícita mostrando a quién se transfiere.
 *
 * Esta pantalla se usa desde dos lugares:
 *  1. Home del grupo (acción admin) — `origen` no viene en la URL.
 *  2. Flujo "Eliminar mi cuenta" (RF-006) — `origen=eliminar-cuenta`,
 *     para volver a la pantalla de eliminar después de transferir.
 */
export default function TransferirAdminScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; origen?: string }>();
  const grupoId = params.id;
  const origen = params.origen;

  const user = useAuthStore((s) => s.user);
  const { transferir, loading, error, clearError } = useAccionesGrupo();

  const [nombreGrupo, setNombreGrupo] = useState<string | null>(null);
  const [candidatos, setCandidatos] = useState<MiembroGrupo[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [seleccionado, setSeleccionado] = useState<MiembroGrupo | null>(null);

  const load = useCallback(async () => {
    if (!grupoId) return;
    setLoadingList(true);

    // 1. Nombre del grupo (para el header)
    const gRes = await listarMisGrupos();
    if (gRes.ok) {
      setNombreGrupo(gRes.data.find((g) => g.id === grupoId)?.nombre ?? null);
    }

    // 2. Miembros activos (reusamos el helper de asignaciones)
    const mRes = await listarMiembrosActivos(grupoId);
    if (mRes.ok) {
      // Excluimos al admin actual de la lista. La función
      // `listarMiembrosActivos` ya ordena admins primero, así que el
      // admin actual queda en la primera fila. Filtramos por id.
      const yoId = user?.id;
      setCandidatos(mRes.data.filter((m) => m.usuario_id !== yoId));
    }
    setLoadingList(false);
  }, [grupoId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const onConfirmar = useCallback(async () => {
    if (!seleccionado || !grupoId) return;
    Alert.alert(
      'Transferir administración',
      `Vas a transferir el rol de Admin a ${seleccionado.nombre} ${seleccionado.apellido}. Vas a quedar como Miembro.\n\n¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, transferir',
          onPress: async () => {
            const ok = await transferir({
              grupoId,
              nuevoAdminUsuarioGrupoId: seleccionado.usuario_grupo_id,
            });
            if (ok) {
              if (origen === 'eliminar-cuenta') {
                // Volvemos al flujo de eliminar cuenta, no al home.
                router.replace('/(app)/perfil/eliminar');
              } else {
                router.back();
              }
            }
          },
        },
      ],
    );
  }, [seleccionado, grupoId, transferir, router, origen]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Transferir admin',
          headerBackTitle: 'Volver',
        }}
      />

      <View className="px-4 pt-4">
        <Text className="text-sm text-slate-600">
          Grupo:{' '}
          <Text className="font-semibold text-slate-900">
            {nombreGrupo ?? '…'}
          </Text>
        </Text>
        <Text className="mt-1 text-xs text-slate-500">
          Elegí al nuevo admin. Solo miembros activos del grupo aparecen en
          la lista. Vas a quedar como Miembro.
        </Text>
      </View>

      {loadingList ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : candidatos.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base font-semibold text-slate-700">
            No hay otros miembros activos
          </Text>
          <Text className="mt-2 text-center text-sm text-slate-500">
            No podés transferir el rol porque sos el único miembro activo
            del grupo. Si querés, podés eliminar el grupo desde el flujo
            "Eliminar mi cuenta".
          </Text>
        </View>
      ) : (
        <FlatList
          data={candidatos}
          keyExtractor={(m) => m.usuario_grupo_id}
          contentContainerClassName="p-4"
          ItemSeparatorComponent={() => <View className="h-2" />}
          renderItem={({ item }) => (
            <CandidatoRow
              miembro={item}
              seleccionado={seleccionado?.usuario_grupo_id === item.usuario_grupo_id}
              onPress={() => {
                clearError();
                setSeleccionado(item);
              }}
              disabled={loading}
            />
          )}
        />
      )}

      {error ? (
        <View className="border-t border-red-200 bg-red-50 px-4 py-2">
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      ) : null}

      <View className="border-t border-slate-200 bg-white p-4">
        <Pressable
          onPress={onConfirmar}
          disabled={!seleccionado || loading}
          className={`h-12 items-center justify-center rounded-lg ${
            seleccionado && !loading
              ? 'bg-primary-600 active:bg-primary-700'
              : 'bg-slate-300'
          }`}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text
              className={`text-base font-semibold ${
                seleccionado ? 'text-white' : 'text-slate-500'
              }`}
            >
              {seleccionado
                ? `Transferir a ${seleccionado.nombre}`
                : 'Elegí un miembro'}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

interface CandidatoRowProps {
  miembro: MiembroGrupo;
  seleccionado: boolean;
  onPress: () => void;
  disabled: boolean;
}

function CandidatoRow({
  miembro,
  seleccionado,
  onPress,
  disabled,
}: CandidatoRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center gap-3 rounded-lg border p-3 ${
        seleccionado
          ? 'border-primary-600 bg-primary-50'
          : 'border-slate-200 bg-white active:bg-slate-50'
      }`}
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
          seleccionado
            ? 'border-primary-600 bg-primary-600'
            : 'border-slate-300 bg-white'
        }`}
      >
        {seleccionado ? (
          <View className="h-2 w-2 rounded-full bg-white" />
        ) : null}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900">
          {miembro.nombre} {miembro.apellido}
        </Text>
        <Text className="mt-0.5 text-xs text-slate-500 capitalize">
          {miembro.rol}
        </Text>
      </View>
    </Pressable>
  );
}
