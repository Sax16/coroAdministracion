import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { useGestionJustificacion, useMiEstadoEnServicio } from '@/features/asistencia/hooks';
import { ESTADO_COLORS, ESTADO_LABELS } from '@/features/asistencia/types';
import { formatearDiaLargo, formatearHora } from '@/features/asignaciones/types';

/**
 * Pantalla para que el MIEMBRO justifique su inasistencia (RF-096).
 *
 * Solo accesible para miembros que están asignados al servicio y cuyo
 * estado es `no_asistio` o `justificado` (es decir, el responsable ya
 * marcó que no fueron). El miembro puede escribir texto libre.
 *
 * Decisiones:
 * - Si el estado es `asistio`, mostramos mensaje "No necesitás
 *   justificar" y no dejamos editar.
 * - El texto se persiste en `justificaciones_servicio` (1 por
 *   miembro-servicio; UPSERT).
 * - No hay push al responsable: la justificación se ve al abrir la
 *   pantalla de cierre (RF-092).
 */
export default function JustificarScreen() {
  const router = useRouter();
  const { servicioId } = useLocalSearchParams<{ servicioId: string }>();

  const { miEstado, loading, refetch } = useMiEstadoEnServicio(servicioId ?? '');
  const { guardar, loading: guardando, error } = useGestionJustificacion();

  const [texto, setTexto] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Inicializar el texto con la justificación existente
  useEffect(() => {
    if (!initialized && miEstado) {
      setTexto(miEstado.justificacion ?? '');
      setInitialized(true);
    }
  }, [miEstado, initialized]);

  const onGuardar = useCallback(async () => {
    if (!servicioId) return;
    const result = await guardar(servicioId, texto);
    if (result.ok) {
      await refetch();
      Alert.alert('Justificación enviada', 'El responsable del servicio podrá verla.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }, [servicioId, texto, guardar, refetch, router]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!miEstado) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Stack.Screen options={{ title: 'Justificar' }} />
        <Text className="text-center text-base font-semibold text-slate-700">
          No estás asignado a este servicio
        </Text>
      </View>
    );
  }

  const colors = ESTADO_COLORS[miEstado.estado];
  const puedeJustificar = miEstado.estado === 'no_asistio' || miEstado.estado === 'justificado';

  return (
    <>
      <Stack.Screen options={{ title: 'Justificar', headerBackTitle: 'Atrás' }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-slate-50"
      >
        <ScrollView contentContainerClassName="pb-10" keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View className="m-4 rounded-lg border border-slate-200 bg-white p-4">
            <Text className="text-sm text-slate-500">
              {formatearDiaLargo(new Date(miEstado.servicio.fecha_inicio))}
            </Text>
            <Text className="mt-1 text-2xl font-bold text-slate-900">
              {formatearHora(miEstado.servicio.fecha_inicio)}
            </Text>
            {miEstado.servicio.titulo ? (
              <Text className="text-sm text-slate-700">{miEstado.servicio.titulo}</Text>
            ) : null}
            <View className="mt-3 flex-row items-center gap-2">
              <Text className="text-sm text-slate-600">Tu estado actual:</Text>
              <View className={`self-start rounded-full px-2.5 py-0.5 ${colors.bg}`}>
                <Text className={`text-xs font-medium ${colors.fg}`}>
                  {ESTADO_LABELS[miEstado.estado]}
                </Text>
              </View>
            </View>
          </View>

          {puedeJustificar ? (
            <View className="mx-4 mb-3 rounded-lg border border-slate-200 bg-white p-4">
              <Text className="text-base font-semibold text-slate-900">
                Tu justificación
              </Text>
              <Text className="mt-1 text-xs text-slate-500">
                Contale al responsable del servicio por qué no pudiste asistir.
                Tu justificación será visible para todos los miembros del grupo.
              </Text>

              <TextInput
                value={texto}
                onChangeText={setTexto}
                placeholder="Ej: Me enfermé, estuve con fiebre hasta el lunes..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                className="mt-3 min-h-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900"
              />

              {error ? (
                <View className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                  <Text className="text-sm text-red-700">{error}</Text>
                </View>
              ) : null}

              <View className="mt-4 flex-row gap-3">
                <View className="flex-1">
                  <Button title="Cancelar" variant="secondary" onPress={() => router.back()} />
                </View>
                <View className="flex-1">
                  <Button
                    title={miEstado.justificacion ? 'Actualizar' : 'Enviar'}
                    onPress={onGuardar}
                    loading={guardando}
                    disabled={!texto.trim()}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View className="mx-4 mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <Text className="text-sm text-emerald-800">
                Tu estado actual es <Text className="font-semibold">Asistió</Text>, así que
                no necesitás justificar. Si esto es un error, contactá al responsable
                del servicio.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
