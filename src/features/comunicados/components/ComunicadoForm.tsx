/**
 * Formulario compartido para crear y editar comunicados.
 *
 * Campos:
 * - titulo (obligatorio)
 * - descripcion (obligatorio, multilinea)
 * - fecha_inicio (opcional, formato YYYY-MM-DDTHH:MM o vacío)
 * - lugar (opcional)
 *
 * Decisión: fecha_inicio se pide como dos inputs separados (fecha +
 * hora) para mantener consistencia con los forms de ensayo y
 * servicio. Si ambos están vacíos, no se manda fecha_inicio.
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
import { useGestionComunicados } from '@/features/comunicados/hooks';
import { Comunicado, CrearComunicadoInput, EditarComunicadoInput } from '@/features/comunicados/types';
import { notificarPush } from '@/lib/pushApi';

interface ComunicadoFormProps {
  mode: 'create' | 'edit';
  grupoId: string;
  /** Solo para mode=edit. */
  comunicado?: Comunicado | null;
  onGuardado: (id: string) => void;
  onCancelar: () => void;
}

function formatearFechaInput(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return '';
  }
}

function formatearHoraInput(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
}

function combinarFechaHora(fecha: string, hora: string): string | null {
  if (!fecha) return null;
  const h = hora || '00:00';
  const d = new Date(`${fecha}T${h}:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function isFechaValida(fecha: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha);
}

function isHoraValida(hora: string): boolean {
  return hora === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
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
  const [fecha, setFecha] = useState(formatearFechaInput(comunicado?.fecha_inicio ?? null));
  const [hora, setHora] = useState(formatearHoraInput(comunicado?.fecha_inicio ?? null));
  const [lugar, setLugar] = useState(comunicado?.lugar ?? '');
  const [tieneFecha, setTieneFecha] = useState(!!comunicado?.fecha_inicio);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const validar = useCallback((): boolean => {
    const e: Record<string, string> = {};
    if (!titulo.trim()) e.titulo = 'El título es obligatorio';
    if (!descripcion.trim()) e.descripcion = 'La descripción es obligatoria';
    if (fecha && !isFechaValida(fecha)) e.fecha = 'Formato YYYY-MM-DD';
    if (!isHoraValida(hora)) e.hora = 'Formato HH:MM (24h)';
    setErrores(e);
    return Object.keys(e).length === 0;
  }, [titulo, descripcion, fecha, hora]);

  const onGuardar = useCallback(async () => {
    clearError();
    if (!validar()) return;

    const fechaInicioISO = tieneFecha ? combinarFechaHora(fecha, hora) : null;
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
        // Push a todos los miembros del grupo
        await notificarPush('comunicado_publicado', {
          grupo_id: grupoId,
          comunicado_id: result.id,
          titulo: input.titulo,
          fecha_inicio: input.fecha_inicio,
          lugar: input.lugar,
        });
        Alert.alert('Comunicado publicado', 'Los miembros del grupo recibirán un push.', [
          { text: 'OK', onPress: () => onGuardado(result.id) },
        ]);
      }
    } else if (comunicado) {
      const cambios: EditarComunicadoInput = datosComunes;
      const ok = await editar(comunicado.id, cambios);
      if (ok) onGuardado(comunicado.id);
    }
  }, [
    mode,
    grupoId,
    comunicado,
    titulo,
    descripcion,
    tieneFecha,
    fecha,
    hora,
    lugar,
    validar,
    crear,
    editar,
    clearError,
    onGuardado,
  ]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            <View className="mt-3 flex-row gap-3">
              <View className="flex-1">
                <Text className="mb-1.5 text-sm font-medium text-slate-700">Fecha</Text>
                <TextInput
                  value={fecha}
                  onChangeText={setFecha}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  className={`h-12 rounded-lg border bg-white px-3 text-base text-slate-900 ${
                    errores.fecha ? 'border-red-500' : 'border-slate-300'
                  }`}
                />
                {errores.fecha ? (
                  <Text className="mt-1 text-xs text-red-600">{errores.fecha}</Text>
                ) : null}
              </View>
              <View className="flex-1">
                <Text className="mb-1.5 text-sm font-medium text-slate-700">Hora</Text>
                <TextInput
                  value={hora}
                  onChangeText={setHora}
                  placeholder="HH:MM"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  className={`h-12 rounded-lg border bg-white px-3 text-base text-slate-900 ${
                    errores.hora ? 'border-red-500' : 'border-slate-300'
                  }`}
                />
                {errores.hora ? (
                  <Text className="mt-1 text-xs text-red-600">{errores.hora}</Text>
                ) : null}
              </View>
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
              title={mode === 'create' ? 'Publicar' : 'Guardar cambios'}
              onPress={onGuardar}
              loading={loading}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
