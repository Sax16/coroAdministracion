/**
 * Formulario compartido para crear y editar comunicados.
 *
 * Campos:
 * - titulo (obligatorio)
 * - descripcion (obligatorio, multilinea)
 * - fecha_inicio (opcional): si el toggle "Con fecha" está activo,
 *   se muestra un DatePickerField + TimePickerField. Si no, no se
 *   manda fecha_inicio a la DB.
 * - lugar (opcional)
 *
 * Decisión: la fecha/hora opcionales se piden con los pickers nativos
 * (DatePickerField + TimePickerField). El form trabaja con `Date`
 * local y recién al guardar convierte a ISO UTC.
 */
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { DatePickerField } from '@/components/DatePickerField';
import { TimePickerField } from '@/components/TimePickerField';
import { useGestionComunicados } from '@/features/comunicados/hooks';
import { Comunicado, CrearComunicadoInput, EditarComunicadoInput } from '@/features/comunicados/types';
import { combineLocalDateTime, dateToHHMM, isoToLocalDate } from '@/lib/dateTime';

interface ComunicadoFormProps {
  mode: 'create' | 'edit';
  grupoId: string;
  /** Solo para mode=edit. */
  comunicado?: Comunicado | null;
  onGuardado: (id: string) => void;
  onCancelar: () => void;
}

export function ComunicadoForm({
  mode,
  grupoId,
  comunicado,
  onGuardado,
  onCancelar,
}: ComunicadoFormProps) {
  const { crear, editar, loading, error, clearError } = useGestionComunicados();

  const [titulo, setTitulo] = useState(comunicado?.titulo ?? '');
  const [descripcion, setDescripcion] = useState(comunicado?.descripcion ?? '');
  const [fecha, setFecha] = useState<Date | null>(
    comunicado?.fecha_inicio ? isoToLocalDate(comunicado.fecha_inicio) : null,
  );
  const [hora, setHora] = useState<Date | null>(() => {
    if (!comunicado?.fecha_inicio) return null;
    const d = new Date(comunicado.fecha_inicio);
    return isNaN(d.getTime()) ? null : d;
  });
  const [lugar, setLugar] = useState(comunicado?.lugar ?? '');
  const [tieneFecha, setTieneFecha] = useState(!!comunicado?.fecha_inicio);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const validar = useCallback((): boolean => {
    const e: Record<string, string> = {};
    if (!titulo.trim()) e.titulo = 'El título es obligatorio';
    if (!descripcion.trim()) e.descripcion = 'La descripción es obligatoria';
    // Si tieneFecha está activo, ambos campos son obligatorios
    if (tieneFecha) {
      if (!fecha) e.fecha = 'Seleccioná una fecha';
      if (!hora) e.hora = 'Seleccioná una hora';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  }, [titulo, descripcion, fecha, hora, tieneFecha]);

  const onGuardar = useCallback(async () => {
    clearError();
    if (!validar()) return;

    const fechaInicioISO =
      tieneFecha && fecha && hora
        ? combineLocalDateTime(fecha, dateToHHMM(hora))
        : null;

    const datosComunes = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      fecha_inicio: fechaInicioISO,
      lugar: lugar.trim() || null,
    };

    if (mode === 'create') {
      const input: CrearComunicadoInput = { grupo_id: grupoId, ...datosComunes };
      const result = await crear(input);
      if (result) {
        Alert.alert('Comunicado creado', '', [
          { text: 'OK', onPress: () => onGuardado(result.id) },
        ]);
      }
    } else if (comunicado) {
      const cambios: EditarComunicadoInput = datosComunes;
      const ok = await editar(comunicado.id, cambios);
      if (ok) {
        Alert.alert('Comunicado actualizado', '', [
          { text: 'OK', onPress: () => onGuardado(comunicado.id) },
        ]);
      }
    }
  }, [
    mode,
    grupoId,
    comunicado,
    titulo,
    descripcion,
    fecha,
    hora,
    lugar,
    tieneFecha,
    validar,
    crear,
    editar,
    clearError,
    onGuardado,
  ]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-50"
    >
      <ScrollView contentContainerClassName="pb-10" keyboardShouldPersistTaps="handled">
        {error ? (
          <View className="m-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : null}

        {/* Título */}
        <View className="m-4 rounded-lg border border-slate-200 bg-white p-4">
          <Text className="mb-1.5 text-sm font-medium text-slate-700">Título *</Text>
          <TextInput
            value={titulo}
            onChangeText={setTitulo}
            placeholder="Ej: Cambio de horario del domingo"
            placeholderTextColor="#94a3b8"
            className={`h-12 rounded-lg border bg-white px-3 text-base text-slate-900 ${
              errores.titulo ? 'border-red-500' : 'border-slate-300'
            }`}
          />
          {errores.titulo ? (
            <Text className="mt-1 text-xs text-red-600">{errores.titulo}</Text>
          ) : null}
        </View>

        {/* Descripción */}
        <View className="mx-4 mb-3 rounded-lg border border-slate-200 bg-white p-4">
          <Text className="mb-1.5 text-sm font-medium text-slate-700">Descripción *</Text>
          <TextInput
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Detalle del comunicado"
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            className={`min-h-28 rounded-lg border bg-white px-3 py-2 text-base text-slate-900 ${
              errores.descripcion ? 'border-red-500' : 'border-slate-300'
            }`}
          />
          {errores.descripcion ? (
            <Text className="mt-1 text-xs text-red-600">{errores.descripcion}</Text>
          ) : null}
        </View>

        {/* Fecha y hora (opcional) */}
        <View className="mx-4 mb-3 rounded-lg border border-slate-200 bg-white p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-slate-900">¿Es un evento con fecha?</Text>
            <Pressable
              onPress={() => setTieneFecha(!tieneFecha)}
              className={`rounded-md border px-3 py-1 ${
                tieneFecha
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  tieneFecha ? 'text-primary-700' : 'text-slate-700'
                }`}
              >
                {tieneFecha ? '✓ Con fecha' : 'Sin fecha'}
              </Text>
            </Pressable>
          </View>
          {tieneFecha ? (
            <View className="mt-3">
              <DatePickerField
                label="Fecha"
                value={fecha}
                onChange={setFecha}
                error={errores.fecha}
              />
              <TimePickerField
                label="Hora"
                value={hora}
                onChange={setHora}
                error={errores.hora}
              />
            </View>
          ) : null}
        </View>

        {/* Lugar */}
        <View className="mx-4 mb-3 rounded-lg border border-slate-200 bg-white p-4">
          <Text className="mb-1.5 text-sm font-medium text-slate-700">Lugar (opcional)</Text>
          <TextInput
            value={lugar}
            onChangeText={setLugar}
            placeholder="Ej: Templo principal"
            placeholderTextColor="#94a3b8"
            className="h-12 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900"
          />
        </View>

        <View className="mx-4 mt-2 flex-row gap-3">
          <View className="flex-1">
            <Button title="Cancelar" variant="secondary" onPress={onCancelar} />
          </View>
          <View className="flex-1">
            <Button
              title={mode === 'create' ? 'Crear comunicado' : 'Guardar cambios'}
              onPress={onGuardar}
              loading={loading}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
