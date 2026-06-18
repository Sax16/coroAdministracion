import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { LabeledInput } from '@/components/LabeledInput';
import { useEditarGrupo } from '@/features/grupos/hooks';
import { listarMisGrupos } from '@/features/grupos/api';

/**
 * Pantalla "Editar grupo" (RF-011).
 *
 * El Admin puede editar nombre y descripción del grupo. La RLS
 * "grupos: actualizar solo admin" valida que el usuario actual sea
 * admin antes de hacer el UPDATE.
 *
 * Decisiones de UX:
 * - Form pre-populado con los valores actuales (un fetch al montar).
 * - Validación cliente: nombre con 2+ chars (matchea el de "crear"),
 *   descripción opcional, ambos con maxLength.
 * - Al guardar, `router.back()` y el screen padre re-fetchea con
 *   `useFocusEffect`.
 * - Si el grupo activo en el store coincide con el que estamos
 *   editando, actualizamos también el nombre en el store para que el
 *   header del grupo (que muestra `grupoActivo.nombre`) se vea fresco
 *   sin esperar al refetch.
 */
export default function EditarGrupoScreen() {
  const router = useRouter();
  const { id: grupoId } = useLocalSearchParams<{ id: string }>();

  const { editar, loading, error, clearError } = useEditarGrupo();

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Carga inicial: trae los valores actuales del grupo para pre-popular.
  useEffect(() => {
    if (!grupoId) return;
    let cancelado = false;
    (async () => {
      const r = await listarMisGrupos();
      if (cancelado) return;
      if (!r.ok) {
        setLoadError(r.error);
        setHydrated(true);
        return;
      }
      const g = r.data.find((x) => x.id === grupoId);
      if (g) {
        setNombre(g.nombre);
        setDescripcion(g.descripcion ?? '');
      } else {
        setLoadError('No se encontró el grupo');
      }
      setHydrated(true);
    })();
    return () => {
      cancelado = true;
    };
  }, [grupoId]);

  const canSubmit = nombre.trim().length >= 2 && nombre.trim().length <= 80;

  const onSubmit = async () => {
    if (!canSubmit || !grupoId) return;
    const result = await editar({
      id: grupoId,
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
    });
    if (result) {
      router.back();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Editar grupo',
          headerBackTitle: 'Volver',
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-6">
            <Text className="text-2xl font-bold text-slate-900">
              Editar grupo
            </Text>
            <Text className="mt-2 text-sm text-slate-600">
              Cambiá el nombre o la descripción. Los demás miembros del
              grupo verán los datos actualizados.
            </Text>
          </View>

          {loadError ? (
            <View className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
              <Text className="text-sm text-red-700">{loadError}</Text>
            </View>
          ) : null}

          <LabeledInput
            label="Nombre del grupo"
            value={nombre}
            onChangeText={(t) => {
              clearError();
              setNombre(t);
            }}
            placeholder="Ej. Coro Renacer"
            autoCapitalize="words"
            maxLength={80}
            editable={!loading && hydrated}
          />

          <LabeledInput
            label="Descripción (opcional)"
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Una línea que describa al grupo"
            multiline
            numberOfLines={3}
            maxLength={200}
            editable={!loading && hydrated}
          />

          {error ? (
            <Text className="mb-3 text-sm text-red-600">{error}</Text>
          ) : null}

          <Button
            title="Guardar cambios"
            onPress={onSubmit}
            loading={loading}
            disabled={!canSubmit || !hydrated}
          />

          <Button
            title="Cancelar"
            onPress={() => router.back()}
            variant="secondary"
            style={{ marginTop: 12 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
