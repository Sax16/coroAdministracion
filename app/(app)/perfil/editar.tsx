import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
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
import { useActualizarPerfil } from '@/features/auth/hooks';
import { useAuthStore } from '@/stores/auth';
import { supabase } from '@/lib/supabase';

/**
 * Pantalla "Editar perfil" (RF-005).
 *
 * Permite editar nombre y apellido del usuario actual. El email es de
 * solo lectura en esta pantalla porque vive en `auth.users` y cambiarlo
 * requiere un flujo de confirmación por email (lo maneja Supabase Auth
 * y queda fuera del MVP).
 *
 * Foto y teléfono también son editables per RF-005, pero requieren:
 *   - Foto: Supabase Storage bucket + policies + `expo-image-picker`.
 *   - Teléfono: caso de uso aún no modelado en la app.
 * Se documentan como v0.2.0.
 *
 * Decisiones de UX:
 * - Form pre-populado con los valores actuales (un fetch al montar).
 * - Validación cliente: nombre y apellido con 1+ char, máx 80.
 *   Matchea el constraint `not null` de la DB; el largo máximo es
 *   defensivo para evitar inputs accidentales enormes.
 * - Al guardar, `router.back()` y el screen padre re-fetchea con
 *   `useFocusEffect`.
 */
export default function EditarPerfilScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { actualizar, loading, error, clearError } = useActualizarPerfil();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Carga inicial: trae los valores actuales para pre-popular el form.
  if (user && !hydrated) {
    void (async () => {
      const { data } = await supabase
        .from('perfiles')
        .select('nombre, apellido')
        .eq('id', user.id)
        .maybeSingle();
      if (data) {
        setNombre(data.nombre ?? '');
        setApellido(data.apellido ?? '');
      }
      setHydrated(true);
    })();
  }

  const canSubmit =
    nombre.trim().length >= 1 &&
    apellido.trim().length >= 1 &&
    nombre.trim().length <= 80 &&
    apellido.trim().length <= 80;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitError(null);
    const result = await actualizar({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
    });
    if (result) {
      router.back();
    } else {
      // El error ya está en `error` del hook; lo dejamos que se muestre
      // abajo. setSubmitError queda reservado para errores no-SQL.
      setSubmitError(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Editar perfil',
          headerBackTitle: 'Perfil',
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
              Editar perfil
            </Text>
            <Text className="mt-2 text-sm text-slate-600">
              Cambiá tu nombre y apellido. El resto de los miembros del grupo
              verán estos datos en los listados y comunicados.
            </Text>
          </View>

          <LabeledInput
            label="Nombre"
            value={nombre}
            onChangeText={(t) => {
              clearError();
              setNombre(t);
            }}
            placeholder="Tu nombre"
            autoCapitalize="words"
            maxLength={80}
            editable={!loading}
          />

          <LabeledInput
            label="Apellido"
            value={apellido}
            onChangeText={(t) => {
              clearError();
              setApellido(t);
            }}
            placeholder="Tu apellido"
            autoCapitalize="words"
            maxLength={80}
            editable={!loading}
          />

          <View className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <Text className="text-xs text-slate-500">
              <Text className="font-semibold text-slate-700">Email: </Text>
              {user?.email ?? '—'}
              {'\n'}
              El email no se puede cambiar desde acá. Si necesitás cambiarlo,
              contactá al administrador.
            </Text>
          </View>

          {error || submitError ? (
            <Text className="mb-3 text-sm text-red-600">
              {error ?? submitError}
            </Text>
          ) : null}

          <Button
            title="Guardar cambios"
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
    </SafeAreaView>
  );
}
