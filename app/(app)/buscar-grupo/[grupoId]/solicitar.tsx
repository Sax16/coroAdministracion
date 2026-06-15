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
import { useGestionSolicitudes } from '@/features/solicitudes/hooks';
import { supabase } from '@/lib/supabase';
import { notificarPush } from '@/lib/pushApi';

/**
 * Pantalla para confirmar y enviar la solicitud de ingreso a un grupo
 * (RF-020).
 *
 * Muestra el nombre del grupo y un campo opcional de mensaje (ej.
 * "Hola, soy Juan y me encantaría sumarme al coro"). Al enviar,
 * se crea la solicitud y se dispara el push al admin del grupo
 * (RF-065) — `solicitud_recibida`.
 *
 * Decisiones:
 * - El nombre del grupo se trae de la DB al montar (con la policy
 *   que ahora permite SELECT a cualquier autenticado).
 * - El mensaje es opcional: si el usuario quiere entrar sin más,
 *   puede dejar el campo vacío.
 * - Si el usuario ya es miembro activo o tiene solicitud pendiente,
 *   el botón se deshabilita (defensa en profundidad; la API ya
 *   valida con unique violation).
 */
export default function SolicitarIngresoScreen() {
  const router = useRouter();
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>();

  const [nombreGrupo, setNombreGrupo] = useState<string | null>(null);
  const [descripcionGrupo, setDescripcionGrupo] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [cargandoGrupo, setCargandoGrupo] = useState(true);
  const [yaEsMiembro, setYaEsMiembro] = useState(false);
  const [errorGrupo, setErrorGrupo] = useState<string | null>(null);

  const { crear, loading: enviando, error } = useGestionSolicitudes();

  useEffect(() => {
    if (!grupoId) return;
    let cancelado = false;
    (async () => {
      // 1. Info del grupo (campos seguros)
      const { data: grupo, error: errGrupo } = await supabase
        .from('grupos')
        .select('id, nombre, descripcion')
        .eq('id', grupoId)
        .maybeSingle();
      if (cancelado) return;
      if (errGrupo) {
        setErrorGrupo(errGrupo.message);
        setCargandoGrupo(false);
        return;
      }
      if (!grupo) {
        setErrorGrupo('Grupo no encontrado');
        setCargandoGrupo(false);
        return;
      }
      setNombreGrupo(grupo.nombre);
      setDescripcionGrupo(grupo.descripcion);

      // 2. ¿El usuario actual ya es miembro activo o tiene solicitud pendiente?
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: ug } = await supabase
          .from('usuarios_grupos')
          .select('id')
          .eq('grupo_id', grupoId)
          .eq('usuario_id', userData.user.id)
          .eq('estado', 'activo')
          .maybeSingle();
        if (ug) setYaEsMiembro(true);
        if (!ug) {
          const { data: sol } = await supabase
            .from('solicitudes_grupo')
            .select('id')
            .eq('grupo_id', grupoId)
            .eq('usuario_id', userData.user.id)
            .eq('estado', 'pendiente')
            .maybeSingle();
          if (sol) setYaEsMiembro(true);
        }
      }

      setCargandoGrupo(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [grupoId]);

  const onEnviar = useCallback(async () => {
    if (!grupoId) return;
    const result = await crear({ grupo_id: grupoId, mensaje });
    if (result) {
      // Push al admin del grupo (RF-065)
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: perf } = await supabase
          .from('perfiles')
          .select('nombre, apellido')
          .eq('id', userData.user.id)
          .maybeSingle();
        const nombreCompleto = perf
          ? `${perf.nombre} ${perf.apellido}`
          : 'Alguien';
        await notificarPush('solicitud_recibida', {
          grupo_id: grupoId,
          solicitud_id: result.id,
          solicitante_nombre: nombreCompleto,
        });
      }
      Alert.alert(
        'Solicitud enviada',
        'Te avisamos cuando un admin del grupo la revise.',
        [{ text: 'OK', onPress: () => router.replace('/(app)/buscar-grupo') }],
      );
    }
  }, [grupoId, mensaje, crear, router]);

  if (cargandoGrupo) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (errorGrupo) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Stack.Screen options={{ title: 'Solicitar ingreso' }} />
        <Text className="text-center text-base font-semibold text-slate-700">
          {errorGrupo}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Solicitar ingreso',
          headerBackTitle: 'Atrás',
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-slate-50"
      >
        <ScrollView contentContainerClassName="pb-10" keyboardShouldPersistTaps="handled">
          <View className="m-4 rounded-lg border border-slate-200 bg-white p-4">
            <Text className="text-sm text-slate-500">Grupo</Text>
            <Text className="mt-1 text-2xl font-bold text-slate-900">
              {nombreGrupo}
            </Text>
            {descripcionGrupo ? (
              <Text className="mt-1 text-sm text-slate-600">{descripcionGrupo}</Text>
            ) : null}
          </View>

          {yaEsMiembro ? (
            <View className="mx-4 mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <Text className="text-sm text-amber-800">
                Ya sos parte de este grupo o ya tenés una solicitud pendiente.
                Volvé a la búsqueda para ver otros grupos.
              </Text>
              <Pressable
                onPress={() => router.replace('/(app)/buscar-grupo')}
                className="mt-2 h-10 items-center justify-center rounded-md bg-amber-600 active:bg-amber-700"
              >
                <Text className="text-sm font-semibold text-white">Volver</Text>
              </Pressable>
            </View>
          ) : (
            <View className="mx-4 mb-3 rounded-lg border border-slate-200 bg-white p-4">
              <Text className="text-sm font-semibold text-slate-900">
                Mensaje opcional
              </Text>
              <Text className="mt-1 text-xs text-slate-500">
                Contale al admin quién sos y por qué querés sumarte. Si
                preferís, dejalo en blanco.
              </Text>
              <TextInput
                value={mensaje}
                onChangeText={setMensaje}
                placeholder="Hola, soy…"
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                className="mt-3 min-h-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900"
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
                  <Button title="Enviar solicitud" onPress={onEnviar} loading={enviando} />
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
