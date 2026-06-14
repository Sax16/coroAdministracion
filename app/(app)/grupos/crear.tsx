import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { LabeledInput } from '@/components/LabeledInput';
import { useCrearGrupo } from '@/features/grupos/hooks';
import { useGrupoActivo } from '@/features/grupos/hooks';

/**
 * Pantalla "Crear grupo".
 *
 * RF-010: cualquier usuario registrado puede crear un nuevo grupo.
 * El creador se vuelve Admin automáticamente (lo hace la SECURITY DEFINER
 * function `crear_grupo()` en la DB).
 *
 * Después de crear, se selecciona automáticamente como grupo activo.
 */
export default function CrearGrupoScreen() {
  const router = useRouter();
  const { crear, loading, error, clearError } = useCrearGrupo();
  const { seleccionar } = useGrupoActivo();

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const canSubmit = nombre.trim().length >= 2;

  const onSubmit = async () => {
    if (!canSubmit) return;
    const result = await crear({
      nombre,
      descripcion: descripcion || undefined,
    });
    if (result) {
      // Seleccionarlo como grupo activo y volver al listado.
      seleccionar({
        id: result.id,
        nombre: nombre.trim(),
        rol: 'admin',
      });
      router.replace('/(app)/grupos');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerClassName="px-6 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-6">
          <Text className="text-2xl font-bold text-slate-900">Crear grupo</Text>
          <Text className="mt-2 text-sm text-slate-600">
            Vas a ser el Admin de este grupo. Después podés transferir el rol
            a otro miembro.
          </Text>
        </View>

        <LabeledInput
          label="Nombre del grupo"
          value={nombre}
          onChangeText={(t) => {
            clearError();
            setNombre(t);
          }}
          placeholder="Ej. Coro Renacer, Alabanza Central…"
          autoCapitalize="words"
          maxLength={80}
        />

        <LabeledInput
          label="Descripción (opcional)"
          value={descripcion}
          onChangeText={setDescripcion}
          placeholder="Una línea que describa al grupo"
          multiline
          numberOfLines={3}
          maxLength={200}
        />

        {error ? (
          <Text className="mb-3 text-sm text-red-600">{error}</Text>
        ) : null}

        <Button
          title="Crear grupo"
          onPress={onSubmit}
          loading={loading}
          disabled={!canSubmit}
        />

        <Button
          title="Cancelar"
          onPress={() => router.back()}
          variant="secondary"
          style={{ marginTop: 12 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
