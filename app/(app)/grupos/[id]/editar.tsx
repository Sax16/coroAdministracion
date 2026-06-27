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
import { useEditarGrupo, useMisGrupos } from '@/features/grupos/hooks';

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

  const editarGrupo = useEditarGrupo();
  const { data: misGrupos } = useMisGrupos();

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [hydrated, setHydrated] = useState(false);

  // Pre-popular el form desde el grupo cacheado, una sola vez.
  useEffect(() => {
    if (hydrated || !misGrupos) return;
    const g = misGrupos.find((x) => x.id === grupoId);
    if (g) {
      setNombre(g.nombre);
      setDescripcion(g.descripcion ?? '');
    }
    setHydrated(true);
  }, [misGrupos, grupoId, hydrated]);

  const canSubmit = nombre.trim().length >= 2 && nombre.trim().length <= 80;

  const onSubmit = async () => {
    if (!canSubmit || !grupoId) return;
    try {
      await editarGrupo.mutateAsync({
        id: grupoId,
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
      });
      router.back();
    } catch {
      // Error mostrado vía editarGrupo.error.
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

          <LabeledInput
            label="Nombre del grupo"
            value={nombre}
            onChangeText={(t) => {
              editarGrupo.reset();
              setNombre(t);
            }}
            placeholder="Ej. Coro Renacer"
            autoCapitalize="words"
            maxLength={80}
            editable={!editarGrupo.isPending && hydrated}
          />

          <LabeledInput
            label="Descripción (opcional)"
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Una línea que describa al grupo"
            multiline
            numberOfLines={3}
            maxLength={200}
            editable={!editarGrupo.isPending && hydrated}
          />

          {editarGrupo.error ? (
            <Text className="mb-3 text-sm text-red-600">{editarGrupo.error.message}</Text>
          ) : null}

          <Button
            title="Guardar cambios"
            onPress={onSubmit}
            loading={editarGrupo.isPending}
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
