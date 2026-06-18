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
import { LabeledInput } from '@/components/LabeledInput';
import { useCrearServicioExcepcional } from '@/features/servicios/hooks';

/**
 * Pantalla "Nuevo servicio excepcional" (RF-043).
 *
 * Permite al Admin crear un servicio fuera del patrón recurrente
 * (ej. "Servicio especial viernes 21:00"). Se inserta en
 * `public.servicios` con `patron_id = NULL` para que el trigger de
 * generación NO lo pise en la próxima corrida.
 *
 * Decisiones de UX:
 * - Inputs de fecha y hora MANUALES (no usamos `expo-date-time-picker`
 *   para no sumar una dependencia en el MVP). Formatos:
 *     - Fecha: `DD/MM/AAAA` con `inputMode="numeric"`.
 *     - Hora: `HH:MM` (24h) con `inputMode="numeric"`.
 *   El form arma un `Date` local y lo manda a Supabase como ISO UTC.
 *   El listado y "mi semana" lo formatean de vuelta a local con
 *   `formatearHora()`.
 * - Validación cliente: título no vacío (1-120), fecha no en el
 *   pasado, hora válida (0-23 / 0-59), lugar y descripción opcionales.
 *   Si la fecha/hora no parsea, mostramos error inline.
 * - La DB enforcea `fecha_inicio not null` y `grupo_id not null`; la
 *   RLS exige admin del grupo. Lo dejamos así.
 *
 * Al guardar, `router.back()`. La vista semanal (RF-050) re-fetchea
 * con `useFocusEffect`, así que el servicio nuevo aparece al volver.
 */
export default function NuevoServicioExcepcionalScreen() {
  const router = useRouter();
  const { id: grupoId } = useLocalSearchParams<{ id: string }>();

  const { crear, loading, error, clearError } = useCrearServicioExcepcional();

  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState(''); // DD/MM/AAAA
  const [hora, setHora] = useState(''); // HH:MM
  const [lugar, setLugar] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const parsedFechaHora = useMemo(() => parseFechaHora(fecha, hora), [fecha, hora]);

  const canSubmit =
    titulo.trim().length >= 1 &&
    titulo.trim().length <= 120 &&
    parsedFechaHora.ok &&
    (lugar.length === 0 || lugar.length <= 200) &&
    (descripcion.length === 0 || descripcion.length <= 500);

  const onSubmit = async () => {
    if (!canSubmit || !grupoId) {
      // Forzamos mostrar el error inline
      if (!parsedFechaHora.ok) setValidationError(parsedFechaHora.error);
      return;
    }
    setValidationError(null);
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
              setValidationError(null);
              setTitulo(t);
            }}
            placeholder="Ej. Servicio especial de viernes"
            autoCapitalize="sentences"
            maxLength={120}
            editable={!loading}
          />

          <View className="mt-2 flex-row gap-3">
            <View className="flex-1">
              <LabeledInput
                label="Fecha"
                value={fecha}
                onChangeText={(t) => {
                  clearError();
                  setValidationError(null);
                  setFecha(t);
                }}
                placeholder="DD/MM/AAAA"
                inputMode="numeric"
                maxLength={10}
                editable={!loading}
              />
            </View>
            <View className="flex-1">
              <LabeledInput
                label="Hora"
                value={hora}
                onChangeText={(t) => {
                  clearError();
                  setValidationError(null);
                  setHora(t);
                }}
                placeholder="HH:MM"
                inputMode="numeric"
                maxLength={5}
                editable={!loading}
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

          {validationError ? (
            <Text className="mb-3 text-sm text-red-600">{validationError}</Text>
          ) : null}
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

// =============================================================================
// Helper: parsear "DD/MM/AAAA" + "HH:MM" a ISO UTC
// =============================================================================

type ParsedFechaHora =
  | { ok: true; iso: string }
  | { ok: false; error: string };

/**
 * Parsea una fecha en formato `DD/MM/AAAA` y hora `HH:MM` (24h) y
 * devuelve el timestamp en ISO UTC. Valida:
 * - Fecha con formato y rangos correctos (día 1-31, mes 1-12, año
 *   razonable).
 * - Hora con formato y rangos (0-23, 0-59).
 * - Que la fecha resultante no esté en el pasado (con un margen de
 *   1 minuto para evitar líos con la hora actual).
 */
function parseFechaHora(fecha: string, hora: string): ParsedFechaHora {
  if (!fecha.trim() || !hora.trim()) {
    return { ok: false, error: 'Completá fecha y hora' };
  }

  const fechaMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fecha.trim());
  if (!fechaMatch) {
    return { ok: false, error: 'La fecha tiene que ser DD/MM/AAAA' };
  }
  const [, dd, mm, aaaa] = fechaMatch;
  const dia = Number(dd);
  const mes = Number(mm);
  const anio = Number(aaaa);

  if (mes < 1 || mes > 12) {
    return { ok: false, error: 'Mes inválido (1-12)' };
  }
  if (dia < 1 || dia > 31) {
    return { ok: false, error: 'Día inválido (1-31)' };
  }
  if (anio < 2024 || anio > 2099) {
    return { ok: false, error: 'Año fuera de rango' };
  }

  const horaMatch = /^(\d{2}):(\d{2})$/.exec(hora.trim());
  if (!horaMatch) {
    return { ok: false, error: 'La hora tiene que ser HH:MM (24h)' };
  }
  const [, hh, min] = horaMatch;
  const h = Number(hh);
  const m = Number(min);
  if (h < 0 || h > 23) {
    return { ok: false, error: 'Hora inválida (0-23)' };
  }
  if (m < 0 || m > 59) {
    return { ok: false, error: 'Minutos inválidos (0-59)' };
  }

  // `Date` con mes 0-indexado
  const local = new Date(anio, mes - 1, dia, h, m, 0, 0);
  if (
    local.getFullYear() !== anio ||
    local.getMonth() !== mes - 1 ||
    local.getDate() !== dia
  ) {
    return { ok: false, error: 'La fecha no es válida (ej. 31/02 no existe)' };
  }

  const ahora = new Date(Date.now() - 60_000); // 1 min de margen
  if (local.getTime() < ahora.getTime()) {
    return { ok: false, error: 'La fecha y hora no pueden ser en el pasado' };
  }

  return { ok: true, iso: local.toISOString() };
}
