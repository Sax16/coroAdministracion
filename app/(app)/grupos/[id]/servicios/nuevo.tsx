import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { DatePickerField } from '@/components/DatePickerField';
import { LabeledInput } from '@/components/LabeledInput';
import { TimePickerField } from '@/components/TimePickerField';
import { useCrearServicioExcepcional } from '@/features/servicios/hooks';
import {
  combineLocalDateTime,
  dateToHHMM,
  hhmmToDate,
} from '@/lib/dateTime';

/**
 * Pantalla "Nuevo servicio excepcional" (RF-043).
 *
 * Permite al Admin crear un servicio fuera del patrón recurrente
 * (ej. "Servicio especial viernes 21:00"). Se inserta en
 * `public.servicios` con `patron_id = NULL` para que el trigger de
 * generación NO lo pise en la próxima corrida.
 *
 * Decisiones de UX:
 * - Fecha y hora con DatePickerField + TimePickerField (wrappers sobre
 *   `@react-native-community/datetimepicker`). Mucho mejor UX que tipear
 *   "DD/MM/AAAA" a mano.
 * - Trabajamos en hora local: el form arma un `Date` local y lo manda
 *   a Supabase como ISO UTC. El listado y "mi semana" lo formatean de
 *   vuelta a local con `formatearHora()`.
 * - Validación cliente: título no vacío (1-120), fecha no en el
 *   pasado, hora válida (0-23 / 0-59), lugar y descripción opcionales.
 * - `minDate` en el DatePickerField = hoy (no se puede elegir pasado).
 *
 * Al guardar, `router.back()`. La vista semanal (RF-050) re-fetchea
 * con `useFocusEffect`, así que el servicio nuevo aparece al volver.
 */
export default function NuevoServicioExcepcionalScreen() {
  const router = useRouter();
  const { id: grupoId } = useLocalSearchParams<{ id: string }>();

  const { crear, loading, error, clearError } = useCrearServicioExcepcional();

  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState<Date | null>(null);
  const [hora, setHora] = useState<Date | null>(hhmmToDate('19:00'));
  const [lugar, setLugar] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});

  const parsedFechaHora = useMemo(() => {
    if (!fecha || !hora) {
      return { ok: false as const, error: 'Completá fecha y hora' };
    }
    const iso = combineLocalDateTime(fecha, dateToHHMM(hora));
    if (!iso) return { ok: false as const, error: 'Hora inválida' };
    // No en el pasado (margen 1 min)
    if (new Date(iso).getTime() < Date.now() - 60_000) {
      return { ok: false as const, error: 'La fecha y hora no pueden ser en el pasado' };
    }
    return { ok: true as const, iso };
  }, [fecha, hora]);

  const canSubmit =
    titulo.trim().length >= 1 &&
    titulo.trim().length <= 120 &&
    parsedFechaHora.ok &&
    (lugar.length === 0 || lugar.length <= 200) &&
    (descripcion.length === 0 || descripcion.length <= 500);

  const onSubmit = async () => {
    // Forzar mostrar errores inline si los hay
    const e: Record<string, string> = {};
    if (!titulo.trim()) e.titulo = 'El título es obligatorio';
    if (!fecha) e.fecha = 'Seleccioná una fecha';
    if (!hora) e.hora = 'Seleccioná una hora';
    if (Object.keys(e).length > 0) {
      setErrores(e);
      return;
    }
    if (!parsedFechaHora.ok || !grupoId) {
      setErrores({ fecha: parsedFechaHora.ok ? '' : parsedFechaHora.error });
      return;
    }

    setErrores({});
    const r = await crear({
      grupoId,
      titulo,
      fechaInicio: parsedFechaHora.iso,
      lugar: lugar.trim() || null,
      descripcion: descripcion.trim() || null,
    });
    if (r) {
      router.back();
    }
  };

  // minDate: hoy a las 00:00 local (no permite días pasados)
  const minDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Nuevo servicio excepcional',
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
              Servicio excepcional
            </Text>
            <Text className="mt-2 text-sm text-slate-600">
              Para un servicio puntual fuera del patrón recurrente. Ej: un
              servicio especial de viernes 21:00, una fecha única, etc.
            </Text>
          </View>

          <LabeledInput
            label="Título"
            value={titulo}
            onChangeText={(t) => {
              clearError();
              setErrores((prev) => ({ ...prev, titulo: '' }));
              setTitulo(t);
            }}
            placeholder="Ej. Servicio especial de viernes"
            autoCapitalize="sentences"
            maxLength={120}
            error={errores.titulo}
            editable={!loading}
          />

          <View className="flex-row gap-3">
            <View className="flex-1">
              <DatePickerField
                label="Fecha"
                value={fecha}
                onChange={(d) => {
                  clearError();
                  setErrores((prev) => ({ ...prev, fecha: '' }));
                  setFecha(d);
                }}
                minDate={minDate}
                error={errores.fecha}
              />
            </View>
            <View className="flex-1">
              <TimePickerField
                label="Hora"
                value={hora}
                onChange={(d) => {
                  clearError();
                  setErrores((prev) => ({ ...prev, hora: '' }));
                  setHora(d);
                }}
                error={errores.hora}
              />
            </View>
          </View>

          <LabeledInput
            label="Lugar (opcional)"
            value={lugar}
            onChangeText={setLugar}
            placeholder="Ej. Templo principal, Salón..."
            maxLength={200}
            editable={!loading}
          />

          <LabeledInput
            label="Descripción / notas (opcional)"
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Notas para el equipo, canciones, etc."
            multiline
            numberOfLines={3}
            maxLength={500}
            editable={!loading}
          />

          {error ? (
            <Text className="mb-3 text-sm text-red-600">{error}</Text>
          ) : null}

          <Button
            title="Crear servicio"
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
