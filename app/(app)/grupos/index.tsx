import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { GrupoConRol, listarMisGrupos } from '@/features/grupos/api';
import { useAuthStore } from '@/stores/auth';
import { useGrupoActivoStore } from '@/stores/grupoActivo';

/**
 * Pantalla principal post-login: lista de grupos del usuario.
 *
 * RF-016: el usuario ve todos los grupos a los que pertenece y su rol.
 * RF-015: el selector de grupo activo. Al tocar un grupo lo marcamos
 *   como activo y navegamos a "Mi semana" de ese grupo (RF-054).
 *
 * El sub-botón "Configurar patrón" (solo admin) sigue llevando directo
 * a la pantalla de patrón.
 *
 * **Acciones a nivel cuenta** (cerrar sesión, eliminar cuenta) viven
 * en la pantalla de Perfil (`/(app)/perfil`), accesible desde el botón
 * "Mi perfil" del header. Esto saca del listado de grupos todo lo que
 * no es sobre grupos.
 */
export default function GruposScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setGrupo = useGrupoActivoStore((s) => s.setGrupo);

  const [grupos, setGrupos] = useState<GrupoConRol[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const result = await listarMisGrupos();
    if (!result.ok) {
      setError(result.error);
      setGrupos([]);
    } else {
      setGrupos(result.data);
      setError(null);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const onAbrirGrupo = (g: GrupoConRol) => {
    setGrupo({ id: g.id, nombre: g.nombre, rol: g.rol });
    router.push(`/(app)/grupos/${g.id}`);
  };

  return (
    <View className="flex-1 bg-slate-50">
      <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-slate-900">Mis grupos</Text>
          <Text className="text-xs text-slate-500">{user?.email}</Text>
        </View>
        <Pressable
          onPress={() => router.push('/(app)/perfil')}
          className="rounded-md border border-slate-300 px-3 py-1.5 active:bg-slate-50"
        >
          <Text className="text-sm text-slate-700">Mi perfil</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push('/(app)/buscar-grupo')}
        className="mx-4 mt-3 h-11 items-center justify-center rounded-lg border border-primary-600 active:bg-primary-50"
      >
        <Text className="text-sm font-semibold text-primary-600">+ Buscar otro grupo</Text>
      </Pressable>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : grupos.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-lg font-semibold text-slate-700">
            Aún no pertenecés a ningún grupo
          </Text>
          <Text className="mt-2 text-center text-sm text-slate-500">
            Creá tu primer grupo para empezar a organizar servicios, ensayos y
            comunicados.
          </Text>
          <Pressable
            onPress={() => router.push('/(app)/grupos/crear')}
            className="mt-6 h-12 items-center justify-center rounded-lg bg-primary-600 px-6 active:bg-primary-700"
          >
            <Text className="text-base font-semibold text-white">
              Crear mi primer grupo
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={grupos}
          keyExtractor={(g) => g.id}
          contentContainerClassName="p-4"
          ItemSeparatorComponent={() => <View className="h-3" />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onAbrirGrupo(item)}
              className="rounded-lg border border-slate-200 bg-white p-4 active:bg-slate-50"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-slate-900">
                  {item.nombre}
                </Text>
                <View
                  className={`rounded-full px-2 py-0.5 ${
                    item.rol === 'admin' ? 'bg-primary-100' : 'bg-slate-100'
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      item.rol === 'admin' ? 'text-primary-700' : 'text-slate-600'
                    }`}
                  >
                    {item.rol === 'admin' ? 'Admin' : 'Miembro'}
                  </Text>
                </View>
              </View>
              {item.descripcion ? (
                <Text className="mt-1 text-sm text-slate-500">
                  {item.descripcion}
                </Text>
              ) : null}
              <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-xs font-medium text-primary-600">
                  Mi semana →
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => router.push(`/(app)/grupos/${item.id}/comunicados`)}
                    hitSlop={8}
                    className="rounded-md px-2 py-1 active:bg-slate-100"
                  >
                    <Text className="text-xs font-medium text-slate-500">Comunicados</Text>
                  </Pressable>
                  {item.rol === 'admin' ? (
                    <>
                      <Pressable
                        onPress={() => router.push(`/(app)/grupos/${item.id}/ensayos`)}
                        hitSlop={8}
                        className="rounded-md px-2 py-1 active:bg-slate-100"
                      >
                        <Text className="text-xs font-medium text-slate-500">Ensayos</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => router.push(`/(app)/grupos/${item.id}/patron`)}
                        hitSlop={8}
                        className="rounded-md px-2 py-1 active:bg-slate-100"
                      >
                        <Text className="text-xs font-medium text-slate-500">Patrón</Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      {error ? (
        <View className="border-t border-red-200 bg-red-50 px-4 py-3">
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      ) : null}
    </View>
  );
}
