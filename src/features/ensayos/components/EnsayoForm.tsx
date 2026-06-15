/**
 * Formulario compartido para crear y editar ensayos.
 *
 * Modos:
 * - `mode="create"`: solo pide `grupoId`, crea un ensayo nuevo.
 * - `mode="edit"`: pide `ensayoId`, edita un ensayo existente.
 *
 * Decisiones:
 * - La fecha y hora se piden con un DateTimePicker? No — para v0.1.0
 *   usamos inputs de texto (YYYY-MM-DD y HH:MM) con validación inline.
 *   DateTimePicker requiere un módulo nativo adicional que en SDK 56
 *   todavía tiene fricciones con `newArchEnabled`.
 * - El encargado se elige de una lista plana de miembros del grupo
 *   (no es un selector fancy — para v0.1.0 alcanza).
 */
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { useGestionEnsayos, useMiembrosGrupo } from '@/features/ensayos/hooks';
import { CrearEnsayoInput, EditarEnsayoInput, EnsayoConEncargado } from '@/features/ensayos/types';
import { notificarPush } from '@/lib/pushApi';

interface EnsayoFormProps {
  mode: 'create' | 'edit';
  grupoId: string;
  /** Solo para mode=edit. */
  ensayo?: EnsayoConEncargado | null;
  onGuardado: (id: string) => void;
  onCancelar: () => void;
}

function formatearFechaInput(iso: string): string {
  // "2026-06-21T19:00:00-05:00" → "2026-06-21"
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

function formatearHoraInput(iso: string): string {
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
  if (!fecha || !hora) return null;
  const d = new Date(`${fecha}T${hora}:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function isHoraValida(hora: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

function isFechaValida(fecha: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha);
}

export function EnsayoForm({
  mode,
  grupoId,
  ensayo,
  onGuardado,
  onCancelar,
}: EnsayoFormProps) {
  const { miembros, loading: loadingMiembros } = useMiembrosGrupo(grupoId);
  const { crear, editar, loading: guardando, error, clearError } = useGestionEnsayos();

  // Estado del formulario
  const [titulo, setTitulo] = useState(ensayo?.titulo ?? '');
  const [fecha, setFecha] = useState(
    ensayo?.fecha_inicio ? formatearFechaInput(ensayo.fecha_inicio) : '',
  );
  const [hora, setHora] = useState(
    ensayo?.fecha_inicio ? formatearHoraInput(ensayo.fecha_inicio) : '19:00',
  );
  const [horaFin, setHoraFin] = useState(
    ensayo?.fecha_fin ? formatearHoraInput(ensayo.fecha_fin) : '',
  );
  const [lugar, setLugar] = useState(ensayo?.lugar ?? '');
  const [descripcion, setDescripcion] = useState(ensayo?.descripcion ?? '');
  const [tema, setTema] = useState(ensayo?.tema ?? '');
  const [encargadoId, setEncargadoId] = useState<string | null>(ensayo?.encargado_id ?? null);

  const [errores, setErrores] = useState<Record<string, string>>({});

  const validar = useCallback((): boolean => {
    const e: Record<string, string> = {};
    if (!titulo.trim()) e.titulo = 'El título es obligatorio';
    if (!isFechaValida(fecha)) e.fecha = 'Formato YYYY-MM-DD';
    if (!isHoraValida(hora)) e.hora = 'Formato HH:MM (24h)';
    if (horaFin && !isHoraValida(horaFin)) e.horaFin = 'Formato HH:MM (24h)';
    setErrores(e);
    return Object.keys(e).length === 0;
  }, [titulo, fecha, hora, horaFin]);

  const onGuardar = useCallback(async () => {
    clearError();
    if (!validar()) return;

    const fechaInicioISO = combinarFechaHora(fecha, hora);
    if (!fechaInicioISO) {
      setErrores({ fecha: 'Fecha u hora inválida' });
      return;
    }
    const fechaFinISO = horaFin ? combinarFechaHora(fecha, horaFin) : null;

    const datosComunes = {
      titulo: titulo.trim(),
      fecha_inicio: fechaInicioISO,
      fecha_fin: fechaFinISO,
      lugar: lugar.trim() || null,
      descripcion: descripcion.trim() || null,
      tema: tema.trim() || null,
      encargado_id: encargadoId,
    };

    if (mode === 'create') {
      const input: CrearEnsayoInput = { grupo_id: grupoId, ...datosComunes };
      const result = await crear(input);
      if (result) {
        // Push a todos los miembros del grupo
        await notificarPush('ensayo_creado', {
          grupo_id: grupoId,
          ensayo_id: result.id,
          titulo: input.titulo,
          fecha_inicio: input.fecha_inicio,
          lugar: input.lugar,
        });
        Alert.alert('Ensayo creado', 'Los miembros del grupo recibirán un push de aviso.', [
          { text: 'OK', onPress: () => onGuardado(result.id) },
        ]);
      }
    } else if (ensayo) {
      const cambios: EditarEnsayoInput = datosComunes;
      const ok = await editar(ensayo.id, cambios);
      if (ok) {
        await notificarPush('ensayo_modificado', {
          grupo_id: grupoId,
          ensayo_id: ensayo.id,
          titulo: cambios.titulo ?? ensayo.titulo,
          fecha_inicio: cambios.fecha_inicio ?? ensayo.fecha_inicio,
          lugar: cambios.lugar ?? ensayo.lugar,
        });
        Alert.alert('Ensayo actualizado', '', [
          { text: 'OK', onPress: () => onGuardado(ensayo.id) },
        ]);
      }
    }
  }, [
    mode,
    grupoId,
    ensayo,
    titulo,
    fecha,
    hora,
    horaFin,
    lugar,
    descripcion,
    tema,
    encargadoId,
    validar,
    crear,
    editar,
    clearError,
    onGuardado,
  ]);

  if (loadingMiembros) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

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
            placeholder="Ej: Ensayo general"
            placeholderTextColor="#94a3b8"
            className={`h-12 rounded-lg border bg-white px-3 text-base text-slate-900 ${
              errores.titulo ? 'border-red-500' : 'border-slate-300'
            }`}
          />
          {errores.titulo ? (
            <Text className="mt-1 text-xs text-red-600">{errores.titulo}</Text>
          ) : null}
        </View>

        {/* Fecha y hora */}
        <View className="mx-4 mb-3 rounded-lg border border-slate-200 bg-white p-4">
          <Text className="text-sm font-semibold text-slate-900">Cuándo</Text>
          <View className="mt-3 flex-row gap-3">
            <View className="flex-1">
              <Text className="mb-1.5 text-sm font-medium text-slate-700">Fecha *</Text>
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
              <Text className="mb-1.5 text-sm font-medium text-slate-700">Hora inicio *</Text>
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
            <View className="flex-1">
              <Text className="mb-1.5 text-sm font-medium text-slate-700">Hora fin</Text>
              <TextInput
                value={horaFin}
                onChangeText={setHoraFin}
                placeholder="HH:MM"
                placeholderTextColor="#94a3b8"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                className={`h-12 rounded-lg border bg-white px-3 text-base text-slate-900 ${
                  errores.horaFin ? 'border-red-500' : 'border-slate-300'
                }`}
              />
              {errores.horaFin ? (
                <Text className="mt-1 text-xs text-red-600">{errores.horaFin}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Lugar, descripción, tema */}
        <View className="mx-4 mb-3 rounded-lg border border-slate-200 bg-white p-4">
          <Text className="mb-1.5 text-sm font-medium text-slate-700">Lugar</Text>
          <TextInput
            value={lugar}
            onChangeText={setLugar}
            placeholder="Ej: Templo principal"
            placeholderTextColor="#94a3b8"
            className="h-12 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900"
          />

          <Text className="mb-1.5 mt-3 text-sm font-medium text-slate-700">Descripción</Text>
          <TextInput
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Notas generales del ensayo"
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
            className="min-h-20 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900"
          />

          <Text className="mb-1.5 mt-3 text-sm font-medium text-slate-700">
            🎵 Tema a ensayar
          </Text>
          <TextInput
            value={tema}
            onChangeText={setTema}
            placeholder="Ej: Canción nueva del domingo"
            placeholderTextColor="#94a3b8"
            className="h-12 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900"
          />
        </View>

        {/* Encargado (selector plano) */}
        <View className="mx-4 mb-3 rounded-lg border border-slate-200 bg-white p-4">
          <Text className="mb-1.5 text-sm font-semibold text-slate-900">Encargado</Text>
          <Text className="mb-3 text-xs text-slate-500">
            El miembro que se va a encargar de cerrar la asistencia. Opcional.
          </Text>
          <Pressable
            onPress={() => setEncargadoId(null)}
            className={`mb-1.5 flex-row items-center justify-between rounded-md border px-3 py-2.5 ${
              encargadoId === null
                ? 'border-primary-600 bg-primary-50'
                : 'border-slate-200 bg-white active:bg-slate-50'
            }`}
          >
            <Text className="text-sm text-slate-700">Sin encargado</Text>
          </Pressable>
          {miembros.map((m) => {
            const selected = encargadoId === m.usuario_id;
            return (
              <Pressable
                key={m.usuario_grupo_id}
                onPress={() => setEncargadoId(m.usuario_id)}
                className={`mb-1.5 flex-row items-center justify-between rounded-md border px-3 py-2.5 ${
                  selected
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-slate-200 bg-white active:bg-slate-50'
                }`}
              >
                <View className="flex-1">
                  <Text className="text-sm font-medium text-slate-900">
                    {m.nombre} {m.apellido}
                  </Text>
                  {m.rol === 'admin' ? (
                    <Text className="text-xs text-primary-600">Admin del grupo</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View className="mx-4 mt-2 flex-row gap-3">
          <View className="flex-1">
            <Button title="Cancelar" variant="secondary" onPress={onCancelar} />
          </View>
          <View className="flex-1">
            <Button
              title={mode === 'create' ? 'Crear ensayo' : 'Guardar cambios'}
              onPress={onGuardar}
              loading={guardando}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
