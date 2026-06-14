import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { useGuardarPatron, usePatron } from '@/features/patron/hooks';
import {
  configToMap,
  DEFAULTS,
  DiaSemana,
  DIAS_LABELS,
  DIAS_ORDEN,
  Horario,
  isHoraValida,
  mapToConfig,
  PATRON_VACIO,
} from '@/features/patron/types';

/**
 * Pantalla de configuración del patrón recurrente.
 *
 * RF-040: el Admin configura el patrón semanal (días, horarios, soporte
 *   para doble horario).
 * RF-041: la generación de servicios ocurre automáticamente vía trigger
 *   en la DB al guardar (no la manejamos desde la app).
 * RF-044: offset de alarma configurable (default 60 min).
 *
 * Estructura del jsonb (debe coincidir con el trigger
 * generar_servicios_desde_patron() y con crear_grupo()):
 *   { "dias": { "0": [{"hora": "19:00"}], "1": [...], ... } }
 *   0 = domingo, 1 = lunes, ..., 6 = sábado.
 *
 * Ver docs/04-modelo-de-datos.md §2.6.
 */
export default function PatronScreen() {
  const router = useRouter();
  const { id: grupoId } = useLocalSearchParams<{ id: string }>();

  const { patron, loading, error: loadError } = usePatron(grupoId ?? '');
  const { guardar, loading: guardando, error: saveError, clearError } = useGuardarPatron();

  // Estado local del formulario. Se inicializa con el patrón cargado
  // o con valores por default si todavía no hay patrón.
  const [dias, setDias] = useState<Record<DiaSemana, Horario[]>>(() =>
    configToMap(PATRON_VACIO),
  );
  const [offset, setOffset] = useState<number>(DEFAULTS.offsetAlarmaMin);
  const [semanas, setSemanas] = useState<number>(DEFAULTS.semanasGeneradas);
  const [initialized, setInitialized] = useState(false);

  // Cuando llega el patrón de la DB, hidrata el formulario.
  useEffect(() => {
    if (initialized || loading) return;
    if (patron) {
      setDias(configToMap(patron.configuracion));
      setOffset(patron.offset_alarma_min);
      setSemanas(patron.semanas_generadas);
    }
    setInitialized(true);
  }, [patron, loading, initialized]);

  const agregarHorario = useCallback(
    (dia: DiaSemana, hora: string) => {
      if (!isHoraValida(hora)) return;
      setDias((prev) => ({
        ...prev,
        [dia]: [...prev[dia], { hora }].sort((a, b) => a.hora.localeCompare(b.hora)),
      }));
    },
    [],
  );

  const eliminarHorario = useCallback((dia: DiaSemana, index: number) => {
    setDias((prev) => ({
      ...prev,
      [dia]: prev[dia].filter((_, i) => i !== index),
    }));
  }, []);

  const onGuardar = async () => {
    if (!grupoId) return;
    clearError();
    const ok = await guardar(grupoId, {
      configuracion: mapToConfig(dias),
      offset_alarma_min: offset,
      semanas_generadas: semanas,
    });
    if (ok) {
      Alert.alert(
        'Patrón guardado',
        'Los servicios se generaron automáticamente según el nuevo patrón.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Patrón de servicios',
          headerBackTitle: 'Atrás',
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-slate-50"
      >
        <ScrollView
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled"
        >
          {loadError ? (
            <View className="border-b border-red-200 bg-red-50 px-4 py-3">
              <Text className="text-sm text-red-700">{loadError}</Text>
            </View>
          ) : null}

          {/* Configuración general */}
          <View className="m-4 rounded-lg border border-slate-200 bg-white p-4">
            <Text className="text-base font-semibold text-slate-900">
              Configuración general
            </Text>

            <View className="mt-4 flex-row gap-3">
              <View className="flex-1">
                <Text className="mb-1.5 text-sm font-medium text-slate-700">
                  Alarma (min antes)
                </Text>
                <TextInput
                  value={String(offset)}
                  onChangeText={(t) => {
                    const n = parseInt(t.replace(/\D/g, ''), 10);
                    setOffset(isNaN(n) ? 0 : Math.max(0, n));
                  }}
                  keyboardType="number-pad"
                  className="h-12 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900"
                />
              </View>

              <View className="flex-1">
                <Text className="mb-1.5 text-sm font-medium text-slate-700">
                  Semanas a generar
                </Text>
                <TextInput
                  value={String(semanas)}
                  onChangeText={(t) => {
                    const n = parseInt(t.replace(/\D/g, ''), 10);
                    setSemanas(isNaN(n) ? 1 : Math.min(26, Math.max(1, n)));
                  }}
                  keyboardType="number-pad"
                  className="h-12 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900"
                />
              </View>
            </View>

            <Text className="mt-2 text-xs text-slate-500">
              La alarma suena N minutos antes de cada servicio (default 60).
              Los servicios se generan para las próximas N semanas (1–26).
            </Text>
          </View>

          {/* Días */}
          {DIAS_ORDEN.map((dia) => (
            <DiaRow
              key={dia}
              dia={dia}
              horarios={dias[dia]}
              onAgregar={(hora) => agregarHorario(dia, hora)}
              onEliminar={(idx) => eliminarHorario(dia, idx)}
            />
          ))}

          {saveError ? (
            <View className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <Text className="text-sm text-red-700">{saveError}</Text>
            </View>
          ) : null}

          <View className="mx-4 mt-2">
            <Button title="Guardar patrón" onPress={onGuardar} loading={guardando} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

interface DiaRowProps {
  dia: DiaSemana;
  horarios: Horario[];
  onAgregar: (hora: string) => void;
  onEliminar: (index: number) => void;
}

function DiaRow({ dia, horarios, onAgregar, onEliminar }: DiaRowProps) {
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const handleAgregar = () => {
    const hora = input.trim();
    if (!hora) return;
    if (!isHoraValida(hora)) {
      setInputError('Formato HH:MM (24h)');
      return;
    }
    onAgregar(hora);
    setInput('');
    setInputError(null);
  };

  return (
    <View className="mx-4 mb-3 rounded-lg border border-slate-200 bg-white p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-slate-900">
          {DIAS_LABELS[dia]}
        </Text>
        <Text className="text-xs text-slate-500">
          {horarios.length === 0
            ? 'Sin servicios'
            : `${horarios.length} ${horarios.length === 1 ? 'servicio' : 'servicios'}`}
        </Text>
      </View>

      {horarios.length > 0 ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {horarios.map((h, idx) => (
            <View
              key={`${h.hora}-${idx}`}
              className="flex-row items-center rounded-full bg-primary-100 pl-3 pr-1 py-1"
            >
              <Text className="text-sm font-medium text-primary-700">{h.hora}</Text>
              <Pressable
                onPress={() => onEliminar(idx)}
                hitSlop={8}
                className="ml-1 h-6 w-6 items-center justify-center rounded-full active:bg-primary-200"
              >
                <Text className="text-base font-bold text-primary-700">×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View className="mt-3 flex-row items-end gap-2">
        <View className="flex-1">
          <TextInput
            value={input}
            onChangeText={(t) => {
              setInput(t);
              setInputError(null);
            }}
            placeholder="HH:MM"
            placeholderTextColor="#94a3b8"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            autoCapitalize="none"
            autoCorrect={false}
            className={`h-12 rounded-lg border bg-white px-3 text-base text-slate-900 ${
              inputError ? 'border-red-500' : 'border-slate-300'
            }`}
            onSubmitEditing={handleAgregar}
            returnKeyType="done"
          />
          {inputError ? (
            <Text className="mt-1 text-xs text-red-600">{inputError}</Text>
          ) : null}
        </View>
        <Pressable
          onPress={handleAgregar}
          className="h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 active:bg-slate-50"
        >
          <Text className="text-sm font-semibold text-slate-700">Agregar</Text>
        </Pressable>
      </View>
    </View>
  );
}
