import { Stack, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useBuscarGrupos } from '@/features/solicitudes/hooks';

/**
 * Pantalla de búsqueda de grupos a los que el usuario puede solicitar
 * ingreso (RF-020).
 *
 * El usuario escribe el nombre del grupo, y la app hace `ilike %query%`
 * contra `public.grupos` (la RLS ya le permite ver todos los grupos
 * activos no soft-deleted). Cada resultado muestra un CTA "Solicitar
 * ingreso" que navega a la pantalla de confirmación.
 *
 * Decisiones:
 * - Búsqueda con debounce de 300ms (en el hook) para no pegarle a la
 *   DB en cada tecla.
 * - Si el grupo ya tiene al usuario como miembro activo o tiene
 *   solicitud pendiente, se muestra deshabilitado con un label
 *   explicativo.
 * - NO se exponen campos sensibles (admin_id, zona_horaria). La
 *   query proyecta solo id, nombre, descripcion.
 */
export default function BuscarGrupoScreen() {
  const router = useRouter();
  const { query, setQuery, resultados, loading, error } = useBuscarGrupos();

  return (
    <>
      <Stack.Screen options={{ title: 'Buscar grupo', headerBackTitle: 'Atrás' }} />

      <View className="flex-1 bg-slate-50">
        <View className="border-b border-slate-200 bg-white px-4 py-3">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Nombre del grupo"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            autoCorrect={false}
            className="h-12 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900"
          />
          {query.length > 0 && query.trim().length < 2 ? (
            <Text className="mt-2 text-xs text-slate-500">
              Escribí al menos 2 caracteres
            </Text>
          ) : null}
        </View>

        {error ? (
          <View className="m-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : null}

        {query.trim().length >= 2 ? (
          loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#4f46e5" />
            </View>
          ) : resultados.length === 0 ? (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-center text-base text-slate-700">
                No encontramos grupos con "{query.trim()}"
              </Text>
              <Text className="mt-2 text-center text-sm text-slate-500">
                Probá con otro nombre o creá tu propio grupo.
              </Text>
            </View>
          ) : (
            <View className="p-4">
              {resultados.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => {
                    if (!g.ya_es_miembro) {
                      router.push(`/(app)/buscar-grupo/${g.id}/solicitar`);
                    }
                  }}
                  disabled={g.ya_es_miembro}
                  className={`mb-2 rounded-lg border p-4 ${
                    g.ya_es_miembro
                      ? 'border-slate-200 bg-slate-50 opacity-60'
                      : 'border-slate-200 bg-white active:bg-slate-50'
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-slate-900">
                        {g.nombre}
                      </Text>
                      {g.descripcion ? (
                        <Text className="mt-1 text-sm text-slate-500" numberOfLines={2}>
                          {g.descripcion}
                        </Text>
                      ) : null}
                    </View>
                    {g.ya_es_miembro ? (
                      <View className="ml-2 rounded-full bg-slate-200 px-2.5 py-0.5">
                        <Text className="text-xs font-medium text-slate-600">
                          Ya sos parte
                        </Text>
                      </View>
                    ) : (
                      <Text className="ml-2 text-sm font-semibold text-primary-600">
                        Solicitar →
                      </Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )
        ) : (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-base text-slate-700">
              Buscá un grupo por nombre
            </Text>
            <Text className="mt-2 text-center text-sm text-slate-500">
              Si conocés el nombre del grupo al que querés sumarte, empezá
              a tipearlo arriba. Si no, creá tu propio grupo desde la
              pantalla de grupos.
            </Text>
          </View>
        )}
      </View>
    </>
  );
}
